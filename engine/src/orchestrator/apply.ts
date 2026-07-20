import type { Provenance } from '../domain/index.ts';
import type { StorePort } from '../store/store-client.ts';
import type { EdgeOutput, EdgeResult } from '../workflows/lib/shared.ts';

/**
 * Apply an edge workflow's proposed mutations. The store re-validates
 * everything (registry, constraints, proposal-only) — a workflow's output is
 * a proposal to the store, not a privileged write.
 */
export async function applyEdgeOutput(
  store: StorePort,
  output: EdgeOutput,
  provenance: Provenance,
): Promise<EdgeResult> {
  let decisionRecordId: string | undefined;
  if (output.decision) {
    const [result] = await store.apply(
      [
        {
          op: 'create',
          kind: 'decision-record',
          data: {
            summary: output.decision.summary,
            rationale: output.decision.rationale,
            subjectRefs: [],
            ...(provenance.instructionId ? { instructionId: provenance.instructionId } : {}),
          },
        },
      ],
      provenance,
    );
    if (result?.applied) decisionRecordId = result.id;
  }

  if (output.proposedMutations.length === 0) {
    return { applied: 0, failed: 0, rationale: output.rationale };
  }

  const results = await store.apply(output.proposedMutations, {
    ...provenance,
    ...(decisionRecordId ? { decisionRecordId } : {}),
  });
  return {
    applied: results.filter((r) => r.applied).length,
    failed: results.filter((r) => !r.applied).length,
    rationale: output.rationale,
  };
}
