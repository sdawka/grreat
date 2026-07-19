import * as v from 'valibot';

/** The six GRREAT buckets — the fixed axis of the whole system. */
export const BucketIdSchema = v.picklist([
  'goals',
  'research',
  'roadmap',
  'execution',
  'analysis',
  'time',
]);
export type BucketId = v.InferOutput<typeof BucketIdSchema>;

export const BUCKETS: readonly BucketId[] = BucketIdSchema.options;

/** Which entity kinds live in which bucket (meta kinds sit outside buckets). */
export const BUCKET_KINDS: Record<BucketId, readonly string[]> = {
  goals: ['goal'],
  research: ['research-question', 'finding'],
  roadmap: ['roadmap-item', 'milestone', 'sprint'],
  execution: ['next-action', 'execution-log', 'working-session'],
  analysis: ['review'],
  time: ['estimate', 'time-entry'],
};

export const META_KINDS = ['instruction', 'decision-record', 'proposal'] as const;
