import { Hono } from 'hono';
import * as v from 'valibot';
import { getStore } from '../store/store-client.ts';
import { requireToken } from './auth.ts';
import type { EngineEnv } from './env.ts';
import { runInterpret } from '../orchestrator/dispatch.ts';

const InstructionRequestSchema = v.object({
  text: v.pipe(v.string(), v.minLength(1), v.maxLength(8000)),
});

export const api = new Hono<{ Bindings: EngineEnv }>();

api.use('*', requireToken);

/**
 * The front door: accept a chunk of user text, store it as an Instruction
 * (the provenance root), then interpret + dispatch. Responds synchronously
 * when interpretation completes in time; the instruction record is always
 * pollable at GET /api/instructions/:id either way.
 */
api.post('/instructions', async (c) => {
  const parsed = v.safeParse(InstructionRequestSchema, await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'body must be {"text": "..."}' }, 400);
  }
  const store = getStore(c.env);
  const [created] = await store.apply([
    {
      op: 'create',
      kind: 'instruction',
      data: { text: parsed.output.text, source: 'api', status: 'received', runIds: [] },
    },
  ]);
  if (!created?.applied || !created.id) {
    return c.json({ error: created?.error?.message ?? 'failed to store instruction' }, 500);
  }
  const instructionId = created.id;

  const outcome = await runInterpret(c.env, instructionId, parsed.output.text);
  const instruction = (await store.get('instruction', instructionId))?.entity;
  // 200 when interpretation reached a terminal state synchronously (completed,
  // dispatched, or failed); 202 only when it is still in flight and the caller
  // must poll. A terminal `failed` must not read as 202 "still working".
  const settled = outcome.completed || instruction?.status === 'failed';
  return c.json(
    {
      instructionId,
      status: instruction?.status ?? 'received',
      intent: instruction?.intent ?? null,
      answer: instruction?.answer ?? null,
      dispatched: outcome.dispatched,
      error: instruction?.error ?? null,
    },
    settled ? 200 : 202,
  );
});

api.get('/instructions/:id', async (c) => {
  const store = getStore(c.env);
  const detail = await store.get('instruction', c.req.param('id'));
  if (!detail) return c.json({ error: 'not found' }, 404);
  return c.json({ instruction: detail.entity });
});
