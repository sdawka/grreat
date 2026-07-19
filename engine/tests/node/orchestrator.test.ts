import { describe, expect, it } from 'vitest';
import { applyIntent } from '../../src/orchestrator/orchestrator.ts';
import { fakeInterpret } from '../../src/orchestrator/fake-intent.ts';
import * as v from 'valibot';
import { IntentSchema } from '../../src/orchestrator/intent.ts';
import type { StorePort } from '../../src/store/store-client.ts';
import type { Mutation, Provenance } from '../../src/domain/index.ts';

function fakeStore() {
  const batches: { mutations: Mutation[]; provenance?: Provenance }[] = [];
  let nextId = 0;
  const store: StorePort = {
    async apply(mutations, provenance) {
      batches.push({ mutations, ...(provenance ? { provenance } : {}) });
      return mutations.map((m) => ({
        applied: true,
        op: m.op,
        id: `id-${(nextId += 1)}`,
        kind: 'kind' in m ? (m as { kind: string }).kind : undefined,
      }));
    },
    async list() {
      return [];
    },
    async get() {
      return null;
    },
    async listRelations() {
      return [];
    },
    async snapshot() {
      return {};
    },
    async provenance() {
      return [];
    },
    async stats() {
      return { counts: [], relationCount: 0, logCount: 0 };
    },
  };
  return { store, batches };
}

describe('applyIntent (the orchestrator)', () => {
  it('applies direct mutations with interpret provenance and dispatches triggers', async () => {
    const { store, batches } = fakeStore();
    const invoked: string[] = [];
    const result = await applyIntent(
      store,
      {
        classification: 'instruction',
        buckets: ['goals'],
        directMutations: [{ op: 'create', kind: 'goal', data: {} }],
        edgeTriggers: [{ edge: 'analysis-to-goals', reason: 'review done' }],
        intraTriggers: [{ workflow: 'execution-plan-next', reason: 'new goal' }],
      },
      { instructionId: 'ins-1', instructionText: 'text', runId: 'run-1' },
      async (id) => {
        invoked.push(id);
        return { runId: `run-for-${id}` };
      },
    );
    expect(invoked).toEqual(['analysis-to-goals', 'execution-plan-next']);
    expect(result.dispatched).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(batches[0]?.provenance).toMatchObject({
      instructionId: 'ins-1',
      workflowName: 'interpret',
      runId: 'run-1',
    });
  });

  it('records a decision first and threads its id into mutation provenance', async () => {
    const { store, batches } = fakeStore();
    const result = await applyIntent(
      store,
      {
        classification: 'instruction',
        buckets: ['goals'],
        directMutations: [{ op: 'update', kind: 'goal', id: 'g1', patch: { status: 'parked' } }],
        edgeTriggers: [],
        intraTriggers: [],
        decision: { summary: 'Park goal', rationale: 'Chronic overrun' },
      },
      { instructionId: 'ins-2', instructionText: 'park it' },
      async () => null,
    );
    expect(result.decisionRecordId).toBe('id-1');
    expect(batches[0]?.mutations[0]).toMatchObject({ op: 'create', kind: 'decision-record' });
    expect(batches[1]?.provenance?.decisionRecordId).toBe('id-1');
  });

  it('reports unregistered workflows as skipped instead of failing', async () => {
    const { store } = fakeStore();
    const result = await applyIntent(
      store,
      {
        classification: 'instruction',
        buckets: [],
        edgeTriggers: [{ edge: 'time-to-goals', reason: 'overrun' }],
        intraTriggers: [],
      },
      { instructionId: 'ins-3', instructionText: 'text' },
      async () => null,
    );
    expect(result.dispatched).toHaveLength(0);
    expect(result.skipped).toEqual(['time-to-goals']);
  });
});

describe('fakeInterpret (stub-mode interpreter)', () => {
  it('turns "add a goal:" into a direct goal creation + plan-next trigger', () => {
    const intent = fakeInterpret('Add a goal: run a marathon in 2027');
    expect(v.safeParse(IntentSchema, intent).success).toBe(true);
    expect(intent.directMutations?.[0]).toMatchObject({ op: 'create', kind: 'goal' });
    expect(intent.intraTriggers[0]?.workflow).toBe('execution-plan-next');
  });

  it('routes structural asks to a proposal', () => {
    const intent = fakeInterpret('please add a bucket for finances');
    expect(intent.directMutations?.[0]?.op).toBe('propose');
    expect(intent.decision).toBeTruthy();
  });

  it('routes blockers to execution-to-research', () => {
    const intent = fakeInterpret('I am blocked on the API design');
    expect(intent.edgeTriggers[0]?.edge).toBe('execution-to-research');
  });

  it('answers questions without mutating', () => {
    const intent = fakeInterpret('what should I do next?');
    expect(intent.classification).toBe('question');
    expect(intent.answer).toBeTruthy();
    expect(intent.directMutations).toBeUndefined();
  });

  it('every fake intent validates against the Intent schema', () => {
    for (const text of [
      'add a goal: write a book',
      'change the wip limit to 10',
      'blocked again',
      'finished the draft chapter',
      'it took 3 hours',
      'how are things going?',
    ]) {
      expect(v.safeParse(IntentSchema, fakeInterpret(text)).success).toBe(true);
    }
  });
});
