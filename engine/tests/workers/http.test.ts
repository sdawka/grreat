import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import app from './test-worker.ts';
import type { EngineEnv } from '../../src/host/env.ts';

const TOKEN = 'test-secret';

function authedEnv(): EngineEnv {
  return { ...(env as unknown as EngineEnv), ENGINE_ADMIN_TOKEN: TOKEN };
}

function tokenlessEnv(): EngineEnv {
  const e = { ...(env as unknown as EngineEnv) };
  delete e.ENGINE_ADMIN_TOKEN;
  return e;
}

const bearer = { Authorization: `Bearer ${TOKEN}` };

describe('auth', () => {
  it('protected surface does not exist while the secret is unset', async () => {
    const response = await app.request('/admin', {}, tokenlessEnv());
    expect(response.status).toBe(404);
  });

  it('rejects missing or wrong tokens with an empty 401', async () => {
    expect((await app.request('/admin', {}, authedEnv())).status).toBe(401);
    expect(
      (
        await app.request('/admin', { headers: { Authorization: 'Bearer nope' } }, authedEnv())
      ).status,
    ).toBe(401);
  });

  it('admits a valid bearer token', async () => {
    const response = await app.request('/admin', { headers: bearer }, authedEnv());
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('dashboard');
  });

  it('a valid ?token= sets a Secure cookie and redirects the token out of the URL', async () => {
    const response = await app.request(`/admin?token=${TOKEN}`, {}, authedEnv());
    expect(response.status).toBe(302);
    expect(response.headers.get('Set-Cookie')).toContain('engine_admin=');
    expect(response.headers.get('Set-Cookie')).toContain('Secure');
    expect(response.headers.get('Location')).toBe('/admin');
  });
});

describe('POST /api/instructions', () => {
  it('stores the text as an Instruction entity and returns its id', async () => {
    const response = await app.request(
      '/api/instructions',
      {
        method: 'POST',
        headers: { ...bearer, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'I want to write a book this year' }),
      },
      authedEnv(),
    );
    expect(response.status).toBe(202);
    const body = (await response.json()) as { instructionId: string; status: string };
    expect(body.instructionId).toBeTruthy();

    const poll = await app.request(
      `/api/instructions/${body.instructionId}`,
      { headers: bearer },
      authedEnv(),
    );
    const polled = (await poll.json()) as { instruction: { text: string; status: string } };
    expect(polled.instruction.text).toBe('I want to write a book this year');
  });

  it('rejects malformed bodies', async () => {
    const response = await app.request(
      '/api/instructions',
      { method: 'POST', headers: { ...bearer, 'Content-Type': 'application/json' }, body: '{}' },
      authedEnv(),
    );
    expect(response.status).toBe(400);
  });
});

describe('admin entity pages', () => {
  it('renders entity detail with escaped raw JSON and provenance chain', async () => {
    const create = await app.request(
      '/api/instructions',
      {
        method: 'POST',
        headers: { ...bearer, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '<script>alert(1)</script> add a goal' }),
      },
      authedEnv(),
    );
    const { instructionId } = (await create.json()) as { instructionId: string };

    const page = await app.request(
      `/admin/entities/instruction/${instructionId}`,
      { headers: bearer },
      authedEnv(),
    );
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('everything this instruction caused');
  });

  it('lists kinds and renders empty lists gracefully', async () => {
    const page = await app.request('/admin/entities/goal', { headers: bearer }, authedEnv());
    expect(page.status).toBe(200);
  });
});
