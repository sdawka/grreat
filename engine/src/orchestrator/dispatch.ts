import { getRun, invoke } from '@flue/runtime';
import interpret from '../workflows/interpret.ts';
import type { EngineEnv } from '../host/env.ts';

export interface InterpretOutcome {
  completed: boolean;
  dispatched: { workflow: string; runId: string }[];
}

const POLL_INTERVAL_MS = 400;
const POLL_ATTEMPTS = 30; // ~12s before falling back to 202 + polling

/**
 * Admit an interpret run for the instruction and wait briefly for it to
 * settle so simple requests answer synchronously. Falls back to
 * not-completed (caller responds 202; the Instruction entity is pollable)
 * when the run needs longer — or when no Flue runtime is configured
 * (unit tests), where the instruction simply stays `received`.
 */
export async function runInterpret(
  _env: EngineEnv,
  instructionId: string,
  text: string,
): Promise<InterpretOutcome> {
  let runId: string;
  try {
    ({ runId } = await invoke(interpret, { input: { instructionId, text } }));
  } catch {
    return { completed: false, dispatched: [] };
  }

  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    try {
      const record = await getRun(runId);
      if (record?.endedAt) {
        const result = record.result as
          | { dispatched?: { workflow: string; runId: string }[] }
          | undefined;
        return {
          completed: !record.isError,
          dispatched: result?.dispatched ?? [],
        };
      }
    } catch {
      break;
    }
  }
  return { completed: false, dispatched: [] };
}
