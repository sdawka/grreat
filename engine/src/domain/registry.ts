import * as v from 'valibot';
import type { BaseEntity } from './base.ts';
import { GoalSchema } from './entities/goals.ts';
import { FindingSchema, ResearchQuestionSchema } from './entities/research.ts';
import { MilestoneSchema, RoadmapItemSchema, SprintSchema } from './entities/roadmap.ts';
import { ExecutionLogSchema, NextActionSchema, WorkingSessionSchema } from './entities/execution.ts';
import { ReviewSchema } from './entities/analysis.ts';
import { EstimateSchema, TimeEntrySchema } from './entities/time.ts';
import { DecisionRecordSchema, InstructionSchema, ProposalSchema } from './entities/meta.ts';

export type EntitySchema = v.GenericSchema<unknown, BaseEntity & Record<string, unknown>>;

export class DuplicateKindError extends Error {
  constructor(kind: string) {
    super(`Entity kind already registered: ${kind}`);
  }
}

export class UnknownKindError extends Error {
  constructor(kind: string) {
    super(`Unknown entity kind: ${kind}`);
  }
}

/**
 * Validates entities by kind at write time. The extensibility seam: a new
 * entity kind is one schema file plus one register() call.
 */
export class EntityRegistry {
  #schemas = new Map<string, EntitySchema>();

  register(kind: string, schema: EntitySchema): this {
    if (this.#schemas.has(kind)) throw new DuplicateKindError(kind);
    this.#schemas.set(kind, schema);
    return this;
  }

  has(kind: string): boolean {
    return this.#schemas.has(kind);
  }

  kinds(): string[] {
    return [...this.#schemas.keys()];
  }

  schema(kind: string): EntitySchema {
    const schema = this.#schemas.get(kind);
    if (!schema) throw new UnknownKindError(kind);
    return schema;
  }

  /** Parse and return a validated entity, or throw ValiError/UnknownKindError. */
  parse(kind: string, value: unknown): BaseEntity & Record<string, unknown> {
    return v.parse(this.schema(kind), value);
  }

  safeParse(kind: string, value: unknown) {
    return v.safeParse(this.schema(kind), value);
  }
}

export function createDefaultRegistry(): EntityRegistry {
  return new EntityRegistry()
    .register('goal', GoalSchema as EntitySchema)
    .register('research-question', ResearchQuestionSchema as EntitySchema)
    .register('finding', FindingSchema as EntitySchema)
    .register('roadmap-item', RoadmapItemSchema as EntitySchema)
    .register('milestone', MilestoneSchema as EntitySchema)
    .register('sprint', SprintSchema as EntitySchema)
    .register('next-action', NextActionSchema as EntitySchema)
    .register('execution-log', ExecutionLogSchema as EntitySchema)
    .register('working-session', WorkingSessionSchema as EntitySchema)
    .register('review', ReviewSchema as EntitySchema)
    .register('estimate', EstimateSchema as EntitySchema)
    .register('time-entry', TimeEntrySchema as EntitySchema)
    .register('instruction', InstructionSchema as EntitySchema)
    .register('decision-record', DecisionRecordSchema as EntitySchema)
    .register('proposal', ProposalSchema as EntitySchema);
}
