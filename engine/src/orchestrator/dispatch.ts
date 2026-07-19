import type { EngineEnv } from '../host/env.ts';

export interface InterpretOutcome {
  completed: boolean;
  dispatched: { workflow: string; runId: string }[];
}

/**
 * Interpret an instruction and fan out to edge workflows.
 * Placeholder until the interpret workflow lands: the instruction stays
 * `received` and is picked up by nothing.
 */
export async function runInterpret(
  _env: EngineEnv,
  _instructionId: string,
  _text: string,
): Promise<InterpretOutcome> {
  return { completed: false, dispatched: [] };
}
