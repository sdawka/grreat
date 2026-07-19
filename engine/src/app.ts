import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { api } from './host/api.ts';
import { admin } from './host/admin.ts';
import type { EngineEnv } from './host/env.ts';

const app = new Hono<{ Bindings: EngineEnv }>();

app.get('/healthz', (c) => c.json({ ok: true }));
app.route('/api', api);
app.route('/admin', admin);
app.route('/', flue());

export default app;
