import { Hono } from 'hono';
import { api } from '../../src/host/api.ts';
import { admin } from '../../src/host/admin.ts';
import type { EngineEnv } from '../../src/host/env.ts';

export { WorkspaceStore } from '../../src/store/workspace-store.ts';

// Test app: the engine's own HTTP surface without the Flue mount
// (Flue routes need the generated runtime; they are covered by dev/deploy smoke).
const app = new Hono<{ Bindings: EngineEnv }>();
app.route('/api', api);
app.route('/admin', admin);

export default app;
