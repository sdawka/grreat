import type { Context, Next } from 'hono';
import type { EngineEnv } from './env.ts';

const COOKIE_NAME = 'engine_admin';

async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return new Uint8Array(digest);
}

/** Constant-time comparison via digest equality. */
async function tokenMatches(candidate: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(candidate), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function candidateFrom(c: Context): string | null {
  const header = c.req.header('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length);
  const query = c.req.query('token');
  if (query) return query;
  const cookie = c.req.header('Cookie');
  const match = cookie?.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match?.[1] ?? null;
}

/**
 * Bearer/query/cookie token auth. While the secret is unset the protected
 * surface does not exist (404) — smalltalk's admin pattern. A valid ?token=
 * sets a cookie so the HTML admin is browsable.
 */
export async function requireToken(c: Context<{ Bindings: EngineEnv }>, next: Next) {
  const expected = c.env.ENGINE_ADMIN_TOKEN;
  if (!expected) return c.notFound();
  const candidate = candidateFrom(c);
  if (!candidate || !(await tokenMatches(candidate, expected))) {
    return c.body(null, 401);
  }
  if (c.req.query('token')) {
    c.header('Set-Cookie', `${COOKIE_NAME}=${c.req.query('token')}; HttpOnly; Path=/; SameSite=Strict`);
  }
  await next();
}
