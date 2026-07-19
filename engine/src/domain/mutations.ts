import * as v from 'valibot';
import { RefSchema } from './base.ts';

/**
 * The only vocabulary of change. Workflows and the interpreter emit these;
 * the store validates and applies them transactionally.
 *
 * `propose` is the sole channel for structural change — it creates a Proposal
 * entity for review and never writes domain state directly.
 */
export const MutationSchema = v.variant('op', [
  v.object({
    op: v.literal('create'),
    kind: v.pipe(v.string(), v.minLength(1)),
    /** Domain fields only; the store stamps id/workspaceId/timestamps/provenance. */
    data: v.record(v.string(), v.unknown()),
  }),
  v.object({
    op: v.literal('update'),
    kind: v.pipe(v.string(), v.minLength(1)),
    id: v.pipe(v.string(), v.minLength(1)),
    /** Merged over existing data; id/kind/workspaceId/createdAt are immutable. */
    patch: v.record(v.string(), v.unknown()),
  }),
  v.object({
    op: v.literal('relate'),
    relationKind: v.pipe(v.string(), v.minLength(1)),
    from: RefSchema,
    to: RefSchema,
  }),
  v.object({
    op: v.literal('unrelate'),
    relationId: v.pipe(v.string(), v.minLength(1)),
  }),
  v.object({
    op: v.literal('propose'),
    description: v.pipe(v.string(), v.minLength(1)),
    rationale: v.pipe(v.string(), v.minLength(1)),
  }),
]);
export type Mutation = v.InferOutput<typeof MutationSchema>;

export type MutationErrorCode =
  | 'validation'
  | 'unknown-kind'
  | 'unknown-relation-kind'
  | 'relation-endpoint'
  | 'not-found'
  | 'wip-limit'
  | 'no-owner'
  | 'immutable-field';

export interface MutationResult {
  applied: boolean;
  op: Mutation['op'];
  /** Entity or relation id produced/affected, when applicable. */
  id?: string;
  kind?: string;
  error?: { code: MutationErrorCode; message: string };
}

export const MutationBatchSchema = v.object({
  mutations: v.array(MutationSchema),
});
