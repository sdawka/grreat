import * as v from 'valibot';
import { baseEntityFields, OwnerSchema } from '../base.ts';

/** Every active project has a clear primary next action and an explicit owner. */
export const NextActionSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('next-action'),
  description: v.pipe(v.string(), v.minLength(1)),
  goalId: v.string(),
  roadmapItemId: v.optional(v.string()),
  owner: OwnerSchema,
  isPrimary: v.boolean(),
  status: v.picklist(['todo', 'doing', 'done', 'blocked']),
  blockedReason: v.optional(v.string()),
});
export type NextAction = v.InferOutput<typeof NextActionSchema>;

export const ExecutionLogSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('execution-log'),
  note: v.pipe(v.string(), v.minLength(1)),
  actionId: v.optional(v.string()),
  occurredAt: v.pipe(v.string(), v.isoTimestamp()),
});
export type ExecutionLog = v.InferOutput<typeof ExecutionLogSchema>;

export const WorkingSessionSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('working-session'),
  startedAt: v.pipe(v.string(), v.isoTimestamp()),
  endedAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
  focusGoalId: v.optional(v.string()),
  notes: v.optional(v.string()),
});
export type WorkingSession = v.InferOutput<typeof WorkingSessionSchema>;
