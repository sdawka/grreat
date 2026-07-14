export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an email address for signup.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || (typeof email === 'string' && email.trim().length === 0)) {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim();
  // Basic RFC 5322-ish pattern that catches common issues
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please provide a valid email address' };
  }

  return { valid: true };
}

/**
 * Create a JSON Response for the signup API.
 */
export function createSignupResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export interface Env {
  DB?: D1Database;
}

export async function handleSignupWithDB(
  email: string,
  db: D1Database,
): Promise<Response> {
  const stmt = db.prepare('INSERT INTO waitlist (email) VALUES (?)').bind(email);
  try {
    const result = await stmt.run();
    if (result.success) {
      return createSignupResponse({ success: true, message: 'You are on the list.' });
    }
    return createSignupResponse(
      { success: false, error: 'Could not complete signup. Please try again.' },
      500,
    );
  } catch (error: unknown) {
    if (String(error).includes('UNIQUE constraint failed')) {
      return createSignupResponse(
        { success: false, error: 'This email has already joined the waitlist.' },
        409,
      );
    }
    return createSignupResponse(
      { success: false, error: 'Could not complete signup. Please try again.' },
      500,
    );
  }
}
