import { DurableObject } from 'cloudflare:workers';
import { ulid } from 'ulid';
import * as v from 'valibot';
import { SCHEMA_SQL } from './schema.sql.ts';
import {
  checkOwnership,
  checkWipLimit,
  createDefaultRegistry,
  createDefaultRelationRegistry,
  MutationSchema,
  ProvenanceSchema,
  RelationEndpointError,
  UnknownKindError,
  UnknownRelationKindError,
  type Mutation,
  type MutationResult,
  type Provenance,
  type Relation,
} from '../domain/index.ts';

const ApplyRequestSchema = v.object({
  mutations: v.array(MutationSchema),
  provenance: v.optional(ProvenanceSchema),
  workspaceId: v.optional(v.string()),
});

const REF_PATTERN = /^\$ref:(\d+)$/;
const SNAPSHOT_CAP_PER_KIND = 50;

interface EntityRow extends Record<string, string | number | ArrayBuffer | null> {
  id: string;
  kind: string;
  workspace_id: string;
  data: string;
  created_at: string;
  updated_at: string;
}

interface RelationRow extends Record<string, string | number | ArrayBuffer | null> {
  id: string;
  kind: string;
  workspace_id: string;
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  created_at: string;
  data: string;
}

/**
 * One Durable Object per workspace. The single write path is
 * POST /mutations/apply — every change is registry-validated,
 * constraint-checked, and logged with provenance.
 */
export class WorkspaceStore extends DurableObject<unknown> {
  #registry = createDefaultRegistry();
  #relations = createDefaultRelationRegistry();

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(SCHEMA_SQL);
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (request.method === 'POST' && path === '/mutations/apply') {
        return await this.#handleApply(request);
      }
      if (request.method === 'GET' && path === '/entities') {
        return this.#handleListEntities(url);
      }
      const entityMatch = path.match(/^\/entities\/([^/]+)\/([^/]+)$/);
      if (request.method === 'GET' && entityMatch) {
        return this.#handleGetEntity(entityMatch[1]!, entityMatch[2]!);
      }
      if (request.method === 'GET' && path === '/relations') {
        return this.#handleListRelations(url);
      }
      if (request.method === 'GET' && path === '/snapshot') {
        return this.#handleSnapshot(url);
      }
      const provMatch = path.match(/^\/provenance\/([^/]+)$/);
      if (request.method === 'GET' && provMatch) {
        return this.#handleProvenance(provMatch[1]!);
      }
      if (request.method === 'GET' && path === '/stats') {
        return this.#handleStats();
      }
      return Response.json({ error: 'not found' }, { status: 404 });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : String(error) },
        { status: 500 },
      );
    }
  }

  // ── writes ────────────────────────────────────────────────────────────

  async #handleApply(request: Request): Promise<Response> {
    const parsed = v.safeParse(ApplyRequestSchema, await request.json());
    if (!parsed.success) {
      return Response.json(
        { error: 'invalid apply request', issues: parsed.issues.map((i) => i.message) },
        { status: 400 },
      );
    }
    const { mutations, provenance, workspaceId = 'default' } = parsed.output;
    const results = this.#apply(mutations, provenance, workspaceId);
    const status = results.some((r) => !r.applied) ? 207 : 200;
    return Response.json({ results }, { status });
  }

  #apply(
    mutations: Mutation[],
    provenance: Provenance | undefined,
    workspaceId: string,
  ): MutationResult[] {
    const now = new Date().toISOString();

    // Batch-level WIP check: a violation rejects the whole batch so the
    // caller can propose parking instead.
    const activeGoalIds = this.ctx.storage.sql
      .exec<EntityRow>(
        `SELECT id, kind, workspace_id, data, created_at, updated_at FROM entities WHERE workspace_id = ? AND kind = 'goal'`,
        workspaceId,
      )
      .toArray()
      .filter((row) => (JSON.parse(row.data) as { status?: string }).status === 'active')
      .map((row) => row.id);
    const wip = checkWipLimit(mutations, activeGoalIds);
    if (wip) {
      const results = mutations.map<MutationResult>((m) => ({
        applied: false,
        op: m.op,
        error: { code: 'wip-limit', message: wip.message },
      }));
      this.#logBatch(mutations, results, provenance, workspaceId, now);
      return results;
    }

    const createdIds: (string | null)[] = mutations.map(() => null);
    const results: MutationResult[] = [];

    this.ctx.storage.transactionSync(() => {
      mutations.forEach((mutation, index) => {
        results.push(this.#applyOne(mutation, index, createdIds, provenance, workspaceId, now));
      });
    });

    this.#logBatch(mutations, results, provenance, workspaceId, now);
    return results;
  }

  #applyOne(
    mutation: Mutation,
    index: number,
    createdIds: (string | null)[],
    provenance: Provenance | undefined,
    workspaceId: string,
    now: string,
  ): MutationResult {
    try {
      switch (mutation.op) {
        case 'create': {
          const ownership = checkOwnership(mutation);
          if (ownership) {
            return {
              applied: false,
              op: 'create',
              kind: mutation.kind,
              error: { code: 'no-owner', message: ownership.message },
            };
          }
          const id = ulid();
          const data = this.#resolveRefs(mutation.data, createdIds);
          const entity = this.#registry.parse(mutation.kind, {
            ...data,
            id,
            kind: mutation.kind,
            workspaceId,
            createdAt: now,
            updatedAt: now,
            ...(provenance ? { provenance } : {}),
          });
          this.ctx.storage.sql.exec(
            `INSERT INTO entities (id, kind, workspace_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            id,
            mutation.kind,
            workspaceId,
            JSON.stringify(entity),
            now,
            now,
          );
          createdIds[index] = id;
          return { applied: true, op: 'create', id, kind: mutation.kind };
        }
        case 'update': {
          const row = this.ctx.storage.sql
            .exec<EntityRow>(
              `SELECT id, kind, workspace_id, data, created_at, updated_at FROM entities WHERE id = ? AND kind = ?`,
              mutation.id,
              mutation.kind,
            )
            .toArray()[0];
          if (!row) {
            return {
              applied: false,
              op: 'update',
              id: mutation.id,
              kind: mutation.kind,
              error: { code: 'not-found', message: `No ${mutation.kind} with id ${mutation.id}` },
            };
          }
          const existing = JSON.parse(row.data) as Record<string, unknown>;
          const patch = this.#resolveRefs(mutation.patch, createdIds);
          // id/kind/workspaceId/createdAt are immutable; createdAt preserved from row.
          const merged = this.#registry.parse(mutation.kind, {
            ...existing,
            ...patch,
            id: row.id,
            kind: row.kind,
            workspaceId: row.workspace_id,
            createdAt: row.created_at,
            updatedAt: now,
            ...(provenance ? { provenance } : {}),
          });
          this.ctx.storage.sql.exec(
            `UPDATE entities SET data = ?, updated_at = ? WHERE id = ?`,
            JSON.stringify(merged),
            now,
            row.id,
          );
          return { applied: true, op: 'update', id: row.id, kind: row.kind };
        }
        case 'relate': {
          const from = this.#resolveRef(mutation.from, createdIds);
          const to = this.#resolveRef(mutation.to, createdIds);
          this.#relations.validate({ kind: mutation.relationKind, from, to });
          const id = ulid();
          this.ctx.storage.sql.exec(
            `INSERT INTO relations (id, kind, workspace_id, from_kind, from_id, to_kind, to_id, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id,
            mutation.relationKind,
            workspaceId,
            from.kind,
            from.id,
            to.kind,
            to.id,
            now,
            JSON.stringify({ provenance }),
          );
          return { applied: true, op: 'relate', id, kind: mutation.relationKind };
        }
        case 'unrelate': {
          this.ctx.storage.sql.exec(`DELETE FROM relations WHERE id = ?`, mutation.relationId);
          return { applied: true, op: 'unrelate', id: mutation.relationId };
        }
        case 'propose': {
          // The proposal-only constraint: structural change becomes a Proposal
          // entity awaiting review — never a direct write.
          const id = ulid();
          const proposal = this.#registry.parse('proposal', {
            id,
            kind: 'proposal',
            workspaceId,
            category: 'structural-change',
            description: mutation.description,
            rationale: mutation.rationale,
            status: 'proposed',
            createdAt: now,
            updatedAt: now,
            ...(provenance ? { provenance } : {}),
          });
          this.ctx.storage.sql.exec(
            `INSERT INTO entities (id, kind, workspace_id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
            id,
            'proposal',
            workspaceId,
            JSON.stringify(proposal),
            now,
            now,
          );
          createdIds[index] = id;
          return { applied: true, op: 'propose', id, kind: 'proposal' };
        }
      }
    } catch (error) {
      const code =
        error instanceof UnknownKindError
          ? 'unknown-kind'
          : error instanceof UnknownRelationKindError
            ? 'unknown-relation-kind'
            : error instanceof RelationEndpointError
              ? 'relation-endpoint'
              : 'validation';
      return {
        applied: false,
        op: mutation.op,
        error: { code, message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  /** Resolve `"$ref:N"` strings to the id minted for batch position N. */
  #resolveRefs(
    value: Record<string, unknown>,
    createdIds: (string | null)[],
  ): Record<string, unknown> {
    const resolve = (input: unknown): unknown => {
      if (typeof input === 'string') {
        const match = input.match(REF_PATTERN);
        if (match) {
          const resolved = createdIds[Number(match[1])];
          if (!resolved) throw new Error(`Unresolvable batch reference ${input}`);
          return resolved;
        }
        return input;
      }
      if (Array.isArray(input)) return input.map(resolve);
      if (input && typeof input === 'object') {
        return Object.fromEntries(
          Object.entries(input as Record<string, unknown>).map(([k, val]) => [k, resolve(val)]),
        );
      }
      return input;
    };
    return resolve(value) as Record<string, unknown>;
  }

  #resolveRef(
    ref: { kind: string; id: string },
    createdIds: (string | null)[],
  ): { kind: string; id: string } {
    const match = ref.id.match(REF_PATTERN);
    if (!match) return ref;
    const resolved = createdIds[Number(match[1])];
    if (!resolved) throw new Error(`Unresolvable batch reference ${ref.id}`);
    return { kind: ref.kind, id: resolved };
  }

  #logBatch(
    mutations: Mutation[],
    results: MutationResult[],
    provenance: Provenance | undefined,
    workspaceId: string,
    now: string,
  ): void {
    mutations.forEach((mutation, index) => {
      this.ctx.storage.sql.exec(
        `INSERT INTO mutation_log (id, workspace_id, instruction_id, run_id, workflow, op, payload, result, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ulid(),
        workspaceId,
        provenance?.instructionId ?? null,
        provenance?.runId ?? null,
        provenance?.workflowName ?? null,
        mutation.op,
        JSON.stringify(mutation),
        JSON.stringify(results[index]),
        now,
      );
    });
  }

  // ── reads ─────────────────────────────────────────────────────────────

  #handleListEntities(url: URL): Response {
    const kind = url.searchParams.get('kind');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 200), 500);
    const rows = kind
      ? this.ctx.storage.sql
          .exec<EntityRow>(
            `SELECT id, kind, workspace_id, data, created_at, updated_at FROM entities WHERE kind = ? ORDER BY created_at DESC LIMIT ?`,
            kind,
            limit,
          )
          .toArray()
      : this.ctx.storage.sql
          .exec<EntityRow>(
            `SELECT id, kind, workspace_id, data, created_at, updated_at FROM entities ORDER BY created_at DESC LIMIT ?`,
            limit,
          )
          .toArray();
    return Response.json({ entities: rows.map((row) => JSON.parse(row.data)) });
  }

  #handleGetEntity(kind: string, id: string): Response {
    const row = this.ctx.storage.sql
      .exec<EntityRow>(
        `SELECT id, kind, workspace_id, data, created_at, updated_at FROM entities WHERE id = ? AND kind = ?`,
        id,
        kind,
      )
      .toArray()[0];
    if (!row) return Response.json({ error: 'not found' }, { status: 404 });
    const outgoing = this.ctx.storage.sql
      .exec<RelationRow>(`SELECT * FROM relations WHERE from_id = ?`, id)
      .toArray()
      .map(rowToRelation);
    const incoming = this.ctx.storage.sql
      .exec<RelationRow>(`SELECT * FROM relations WHERE to_id = ?`, id)
      .toArray()
      .map(rowToRelation);
    return Response.json({ entity: JSON.parse(row.data), relations: { outgoing, incoming } });
  }

  #handleListRelations(url: URL): Response {
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 200), 500);
    const rows = this.ctx.storage.sql
      .exec<RelationRow>(`SELECT * FROM relations ORDER BY created_at DESC LIMIT ?`, limit)
      .toArray()
      .map(rowToRelation);
    return Response.json({ relations: rows });
  }

  /** Compact per-bucket view of live entities for prompt-context building. */
  #handleSnapshot(url: URL): Response {
    const kindsParam = url.searchParams.get('kinds');
    const kinds = kindsParam
      ? kindsParam.split(',')
      : this.ctx.storage.sql
          .exec<{ kind: string }>(`SELECT DISTINCT kind FROM entities`)
          .toArray()
          .map((row) => row.kind);
    const snapshot: Record<string, unknown[]> = {};
    for (const kind of kinds) {
      snapshot[kind] = this.ctx.storage.sql
        .exec<EntityRow>(
          `SELECT id, kind, workspace_id, data, created_at, updated_at FROM entities WHERE kind = ? ORDER BY created_at DESC LIMIT ?`,
          kind,
          SNAPSHOT_CAP_PER_KIND,
        )
        .toArray()
        .map((row) => JSON.parse(row.data));
    }
    return Response.json({ snapshot });
  }

  /** Everything an instruction caused: mutation-log rows + touched entities. */
  #handleProvenance(instructionId: string): Response {
    const log = this.ctx.storage.sql
      .exec(
        `SELECT id, run_id, workflow, op, payload, result, applied_at FROM mutation_log WHERE instruction_id = ? ORDER BY applied_at ASC`,
        instructionId,
      )
      .toArray()
      .map((row) => ({
        id: row.id,
        runId: row.run_id,
        workflow: row.workflow,
        op: row.op,
        payload: JSON.parse(row.payload as string),
        result: JSON.parse(row.result as string),
        appliedAt: row.applied_at,
      }));
    return Response.json({ instructionId, log });
  }

  #handleStats(): Response {
    const counts = this.ctx.storage.sql
      .exec<{ kind: string; n: number }>(
        `SELECT kind, COUNT(*) as n FROM entities GROUP BY kind ORDER BY kind`,
      )
      .toArray();
    const relationCount = this.ctx.storage.sql
      .exec<{ n: number }>(`SELECT COUNT(*) as n FROM relations`)
      .one().n;
    const logCount = this.ctx.storage.sql
      .exec<{ n: number }>(`SELECT COUNT(*) as n FROM mutation_log`)
      .one().n;
    return Response.json({ counts, relationCount, logCount });
  }
}

function rowToRelation(row: RelationRow): Relation {
  const extra = JSON.parse(row.data) as { provenance?: Relation['provenance'] };
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    from: { kind: row.from_kind, id: row.from_id },
    to: { kind: row.to_kind, id: row.to_id },
    createdAt: row.created_at,
    ...(extra.provenance ? { provenance: extra.provenance } : {}),
  };
}
