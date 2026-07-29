import { describe, expect, it } from 'vitest';
import { stubEdgeOutput } from '../../src/workflows/lib/stub-edges.ts';
import type { StorePort } from '../../src/store/store-client.ts';
import type { EdgeInput } from '../../src/workflows/lib/shared.ts';

const input = { reason: 'test', instructionText: 'consolidate', instructionId: 'i1' } as unknown as EdgeInput;

function storeOf(goals: Array<Record<string, unknown>>): StorePort {
  return {
    list: async (kind?: string) => (kind === 'goal' ? goals : []) as never,
    apply: async () => [],
    get: async () => null,
    listRelations: async () => [],
    snapshot: async () => ({}),
    stats: async () => ({ counts: [] }) as never,
  } as unknown as StorePort;
}

const goal = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: 'goal',
  mode: 'project',
  title: id,
  outcome: `${id} done`,
  status: 'active',
  owner: { type: 'human', name: 'x' },
  createdAt: '2026-07-10T00:00:00.000Z',
  ...over,
});

describe('goals-prioritize stub', () => {
  it('ranks active goals by createdAt ascending, ignoring parked', async () => {
    const out = await stubEdgeOutput(
      'goals-prioritize',
      input,
      storeOf([
        goal('bb', { createdAt: '2026-07-02T00:00:00.000Z' }),
        goal('a', { createdAt: '2026-07-01T00:00:00.000Z' }),
        goal('parked', { status: 'parked' }),
      ]),
    );
    const ranks = Object.fromEntries(
      out.proposedMutations.map((m) => [
        (m as { id: string }).id,
        (m as unknown as { patch: { rank: number } }).patch.rank,
      ]),
    );
    expect(ranks).toEqual({ a: 1, bb: 2 });
  });
});

describe('goals-consolidate stub', () => {
  it('drops duplicate-title active goals and links merged-into the earliest', async () => {
    const out = await stubEdgeOutput(
      'goals-consolidate',
      input,
      storeOf([
        goal('keep', { title: 'Get fit', createdAt: '2026-07-01T00:00:00.000Z' }),
        goal('dup', { title: 'get fit ', createdAt: '2026-07-05T00:00:00.000Z' }),
      ]),
    );
    const drop = out.proposedMutations.find((m) => m.op === 'update');
    const rel = out.proposedMutations.find((m) => m.op === 'relate');
    expect((drop as unknown as { patch: { status: string } }).patch.status).toBe('dropped');
    expect(
      rel as { relationKind: string; from: { id: string }; to: { id: string } },
    ).toMatchObject({ relationKind: 'merged-into', from: { id: 'dup' }, to: { id: 'keep' } });
    expect(out.decision).toBeDefined();
  });

  it('proposes nothing when there are no duplicate titles', async () => {
    const out = await stubEdgeOutput(
      'goals-consolidate',
      input,
      storeOf([goal('a', { title: 'A' }), goal('b', { title: 'B' })]),
    );
    expect(out.proposedMutations).toHaveLength(0);
  });
});
