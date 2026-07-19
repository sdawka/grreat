import * as v from 'valibot';
import { baseEntityFields, RefSchema } from '../base.ts';

export const EstimateSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('estimate'),
  subjectRef: RefSchema,
  expectedMinutes: v.pipe(v.number(), v.minValue(0)),
});
export type Estimate = v.InferOutput<typeof EstimateSchema>;

export const TimeEntrySchema = v.object({
  ...baseEntityFields,
  kind: v.literal('time-entry'),
  subjectRef: RefSchema,
  actualMinutes: v.pipe(v.number(), v.minValue(0)),
  date: v.pipe(v.string(), v.isoDate()),
});
export type TimeEntry = v.InferOutput<typeof TimeEntrySchema>;
