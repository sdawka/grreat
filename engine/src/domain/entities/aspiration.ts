import * as v from 'valibot';
import { baseEntityFields } from '../base.ts';

/**
 * An aspiration is a dream-level theme (DUMB, not SMART): the loose cluster
 * that goals *serve*. It carries no owner and no metric — the goals under it
 * hold ownership and checkable outcomes. Consolidation groups goals under
 * aspirations; refinement sharpens the goals, never the aspiration.
 */
export const AspirationSchema = v.object({
  ...baseEntityFields,
  kind: v.literal('aspiration'),
  title: v.pipe(v.string(), v.minLength(1)),
  dream: v.pipe(v.string(), v.minLength(1)),
  status: v.picklist(['open', 'realized', 'abandoned']),
});
export type Aspiration = v.InferOutput<typeof AspirationSchema>;
