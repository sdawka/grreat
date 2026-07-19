import { invoke } from '@flue/runtime';
import type { EdgeInput } from './shared.ts';

/**
 * Registry mapping catalog workflow ids to discovered workflow default
 * exports. Edge/intra modules are added here as they are implemented;
 * the orchestrator skips (and records) triggers with no registered ref.
 */
// deno-lint-ignore no-explicit-any
const REFS = new Map<string, any>();

export function registerWorkflowRef(id: string, ref: unknown): void {
  REFS.set(id, ref);
}

export function registeredWorkflowIds(): string[] {
  return [...REFS.keys()];
}

export async function invokeCatalogWorkflow(
  id: string,
  input: EdgeInput,
): Promise<{ runId: string } | null> {
  const ref = REFS.get(id);
  if (!ref) return null;
  const { runId } = await invoke(ref, { input });
  return { runId };
}
