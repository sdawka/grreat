import * as v from 'valibot';
import { baseEntityFields, OwnerSchema } from '../base.ts';

/**
 * A goal runs as a project (driven to completion) or a program (steered for
 * consistent improvement on a metric) — both with revisable desired outcomes.
 * Parking a goal requires a decision record ("no orphaned projects").
 */
export const GoalSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('goal'),
  mode: v.picklist(['project', 'program']),
  title: v.pipe(v.string(), v.minLength(1)),
  outcome: v.pipe(v.string(), v.minLength(1)),
  metric: v.optional(v.string()),
  status: v.picklist(['active', 'parked', 'done', 'dropped']),
  owner: OwnerSchema,
  parkedDecisionId: v.optional(v.string()),
});
export type Goal = v.InferOutput<typeof GoalSchema>;
