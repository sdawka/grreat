import * as v from 'valibot';
import { baseEntityFields } from '../base.ts';

export const RoadmapItemSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('roadmap-item'),
  title: v.pipe(v.string(), v.minLength(1)),
  goalId: v.string(),
  order: v.number(),
  status: v.picklist(['planned', 'active', 'done', 'cut']),
  milestoneId: v.optional(v.string()),
  sprintId: v.optional(v.string()),
});
export type RoadmapItem = v.InferOutput<typeof RoadmapItemSchema>;

export const MilestoneSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('milestone'),
  title: v.pipe(v.string(), v.minLength(1)),
  targetDate: v.optional(v.pipe(v.string(), v.isoDate())),
});
export type Milestone = v.InferOutput<typeof MilestoneSchema>;

/** Scope is immutable mid-sprint: the roadmap adjusts, never the running sprint. */
export const SprintSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('sprint'),
  startDate: v.pipe(v.string(), v.isoDate()),
  endDate: v.pipe(v.string(), v.isoDate()),
  status: v.picklist(['planned', 'active', 'done']),
});
export type Sprint = v.InferOutput<typeof SprintSchema>;
