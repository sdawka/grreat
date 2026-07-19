import type {
  BaseEntity,
  Mutation,
  MutationResult,
  Provenance,
  Relation,
} from '../domain/index.ts';

/** Anything with a bound fetch — a DO stub satisfies this. Never pass bare global fetch (workerd Illegal invocation). */
export interface Fetchable {
  fetch(request: Request): Promise<Response>;
}

export interface ProvenanceLogRow {
  id: string;
  runId: string | null;
  workflow: string | null;
  op: string;
  payload: Mutation;
  result: MutationResult;
  appliedAt: string;
}

export type StoredEntity = BaseEntity & Record<string, unknown>;

export interface StorePort {
  apply(mutations: Mutation[], provenance?: Provenance): Promise<MutationResult[]>;
  list(kind?: string, limit?: number): Promise<StoredEntity[]>;
  get(
    kind: string,
    id: string,
  ): Promise<{ entity: StoredEntity; relations: { outgoing: Relation[]; incoming: Relation[] } } | null>;
  listRelations(limit?: number): Promise<Relation[]>;
  snapshot(kinds?: string[]): Promise<Record<string, StoredEntity[]>>;
  provenance(instructionId: string): Promise<ProvenanceLogRow[]>;
  stats(): Promise<{
    counts: { kind: string; n: number }[];
    relationCount: number;
    logCount: number;
  }>;
}

const BASE = 'https://workspace-store';

/** Store client over a WorkspaceStore DO stub. */
export class StoreClient implements StorePort {
  #stub: Fetchable;

  constructor(stub: Fetchable) {
    this.#stub = stub;
  }

  async #request(path: string, init?: RequestInit): Promise<Response> {
    const response = await this.#stub.fetch(new Request(`${BASE}${path}`, init));
    if (response.status >= 500) {
      const body = await response.text();
      throw new Error(`WorkspaceStore error ${response.status}: ${body}`);
    }
    return response;
  }

  async apply(mutations: Mutation[], provenance?: Provenance): Promise<MutationResult[]> {
    const response = await this.#request('/mutations/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations, provenance }),
    });
    const body = (await response.json()) as { results?: MutationResult[]; error?: string };
    if (!body.results) throw new Error(body.error ?? 'apply failed');
    return body.results;
  }

  async list(kind?: string, limit = 200): Promise<StoredEntity[]> {
    const params = new URLSearchParams();
    if (kind) params.set('kind', kind);
    params.set('limit', String(limit));
    const response = await this.#request(`/entities?${params}`);
    return ((await response.json()) as { entities: StoredEntity[] }).entities;
  }

  async get(kind: string, id: string) {
    const response = await this.#request(`/entities/${kind}/${id}`);
    if (response.status === 404) return null;
    return (await response.json()) as {
      entity: StoredEntity;
      relations: { outgoing: Relation[]; incoming: Relation[] };
    };
  }

  async listRelations(limit = 200): Promise<Relation[]> {
    const response = await this.#request(`/relations?limit=${limit}`);
    return ((await response.json()) as { relations: Relation[] }).relations;
  }

  async snapshot(kinds?: string[]): Promise<Record<string, StoredEntity[]>> {
    const query = kinds?.length ? `?kinds=${kinds.join(',')}` : '';
    const response = await this.#request(`/snapshot${query}`);
    return ((await response.json()) as { snapshot: Record<string, StoredEntity[]> }).snapshot;
  }

  async provenance(instructionId: string): Promise<ProvenanceLogRow[]> {
    const response = await this.#request(`/provenance/${instructionId}`);
    return ((await response.json()) as { log: ProvenanceLogRow[] }).log;
  }

  async stats() {
    const response = await this.#request('/stats');
    return (await response.json()) as {
      counts: { kind: string; n: number }[];
      relationCount: number;
      logCount: number;
    };
  }
}

export interface StoreEnv {
  WORKSPACE_STORE: {
    idFromName(name: string): unknown;
    get(id: unknown): Fetchable;
  };
}

/** Single-tenant today; multi-tenant later is just a different workspace name. */
export function getStore(env: StoreEnv, workspaceId = 'default'): StoreClient {
  const namespace = env.WORKSPACE_STORE;
  return new StoreClient(namespace.get(namespace.idFromName(workspaceId)));
}
