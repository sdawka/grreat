/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest';
import {
  validateEmail,
  createSignupResponse,
  createUnavailableResponse,
  handleSignupWithDB,
  SERVICE_UNAVAILABLE_MESSAGE,
} from '../src/lib/signup';

// ── Unit tests: email validation ──

describe('validateEmail', () => {
  it('returns valid for a standard email address', () => {
    const result = validateEmail('user@example.com');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns valid for email with plus addressing', () => {
    const result = validateEmail('user+tag@example.co.uk');
    expect(result.valid).toBe(true);
  });

  it('returns valid for short domain', () => {
    const result = validateEmail('a@b.co');
    expect(result.valid).toBe(true);
  });

  it('returns error for empty string', () => {
    const result = validateEmail('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Email is required');
  });

  it('returns error for null or undefined', () => {
    expect(validateEmail(null as unknown as string).valid).toBe(false);
    expect(validateEmail(undefined as unknown as string).valid).toBe(false);
  });

  it('returns error for string without @', () => {
    const result = validateEmail('notanemail');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/valid/i);
  });

  it('returns error for string without domain after @', () => {
    const result = validateEmail('user@');
    expect(result.valid).toBe(false);
  });

  it('returns error for string without local part', () => {
    const result = validateEmail('@domain.com');
    expect(result.valid).toBe(false);
  });

  it('returns error for obviously malformed email', () => {
    const result = validateEmail('user@.com');
    expect(result.valid).toBe(false);
  });

  it('trims whitespace from the email', () => {
    const result = validateEmail('  user@example.com  ');
    expect(result.valid).toBe(true);
  });
});

// ── Unit tests: createSignupResponse ──

describe('createSignupResponse', () => {
  it('returns a success response with status 200', () => {
    const res = createSignupResponse({ success: true, message: 'You are on the list.' });
    expect(res.status).toBe(200);
  });

  it('returns JSON content-type', () => {
    const res = createSignupResponse({ success: true, message: 'ok' });
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns the body as JSON string', async () => {
    const body = { success: true, message: 'Joined' };
    const res = createSignupResponse(body);
    const json = await res.json() as { success: boolean; error?: string };
    expect(json).toEqual(body);
  });

  it('sets custom status code when provided', () => {
    const res = createSignupResponse({ success: false, message: 'Duplicate' }, 409);
    expect(res.status).toBe(409);
  });
});

// ── Unit tests: createUnavailableResponse ──

describe('createUnavailableResponse', () => {
  it('returns 503 with the generic visitor-facing message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = createUnavailableResponse('DB binding is missing');
    expect(res.status).toBe(503);
    const json = await res.json() as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe(SERVICE_UNAVAILABLE_MESSAGE);
    spy.mockRestore();
  });

  it('does not leak operator setup instructions to the visitor', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = createUnavailableResponse('run `npx wrangler d1 create grreat-waitlist`');
    const json = await res.json() as { success: boolean; error?: string };
    expect(json.error).not.toMatch(/wrangler|d1|database_id|migration/i);
    spy.mockRestore();
  });

  it('logs the operator detail server-side via console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    createUnavailableResponse('DB binding is missing');
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('DB binding is missing'),
    );
    spy.mockRestore();
  });
});

// ── Integration tests: handleSignupWithDB ──

describe('handleSignupWithDB', () => {
  function createMockDB(success: boolean, errorMsg?: string) {
    return {
      prepare: (_sql: string) => ({
        bind: (..._args: unknown[]) => ({
          run: async () => {
            if (errorMsg) {
              throw new Error(errorMsg);
            }
            return { success };
          },
        }),
      }),
    } as unknown as D1Database;
  }

  it('returns 200 for successful insert', async () => {
    const db = createMockDB(true);
    const res = await handleSignupWithDB('user@example.com', db);
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; error?: string };
    expect(json.success).toBe(true);
  });

  it('returns 409 for duplicate email (UNIQUE constraint)', async () => {
    const db = createMockDB(false, 'UNIQUE constraint failed: waitlist.email');
    const res = await handleSignupWithDB('dupe@example.com', db);
    expect(res.status).toBe(409);
    const json = await res.json() as { success: boolean; error?: string };
    expect(json.success).toBe(false);
    expect(json.error).toMatch(/already|joined/i);
  });

  it('returns 500 when DB insert returns non-success', async () => {
    const db = createMockDB(false);
    const res = await handleSignupWithDB('fail@example.com', db);
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean; error?: string };
    expect(json.success).toBe(false);
  });

  it('returns 500 for unknown DB error', async () => {
    const db = createMockDB(false, 'Some random database error');
    const res = await handleSignupWithDB('error@example.com', db);
    expect(res.status).toBe(500);
  });
});
