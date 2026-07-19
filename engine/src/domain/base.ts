import * as v from 'valibot';

/** ISO-8601 timestamp string. */
export const IsoTimestamp = v.pipe(v.string(), v.isoTimestamp());

/** Every project and next action has a named owner — human or AI agent. */
export const OwnerSchema = v.object({
  type: v.picklist(['human', 'ai']),
  name: v.pipe(v.string(), v.minLength(1)),
});
export type Owner = v.InferOutput<typeof OwnerSchema>;

/** Typed pointer to another entity. */
export const RefSchema = v.object({
  kind: v.pipe(v.string(), v.minLength(1)),
  id: v.pipe(v.string(), v.minLength(1)),
});
export type Ref = v.InferOutput<typeof RefSchema>;

/** Where a write came from: the instruction, run, and workflow that caused it. */
export const ProvenanceSchema = v.partial(
  v.object({
    instructionId: v.string(),
    runId: v.string(),
    workflowName: v.string(),
    decisionRecordId: v.string(),
  }),
);
export type Provenance = v.InferOutput<typeof ProvenanceSchema>;

/**
 * Base fields shared by every entity. Spread into each kind's schema:
 * `v.object({ ...baseEntityFields, kind: v.literal('goal'), ... })`.
 *
 * The store — never the model — stamps id, workspaceId, timestamps, and
 * provenance. Mutation `data` payloads carry only domain fields.
 */
export const baseEntityFields = {
  id: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  createdAt: IsoTimestamp,
  updatedAt: IsoTimestamp,
  provenance: v.optional(ProvenanceSchema),
};

export const BaseEntitySchema = v.object({
  ...baseEntityFields,
  kind: v.pipe(v.string(), v.minLength(1)),
});
export type BaseEntity = v.InferOutput<typeof BaseEntitySchema>;
