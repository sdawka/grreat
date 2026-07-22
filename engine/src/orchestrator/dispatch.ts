import { getRun, invoke, WorkflowInvocationNotConfiguredError } from '@flue/runtime';
import interpret from '../workflows/interpret.ts';
import { getStore } from '../store/store-client.ts';
import type { EngineEnv } from '../host/env.ts';

export interface InterpretOutcome {
  completed: boolean;
  dispatched: { workflow: string; runId: string }[];
}

const POLL_INTERVAL_MS = 400;
const POLL_ATTEMPTS = 30; // ~12s before falling back to 202 + polling

/**
 * True only for the "no Flue runtime configured" case — `invoke()` called
 * outside a generated server entry (unit tests / non-Flue mounts). Every other
 * failure (admission errors, platform faults) is a real problem the caller
 * must not swallow.
 */
function isNoRuntimeError(error: unknown): boolean {
  return (
    error instanceof WorkflowInvocationNotConfiguredError ||
    (error as { name?: string })?.name === 'WorkflowInvocationNotConfiguredError'
  );
}

/**
 * Admit an interpret run for the instruction and wait briefly for it to
 * settle so simple requests answer synchronously. Falls back to
 * not-completed (caller responds 202; the Instruction entity is pollable)
 * when the run needs longer — or when no Flue runtime is configured
 * (unit tests), where the instruction simply stays `received`.
 *
 * A genuine admission failure (runtime present but `invoke()` threw) is NOT
 * swallowed: the interpret run never started, so nothing downstream would ever
 * terminalize the instruction — we mark it `failed` here so it can never
 * strand in `received`.
 */
export async function runInterpret(
  env: EngineEnv,
  instructionId: string,
  text: string,
): Promise<InterpretOutcome> {
  let runId: string;
  try {
    ({ runId } = await invoke(interpret, { input: { instructionId, text } }));
  } catch (error) {
    if (isNoRuntimeError(error)) {
      return { completed: false, dispatched: [] };
    }
    // Real admission failure: terminalize the instruction so it never strands.
    await getStore(env)
      .apply([
        {
          op: 'update',
          kind: 'instruction',
          id: instructionId,
          patch: { status: 'failed', error: `interpret admission failed: ${String(error)}` },
        },
      ])
      .catch((writeError) => {
        // Double fault: admission failed AND the mark-failed write failed. The
        // instruction is left in `received`; log loudly so an operator can find
        // it — swallowing to avoid a 500 is fine, swallowing silently is not.
        console.error(
          `[dispatch] double fault: could not mark instruction ${instructionId} failed after admission error`,
          { admissionError: String(error), writeError: String(writeError) },
        );
      });
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

export const __test = { isNoRuntimeError };
