import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import {
  validateEmail,
  createSignupResponse,
  createUnavailableResponse,
  handleSignupWithDB,
  type Env,
} from '../../lib/signup';

interface SignupRequest {
  email?: string;
  website?: string; // honeypot field
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  // GET etc. → 405
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json; charset=utf-8', allow: 'POST' },
    });
  }

  let body: SignupRequest;
  try {
    body = await request.json();
  } catch {
    return createSignupResponse({ success: false, error: 'Invalid JSON body' }, 400);
  }

  // Honeypot check — if filled, silently accept (bots think they succeeded)
  if (body.website && body.website.trim().length > 0) {
    return createSignupResponse({ success: true, message: 'You are on the list.' });
  }

  const rawEmail = body.email ?? '';
  const validation = validateEmail(rawEmail);

  if (!validation.valid) {
    return createSignupResponse(
      { success: false, error: validation.error! },
      400,
    );
  }

  const email = rawEmail.trim().toLowerCase();

  try {
    const workerEnv = env as Env;

    if (!workerEnv.DB) {
      return createUnavailableResponse('DB binding is missing. To set up locally: create a D1 database with `npx wrangler d1 create grreat-waitlist`, update wrangler.toml with the database_id, and run migrations.');
    }

    return handleSignupWithDB(email, workerEnv.DB);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('env') || msg.includes('binding')) {
      return createUnavailableResponse(`DB binding unavailable: ${msg}`);
    }
    return createSignupResponse(
      { success: false, error: 'Could not complete signup. Please try again.' },
      500,
    );
  }
};
