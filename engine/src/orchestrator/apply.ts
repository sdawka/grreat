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
  // Reasons for every store rejection this edge caused — proposed mutations AND
  // a rejected decision-record — so nothing the edge tried is silently dropped.
  const errors: string[] = [];
  const reasonOf = (r: { error?: { code: string; message: string } }): string =>
    r.error?.message || r.error?.code || 'unknown error';

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
    else errors.push(`decision-record: ${reasonOf(result ?? {})}`);
  }

  if (output.proposedMutations.length === 0) {
    return { applied: 0, failed: 0, rationale: output.rationale, errors };
  }

  const results = await store.apply(output.proposedMutations, {
    ...provenance,
    ...(decisionRecordId ? { decisionRecordId } : {}),
  });
  const rejected = results.filter((r) => !r.applied);
  return {
    applied: results.length - rejected.length,
    failed: rejected.length,
    rationale: output.rationale,
    errors: [...errors, ...rejected.map(reasonOf)],
  };
}
