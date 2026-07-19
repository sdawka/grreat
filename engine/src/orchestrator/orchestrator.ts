import type { Mutation, MutationResult, Provenance } from '../domain/index.ts';
import type { StorePort } from '../store/store-client.ts';
import type { Intent } from './intent.ts';

export interface DispatchedRun {
  workflow: string;
  runId: string;
}

/** Fires one catalog workflow; resolves null when it is not (yet) registered. */
export type WorkflowInvoker = (
  workflowId: string,
  input: { instructionId: string; instructionText: string; reason: string },
) => Promise<{ runId: string } | null>;

export interface ApplyIntentContext {
  instructionId: string;
  instructionText: string;
  runId?: string;
}

/**
 * Prepare an intent for archiving onto the Instruction record: replace
 * "$ref:N" placeholders with the entity ids the store actually minted for
 * that batch position. Archived intents then carry real, linkable ids — and
 * never trip the store's live $ref resolution when the archive is written.
 */
export function resolveIntentForArchive(intent: Intent, applyResults: MutationResult[]): Intent {
  const resolve = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const match = value.match(/^\$ref:(\d+)$/);
      if (match) return applyResults[Number(match[1])]?.id ?? `unresolved-ref-${match[1]}`;
      return value;
    }
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, resolve(v)]),
      );
    }
    return value;
  };
  return resolve(intent) as Intent;
}

export interface ApplyIntentResult {
  dispatched: DispatchedRun[];
  skipped: string[];
  applyResults: MutationResult[];
  decisionRecordId?: string;
}

/**
 * The orchestrator: deterministic code that turns an Intent into store writes
 * and workflow invocations. The model's authority ends at the Intent.
 */
export async function applyIntent(
  store: StorePort,
  intent: Intent,
  ctx: ApplyIntentContext,
  invoke: WorkflowInvoker,
): Promise<ApplyIntentResult> {
  const provenance: Provenance = {
    instructionId: ctx.instructionId,
    workflowName: 'interpret',
    ...(ctx.runId ? { runId: ctx.runId } : {}),
  };

  let decisionRecordId: string | undefined;
  if (intent.decision) {
    const [result] = await store.apply(
      [
        {
          op: 'create',
          kind: 'decision-record',
          data: {
            summary: intent.decision.summary,
            rationale: intent.decision.rationale,
            subjectRefs: [],
            instructionId: ctx.instructionId,
          },
        },
      ],
      provenance,
    );
    if (result?.applied) decisionRecordId = result.id;
  }

  let applyResults: MutationResult[] = [];
  const directMutations: Mutation[] = intent.directMutations ?? [];
  if (directMutations.length > 0) {
    applyResults = await store.apply(directMutations, {
      ...provenance,
      ...(decisionRecordId ? { decisionRecordId } : {}),
    });
  }

  const dispatched: DispatchedRun[] = [];
  const skipped: string[] = [];
  const triggers = [
    ...intent.edgeTriggers.map((t) => ({ id: t.edge, reason: t.reason })),
    ...intent.intraTriggers.map((t) => ({ id: t.workflow, reason: t.reason })),
  ];
  for (const trigger of triggers) {
    const receipt = await invoke(trigger.id, {
      instructionId: ctx.instructionId,
      instructionText: ctx.instructionText,
      reason: trigger.reason,
    });
    if (receipt) dispatched.push({ workflow: trigger.id, runId: receipt.runId });
    else skipped.push(trigger.id);
  }

  return { dispatched, skipped, applyResults, ...(decisionRecordId ? { decisionRecordId } : {}) };
}
