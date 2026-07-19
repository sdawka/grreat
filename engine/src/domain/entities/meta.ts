import * as v from 'valibot';
import { baseEntityFields, RefSchema } from '../base.ts';

/**
 * The inbound chunk of user text — root of every provenance chain.
 * `intent` and `runIds` are filled in as interpretation and dispatch proceed.
 */
export const InstructionSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('instruction'),
  text: v.pipe(v.string(), v.minLength(1)),
  source: v.picklist(['api', 'admin']),
  status: v.picklist(['received', 'interpreting', 'dispatched', 'completed', 'failed']),
  intent: v.optional(v.record(v.string(), v.unknown())),
  answer: v.optional(v.string()),
  runIds: v.array(v.string()),
  error: v.optional(v.string()),
});
export type Instruction = v.InferOutput<typeof InstructionSchema>;

/** A recorded judgement: what was decided, why, and about what. */
export const DecisionRecordSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('decision-record'),
  summary: v.pipe(v.string(), v.minLength(1)),
  rationale: v.pipe(v.string(), v.minLength(1)),
  subjectRefs: v.array(RefSchema),
  instructionId: v.optional(v.string()),
});
export type DecisionRecord = v.InferOutput<typeof DecisionRecordSchema>;

/**
 * Structural changes (buckets, constraints, feedback rules) are proposal-only:
 * written down and reviewed, never applied ad-lib.
 */
export const ProposalSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('proposal'),
  category: v.literal('structural-change'),
  description: v.pipe(v.string(), v.minLength(1)),
  rationale: v.pipe(v.string(), v.minLength(1)),
  status: v.picklist(['proposed', 'approved', 'rejected']),
  reviewNote: v.optional(v.string()),
});
export type Proposal = v.InferOutput<typeof ProposalSchema>;
