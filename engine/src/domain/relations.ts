import * as v from 'valibot';
import { IsoTimestamp, ProvenanceSchema, RefSchema } from './base.ts';

/**
 * First-class typed edges between entities, instead of scattered foreign keys.
 * New relation kinds are additive: one register() call.
 */
export const RelationSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
  workspaceId: v.pipe(v.string(), v.minLength(1)),
  kind: v.pipe(v.string(), v.minLength(1)),
  from: RefSchema,
  to: RefSchema,
  createdAt: IsoTimestamp,
  provenance: v.optional(ProvenanceSchema),
});
export type Relation = v.InferOutput<typeof RelationSchema>;

export interface RelationEndpoints {
  /** Allowed `from` entity kinds, or '*' for any. */
  from: readonly string[] | '*';
  /** Allowed `to` entity kinds, or '*' for any. */
  to: readonly string[] | '*';
}

export class UnknownRelationKindError extends Error {
  constructor(kind: string) {
    super(`Unknown relation kind: ${kind}`);
  }
}

export class RelationEndpointError extends Error {
  constructor(kind: string, end: 'from' | 'to', got: string) {
    super(`Relation "${kind}" does not allow ${end} kind "${got}"`);
  }
}

export class RelationKindRegistry {
  #kinds = new Map<string, RelationEndpoints>();

  register(kind: string, endpoints: RelationEndpoints): this {
    if (this.#kinds.has(kind)) throw new Error(`Relation kind already registered: ${kind}`);
    this.#kinds.set(kind, endpoints);
    return this;
  }

  has(kind: string): boolean {
    return this.#kinds.has(kind);
  }

  kinds(): string[] {
    return [...this.#kinds.keys()];
  }

  endpoints(kind: string): RelationEndpoints {
    const endpoints = this.#kinds.get(kind);
    if (!endpoints) throw new UnknownRelationKindError(kind);
    return endpoints;
  }

  /** Validate that a relation's endpoint kinds are allowed for its kind. */
  validate(relation: Pick<Relation, 'kind' | 'from' | 'to'>): void {
    const endpoints = this.endpoints(relation.kind);
    if (endpoints.from !== '*' && !endpoints.from.includes(relation.from.kind)) {
      throw new RelationEndpointError(relation.kind, 'from', relation.from.kind);
    }
    if (endpoints.to !== '*' && !endpoints.to.includes(relation.to.kind)) {
      throw new RelationEndpointError(relation.kind, 'to', relation.to.kind);
    }
  }
}

export function createDefaultRelationRegistry(): RelationKindRegistry {
  return new RelationKindRegistry()
    .register('answers', { from: ['finding'], to: ['research-question'] })
    .register('advances', { from: ['next-action', 'roadmap-item'], to: ['goal'] })
    .register('informs', { from: ['finding'], to: ['goal', 'roadmap-item', 'next-action'] })
    .register('estimates', { from: ['estimate'], to: ['roadmap-item', 'next-action', 'goal'] })
    .register('parked-by', { from: ['goal'], to: ['decision-record'] })
    .register('reviews', { from: ['review'], to: ['goal', 'sprint', 'milestone'] })
    .register('derived-from', { from: '*', to: ['instruction'] });
}
