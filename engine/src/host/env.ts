import type { StoreEnv } from '../store/store-client.ts';

/** Worker bindings the engine's HTTP layer relies on. */
export interface EngineEnv extends StoreEnv {
  /** Secret. Admin + API bearer token; endpoints 404 while it is unset. */
  ENGINE_ADMIN_TOKEN?: string;
  /** '1' = workflows return deterministic stub output, no model calls. */
  STUB_MODE?: string;
  MODEL_INTERPRETER?: string;
  MODEL_EDGE?: string;
}
