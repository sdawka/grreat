import * as v from 'valibot';
import { MutationSchema } from '../../domain/mutations.ts';

/** Input every edge/intra workflow receives from the orchestrator. */
export const EdgeInputSchema = v.object({
  instructionId: v.string(),
  instructionText: v.string(),
  /** Why the interpreter fired this workflow. */
  reason: v.string(),
});
export type EdgeInput = v.InferOutput<typeof EdgeInputSchema>;

/** What every edge/intra workflow's model must produce. */
export const EdgeOutputSchema = v.object({
  proposedMutations: v.array(MutationSchema),
  rationale: v.string(),
  decision: v.optional(v.object({ summary: v.string(), rationale: v.string() })),
});
export type EdgeOutput = v.InferOutput<typeof EdgeOutputSchema>;

/** Workflow run result recorded back onto the instruction. */
export const EdgeResultSchema = v.object({
  applied: v.number(),
  failed: v.number(),
  rationale: v.string(),
  /** Store-rejection reasons for the `failed` mutations, for run inspection. */
  errors: v.optional(v.array(v.string()), []),
});
export type EdgeResult = v.InferOutput<typeof EdgeResultSchema>;
