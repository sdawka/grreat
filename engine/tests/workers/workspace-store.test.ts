import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { StoreClient, type Fetchable } from '../../src/store/store-client.ts';
import type { Mutation } from '../../src/domain/mutations.ts';

interface TestEnv {
  WORKSPACE_STORE: {
    idFromName(name: string): unknown;
    get(id: unknown): Fetchable;
  };
}

let counter = 0;
function freshStore(): StoreClient {
  // A fresh DO instance per test: unique workspace name.
  const testEnv = env as unknown as TestEnv;
  const ns = testEnv.WORKSPACE_STORE;
  counter += 1;
  return new StoreClient(ns.get(ns.idFromName(`test-${Date.now()}-${counter}`)));
}

const goalData = (title: string, status = 'active') => ({
  mode: 'project',
  title,
  outcome: `${title} done`,
  status,
  owner: { type: 'human', name: 'sahil' },
});

describe('WorkspaceStore', () => {
  it('creates, lists, and gets a goal with provenance', async () => {
    const store = freshStore();
    const results = await store.apply(
      [{ op: 'create', kind: 'goal', data: goalData('Write a book') }],
      { instructionId: 'ins-1', workflowName: 'interpret' },
    );
    expect(results[0]?.applied).toBe(true);
    const id = results[0]!.id!;

    const listed = await store.list('goal');
    expect(listed).toHaveLength(1);
    expect(listed[0]?.provenance).toEqual({ instructionId: 'ins-1', workflowName: 'interpret' });

    const detail = await store.get('goal', id);
    expect(detail?.entity.title).toBe('Write a book');
  });

  it('rejects invalid entity data at the write barrier', async () => {
    const store = freshStore();
    const results = await store.apply([
      { op: 'create', kind: 'goal', data: { title: 'no owner, no outcome' } },
    ]);
    expect(results[0]?.applied).toBe(false);
    expect(results[0]?.error?.code).toBe('no-owner');
    expect(await store.list('goal')).toHaveLength(0);
  });

  it('enforces the WIP limit of 5 active goals batch-wide', async () => {
    const store = freshStore();
    const five: Mutation[] = Array.from({ length: 5 }, (_, i) => ({
      op: 'create' as const,
      kind: 'goal',
      data: goalData(`Goal ${i}`),
    }));
    const ok = await store.apply(five);
    expect(ok.every((r) => r.applied)).toBe(true);

    const sixth = await store.apply([{ op: 'create', kind: 'goal', data: goalData('Too many') }]);
    expect(sixth[0]?.applied).toBe(false);
    expect(sixth[0]?.error?.code).toBe('wip-limit');

    // Parking one in the same batch frees the slot.
    const goals = await store.list('goal');
    const parkAndAdd = await store.apply([
      { op: 'update', kind: 'goal', id: goals[0]!.id, patch: { status: 'parked' } },
      { op: 'create', kind: 'goal', data: goalData('Now it fits') },
    ]);
    expect(parkAndAdd.every((r) => r.applied)).toBe(true);
  });

  it('preserves createdAt across updates', async () => {
    const store = freshStore();
    const [created] = await store.apply([
      { op: 'create', kind: 'goal', data: goalData('Stable timestamps') },
    ]);
    const before = await store.get('goal', created!.id!);
    await new Promise((resolve) => setTimeout(resolve, 5));
    await store.apply([
      { op: 'update', kind: 'goal', id: created!.id!, patch: { outcome: 'revised outcome' } },
    ]);
    const after = await store.get('goal', created!.id!);
    expect(after?.entity.createdAt).toBe(before?.entity.createdAt);
    expect(after?.entity.outcome).toBe('revised outcome');
    expect(after?.entity.updatedAt).not.toBe(before?.entity.updatedAt);
  });

  it('resolves $ref:N batch references and validates relations', async () => {
    const store = freshStore();
    const results = await store.apply([
      { op: 'create', kind: 'goal', data: goalData('Linked goal') },
      {
        op: 'create',
        kind: 'next-action',
        data: {
          description: 'First step',
          goalId: '$ref:0',
          owner: { type: 'ai', name: 'hermes' },
          isPrimary: true,
          status: 'todo',
        },
      },
      {
        op: 'relate',
        relationKind: 'advances',
        from: { kind: 'next-action', id: '$ref:1' },
        to: { kind: 'goal', id: '$ref:0' },
      },
    ]);
    expect(results.every((r) => r.applied)).toBe(true);

    const action = await store.get('next-action', results[1]!.id!);
    expect(action?.entity.goalId).toBe(results[0]!.id);

    const goalDetail = await store.get('goal', results[0]!.id!);
    expect(goalDetail?.relations.incoming).toHaveLength(1);
    expect(goalDetail?.relations.incoming[0]?.kind).toBe('advances');
  });

  it('rejects relations with wrong endpoint kinds', async () => {
    const store = freshStore();
    const results = await store.apply([
      {
        op: 'relate',
        relationKind: 'answers',
        from: { kind: 'goal', id: 'g1' },
        to: { kind: 'research-question', id: 'q1' },
      },
    ]);
    expect(results[0]?.applied).toBe(false);
    expect(results[0]?.error?.code).toBe('relation-endpoint');
  });

  it('propose creates a Proposal entity, never direct writes', async () => {
    const store = freshStore();
    const results = await store.apply(
      [{ op: 'propose', description: 'Add a finances bucket', rationale: 'Money is a domain' }],
      { instructionId: 'ins-2' },
    );
    expect(results[0]?.applied).toBe(true);
    expect(results[0]?.kind).toBe('proposal');
    const proposals = await store.list('proposal');
    expect(proposals[0]?.status).toBe('proposed');
  });

  it('records a queryable provenance chain per instruction', async () => {
    const store = freshStore();
    await store.apply([{ op: 'create', kind: 'goal', data: goalData('Traced') }], {
      instructionId: 'ins-3',
      runId: 'run-abc',
      workflowName: 'interpret',
    });
    await store.apply(
      [{ op: 'create', kind: 'finding', data: { summary: 's', evidence: 'e', implications: 'i' } }],
      { instructionId: 'ins-3', runId: 'run-def', workflowName: 'research-to-goals' },
    );
    const log = await store.provenance('ins-3');
    expect(log).toHaveLength(2);
    expect(log.map((row) => row.workflow)).toEqual(['interpret', 'research-to-goals']);
    expect(log.every((row) => row.result.applied)).toBe(true);
  });

  it('serves per-kind snapshots and stats', async () => {
    const store = freshStore();
    await store.apply([
      { op: 'create', kind: 'goal', data: goalData('Snap goal') },
      {
        op: 'create',
        kind: 'research-question',
        data: { question: 'How?', status: 'open', goalIds: [] },
      },
    ]);
    const snapshot = await store.snapshot(['goal']);
    expect(Object.keys(snapshot)).toEqual(['goal']);
    expect(snapshot['goal']).toHaveLength(1);

    const stats = await store.stats();
    expect(stats.counts.find((c) => c.kind === 'goal')?.n).toBe(1);
    expect(stats.logCount).toBe(2);
  });
});
