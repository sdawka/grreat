import { env } from 'cloudflare:workers';
import { registerProvider } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono } from 'hono';
import { api } from './host/api.ts';
import { admin } from './host/admin.ts';
import type { EngineEnv } from './host/env.ts';

type CloudflareAIRegistration = Extract<
  Parameters<typeof registerProvider>[1],
  { api: 'cloudflare-ai-binding' }
>;

// Flue's default routes cloudflare/* binding calls through AI Gateway id
// "default", which this account does not have — the gatewayed stream ends
// without a finish_reason. Bypass the gateway; calls hit Workers AI directly.
registerProvider('cloudflare', {
  api: 'cloudflare-ai-binding',
  binding: (env as { AI?: CloudflareAIRegistration['binding'] }).AI,
  gateway: false,
});

const app = new Hono<{ Bindings: EngineEnv }>();

app.get('/healthz', (c) => c.json({ ok: true }));
app.route('/api', api);
app.route('/admin', admin);
app.route('/', flue());

export default app;
