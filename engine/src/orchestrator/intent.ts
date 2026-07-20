import * as v from 'valibot';
import { BucketIdSchema } from '../domain/buckets.ts';
import { MutationSchema } from '../domain/mutations.ts';
import { EDGE_IDS, INTRA_IDS } from './catalog.ts';

export const EdgeIdSchema = v.picklist(EDGE_IDS);
export const IntraIdSchema = v.picklist(INTRA_IDS);

/**
 * The interpreter's entire authority: it emits this structured intent and
 * nothing else. Fan-out, mutation application, and provenance are
 * deterministic code downstream.
 */
export const IntentSchema = v.object({
  classification: v.picklist(['question', 'instruction', 'mixed']),
  buckets: v.array(BucketIdSchema),
  /** For questions: a plain-text answer grounded in the state snapshot. */
  answer: v.optional(v.string()),
  /** Simple, confident factual changes applied directly with provenance. */
  directMutations: v.optional(v.array(MutationSchema)),
  /** Feedback-loop workflows to fire, each with the reason. */
  edgeTriggers: v.array(v.object({ edge: EdgeIdSchema, reason: v.string() })),
  intraTriggers: v.array(v.object({ workflow: IntraIdSchema, reason: v.string() })),
  /** When a judgement was made, record it. */
  decision: v.optional(v.object({ summary: v.string(), rationale: v.string() })),
});
export type Intent = v.InferOutput<typeof IntentSchema>;
