import { describe, expect, it } from 'vitest';
import { applyEdgeOutput } from '../../src/orchestrator/apply.ts';
import type { StorePort } from '../../src/store/store-client.ts';
import type { MutationResult, Mutation, Provenance } from '../../src/domain/index.ts';

/** Store stub whose apply() returns caller-supplied results (per position). */
function storeReturning(results: MutationResult[]) {
  const store: StorePort = {
    async apply(mutations: Mutation[]) {
      // decision-record create (if any) is the first call; hand it a success.
      const first = mutations[0];
      if (mutations.length === 1 && first && 'kind' in first && first.kind === 'decision-record') {
        return [{ applied: true, op: 'create', id: 'dec-1', kind: 'decision-record' }];
      }
      return results;
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
  return store;
}

const provenance: Provenance = { instructionId: 'ins-1', workflowName: 'execution-to-research' };

describe('applyEdgeOutput', () => {
  it('reports zero applied/failed with an empty errors list when nothing is proposed', async () => {
    const result = await applyEdgeOutput(
      storeReturning([]),
      { proposedMutations: [], rationale: 'no change warranted' },
      provenance,
    );
    expect(result).toEqual({ applied: 0, failed: 0, rationale: 'no change warranted', errors: [] });
  });

  it('counts applied mutations and returns no errors when every write succeeds', async () => {
    const result = await applyEdgeOutput(
      storeReturning([
        { applied: true, op: 'create', id: 'q1', kind: 'research-question' },
        { applied: true, op: 'create', id: 'q2', kind: 'research-question' },
      ]),
      {
        proposedMutations: [
          { op: 'create', kind: 'research-question', data: {} },
          { op: 'create', kind: 'research-question', data: {} },
        ],
        rationale: 'surfaced blockers',
      },
      provenance,
    );
    expect(result.applied).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toEqual([]);
  });

  it('surfaces store-rejection reasons instead of only counting failures', async () => {
    const result = await applyEdgeOutput(
      storeReturning([
        { applied: true, op: 'create', id: 'q1', kind: 'research-question' },
        { applied: false, op: 'create', kind: 'goal', error: { code: 'wip-limit', message: 'WIP limit reached' } },
      ]),
      {
        proposedMutations: [
          { op: 'create', kind: 'research-question', data: {} },
          { op: 'create', kind: 'goal', data: {} },
        ],
        rationale: 'mixed',
      },
      provenance,
    );
    expect(result.applied).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual(['WIP limit reached']);
  });

  it('surfaces a rejected decision-record instead of dropping it silently', async () => {
    // Store that rejects the decision-record create but applies the proposal.
    const store: StorePort = {
      async apply(mutations: Mutation[]) {
        const first = mutations[0];
        if (first && 'kind' in first && first.kind === 'decision-record') {
          return [{ applied: false, op: 'create', kind: 'decision-record', error: { code: 'validation', message: 'summary too short' } }];
        }
        return [{ applied: true, op: 'create', id: 'q1', kind: 'research-question' }];
      },
      async list() { return []; },
      async get() { return null; },
      async listRelations() { return []; },
      async snapshot() { return {}; },
      async provenance() { return []; },
      async stats() { return { counts: [], relationCount: 0, logCount: 0 }; },
    };
    const result = await applyEdgeOutput(
      store,
      {
        proposedMutations: [{ op: 'create', kind: 'research-question', data: {} }],
        rationale: 'x',
        decision: { summary: 'bad', rationale: 'because' },
      },
      provenance,
    );
    expect(result.applied).toBe(1);
    expect(result.failed).toBe(0); // failed counts proposed mutations only
    expect(result.errors).toContain('decision-record: summary too short');
  });

  it('falls back to the error code when a rejection has no message', async () => {
    const result = await applyEdgeOutput(
      storeReturning([
        { applied: false, op: 'update', kind: 'goal', error: { code: 'not-found', message: '' } },
      ]),
      { proposedMutations: [{ op: 'update', kind: 'goal', id: 'g9', patch: {} }], rationale: 'x' },
      provenance,
    );
    expect(result.errors).toEqual(['not-found']);
  });
});
