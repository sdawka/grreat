import * as v from 'valibot';
import { baseEntityFields } from '../base.ts';

export const ResearchQuestionSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('research-question'),
  question: v.pipe(v.string(), v.minLength(1)),
  status: v.picklist(['open', 'answered', 'dropped']),
  // Defaults to [] — a question can be noted before it is linked to a goal,
  // and weaker models routinely omit optional-but-required array fields.
  goalIds: v.optional(v.array(v.string()), []),
});
export type ResearchQuestion = v.InferOutput<typeof ResearchQuestionSchema>;

export const FindingSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('finding'),
  summary: v.pipe(v.string(), v.minLength(1)),
  evidence: v.string(),
  implications: v.string(),
  questionId: v.optional(v.string()),
});
export type Finding = v.InferOutput<typeof FindingSchema>;
