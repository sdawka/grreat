import * as v from 'valibot';
import { baseEntityFields, RefSchema } from '../base.ts';

/** Review outcomes — the engine of the cycle; feeds back into Goals, Research, Roadmap. */
export const ReviewSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('review'),
  subjectRef: RefSchema,
  outcomeSummary: v.pipe(v.string(), v.minLength(1)),
  verdict: v.picklist(['achieved', 'partial', 'missed']),
  learnings: v.array(v.string()),
});
export type Review = v.InferOutput<typeof ReviewSchema>;
