import {
  defineAgent,
  defineWorkflow,
  type WorkflowRunsHandler,
} from '@flue/runtime';
import { getCloudflareContext, getDurableObjectIdentity } from '@flue/runtime/cloudflare';
import { catalogEntry, type WorkflowCatalogEntry } from '../../orchestrator/catalog.ts';
import { applyEdgeOutput } from '../../orchestrator/apply.ts';
import { getStore, type StorePort } from '../../store/store-client.ts';
import { buildDomainTools } from '../../tools/domain-tools.ts';
import { requireToken } from '../../host/auth.ts';
import type { EngineEnv } from '../../host/env.ts';
import {
  EdgeInputSchema,
  EdgeOutputSchema,
  EdgeResultSchema,
  type EdgeInput,
  type EdgeOutput,
} from './shared.ts';
import { stubEdgeOutput } from './stub-edges.ts';

const DEFAULT_MODEL = 'cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast';

function buildPrompt(
  entry: WorkflowCatalogEntry,
  input: EdgeInput,
  snapshot: Record<string, unknown[]>,
): string {
  return `${entry.prompt}

Why this workflow fired: ${input.reason}
Originating user instruction:
"""
${input.instructionText}
"""

Current state snapshot (kinds: ${entry.contextKinds.join(', ')}):
${JSON.stringify(snapshot, null, 2)}

Respond with an EdgeOutput object:
- proposedMutations: create/update/relate/unrelate/propose operations. "data" carries domain fields only (no id/timestamps). "$ref:N" as an id refers to the N-th mutation's created entity. Goals and next-actions require owner {"type":"human"|"ai","name":"..."}.
- rationale: one paragraph explaining the changes.
- decision: fill when you exercised judgement (reframing, parking, dropping).
Propose nothing when the state does not warrant change — an empty proposedMutations with a rationale is a valid outcome.`;
}

/**
 * Factory for edge and intra workflows: every link between or within buckets
 * is the same shape — read snapshot, judge via prompt (or stub), propose
 * mutations, apply through the store's write barrier with provenance.
 */
export function createEdgeWorkflow(id: string) {
  const entry = catalogEntry(id);
  if (!entry) throw new Error(`No catalog entry for workflow "${id}"`);

  const agent = defineAgent<EngineEnv>(({ env }) => ({
    model: env.MODEL_EDGE ?? DEFAULT_MODEL,
    instructions: `You operate one feedback link of GRREAT, a cyclical goal operating system: "${entry.title}". ${entry.trigger}`,
    tools: buildDomainTools(getStore(env)),
  }));

  const workflow = defineWorkflow({
    agent,
    input: EdgeInputSchema,
    output: EdgeResultSchema,
    async run({ harness, input, log }) {
      const { env } = getCloudflareContext() as unknown as { env: EngineEnv };
      const store: StorePort = getStore(env);
      let runId: string | undefined;
      try {
        runId = getDurableObjectIdentity().name;
      } catch {
        /* outside a generated DO (tests) */
      }
      const provenance = {
        instructionId: input.instructionId,
        workflowName: id,
        ...(runId ? { runId } : {}),
      };

      let output: EdgeOutput;
      if (env.STUB_MODE === '1') {
        output = await stubEdgeOutput(id, input, store);
      } else {
        const snapshot = await store.snapshot([...entry.contextKinds]);
        const session = await harness.session();
        const prompt = buildPrompt(entry, input, snapshot);
        try {
          const response = await session.prompt(prompt, { result: EdgeOutputSchema });
          output = (response as unknown as { data: EdgeOutput }).data;
        } catch (firstError) {
          log.warn?.(`${id}: output validation failed, retrying once`, {
            error: String(firstError),
          });
          const response = await session.prompt(
            `Your previous output failed validation (${String(firstError)}). Emit a valid EdgeOutput object exactly matching the schema.`,
            { result: EdgeOutputSchema },
          );
          output = (response as unknown as { data: EdgeOutput }).data;
        }
      }

      const result = await applyEdgeOutput(store, output, provenance);
      if (result.errors.length > 0) {
        log.warn?.(`${id}: store rejected ${result.errors.length} write(s)`, {
          errors: result.errors,
        });
        // A fully-rejected edge accomplished nothing despite proposing changes —
        // that is a failed run, not a green one. Errors the run record so it is
        // visible in admin instead of masquerading as success. Partial failures
        // stay a green run + warn (operator-visible), by design.
        if (result.applied === 0 && result.failed > 0) {
          throw new Error(
            `${id}: all ${result.failed} proposed mutation(s) rejected: ${result.errors.join('; ')}`,
          );
        }
      }
      return result;
    },
  });

  const runs: WorkflowRunsHandler = requireToken;
  return { workflow, runs };
}
