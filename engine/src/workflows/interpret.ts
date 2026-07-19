import { defineAgent, defineWorkflow, type WorkflowRunsHandler } from '@flue/runtime';
import { getCloudflareContext, getDurableObjectIdentity } from '@flue/runtime/cloudflare';
import * as v from 'valibot';
import { getStore } from '../store/store-client.ts';
import { buildDomainTools } from '../tools/domain-tools.ts';
import { fakeInterpret } from '../orchestrator/fake-intent.ts';
import { IntentSchema, type Intent } from '../orchestrator/intent.ts';
import { interpreterInstructions } from '../orchestrator/instructions.ts';
import { applyIntent, resolveIntentForArchive } from '../orchestrator/orchestrator.ts';
import { invokeCatalogWorkflow } from './lib/refs.ts';
import { requireToken } from '../host/auth.ts';
import type { EngineEnv } from '../host/env.ts';
import './lib/register-edges.ts';

const DEFAULT_MODEL = 'cloudflare/@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const interpreterAgent = defineAgent<EngineEnv>(({ env }) => ({
  model: env.MODEL_INTERPRETER ?? DEFAULT_MODEL,
  instructions: interpreterInstructions(),
  tools: buildDomainTools(getStore(env)),
}));

function currentRunId(): string | undefined {
  try {
    return getDurableObjectIdentity().name;
  } catch {
    return undefined;
  }
}

/**
 * The front-door workflow: interpret one stored Instruction, then let the
 * deterministic orchestrator apply direct mutations and fan out to edge
 * workflows. The model's authority ends at the validated Intent.
 */
export default defineWorkflow({
  agent: interpreterAgent,
  input: v.object({
    instructionId: v.string(),
    text: v.string(),
  }),
  output: v.object({
    intent: IntentSchema,
    dispatched: v.array(v.object({ workflow: v.string(), runId: v.string() })),
    skipped: v.array(v.string()),
  }),
  async run({ harness, input, log }) {
    const { env } = getCloudflareContext() as unknown as { env: EngineEnv };
    const store = getStore(env);
    const runId = currentRunId();
    const provenance = {
      instructionId: input.instructionId,
      workflowName: 'interpret',
      ...(runId ? { runId } : {}),
    };

    await store.apply(
      [
        {
          op: 'update',
          kind: 'instruction',
          id: input.instructionId,
          patch: { status: 'interpreting' },
        },
      ],
      provenance,
    );

    try {
      let intent: Intent;
      if (env.STUB_MODE === '1') {
        intent = fakeInterpret(input.text);
      } else {
        const session = await harness.session();
        const promptText = `User instruction:\n"""\n${input.text}\n"""\n\nInspect current state with your tools as needed, then emit the Intent object.`;
        try {
          const response = await session.prompt(promptText, { result: IntentSchema });
          intent = (response as unknown as { data: Intent }).data;
        } catch (firstError) {
          log.warn?.('intent validation failed, retrying once', { error: String(firstError) });
          const response = await session.prompt(
            `Your previous output failed validation (${String(firstError)}). Emit a valid Intent object exactly matching the schema.`,
            { result: IntentSchema },
          );
          intent = (response as unknown as { data: Intent }).data;
        }
      }

      const outcome = await applyIntent(
        store,
        intent,
        { instructionId: input.instructionId, instructionText: input.text, ...(runId ? { runId } : {}) },
        invokeCatalogWorkflow,
      );

      const status = outcome.dispatched.length > 0 ? 'dispatched' : 'completed';
      // Archive the intent with $ref:N placeholders replaced by minted ids —
      // a raw $ref inside the archived JSON would trip the store's live
      // batch-reference resolution and strand the instruction.
      const archivedIntent = resolveIntentForArchive(intent, outcome.applyResults);
      const finalPatch = {
        status,
        ...(intent.answer ? { answer: intent.answer } : {}),
        runIds: outcome.dispatched.map((d) => d.runId),
      };
      const [archived] = await store.apply(
        [
          {
            op: 'update',
            kind: 'instruction',
            id: input.instructionId,
            patch: { ...finalPatch, intent: archivedIntent as unknown as Record<string, unknown> },
          },
        ],
        provenance,
      );
      if (!archived?.applied) {
        // Never strand an instruction in `interpreting`: retry without the
        // intent payload, which is the only free-form part of the patch.
        log.warn?.('final instruction update failed; retrying without intent', {
          error: archived?.error?.message,
        });
        const [minimal] = await store.apply(
          [{ op: 'update', kind: 'instruction', id: input.instructionId, patch: finalPatch }],
          provenance,
        );
        if (!minimal?.applied) {
          throw new Error(
            `failed to finalize instruction: ${minimal?.error?.message ?? 'unknown store error'}`,
          );
        }
      }

      return { intent, dispatched: outcome.dispatched, skipped: outcome.skipped };
    } catch (error) {
      await store.apply(
        [
          {
            op: 'update',
            kind: 'instruction',
            id: input.instructionId,
            patch: { status: 'failed', error: String(error) },
          },
        ],
        provenance,
      );
      throw error;
    }
  },
});

/** Run records inspectable over HTTP with the admin token. */
export const runs: WorkflowRunsHandler = requireToken;
