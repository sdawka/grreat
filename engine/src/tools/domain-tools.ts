import { defineTool, type ToolDefinition } from '@flue/runtime';
import * as v from 'valibot';
import type { StorePort } from '../store/store-client.ts';

/**
 * Read-only tools over the workspace store. Models never get a write tool —
 * writes flow exclusively through validated workflow outputs.
 *
 * Built inside the agent initializer so the store client closes over the
 * live env for this initialization (avoids smalltalk's stale-holder trap).
 */
export function buildDomainTools(store: StorePort): ToolDefinition[] {
  return [
    defineTool({
      name: 'list_entities',
      description:
        'List entities of one kind, newest first. Kinds: goal, research-question, finding, roadmap-item, milestone, sprint, next-action, execution-log, working-session, review, estimate, time-entry, instruction, decision-record, proposal.',
      input: v.object({
        kind: v.string(),
        limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100))),
      }),
      async run({ input }) {
        return { entities: await store.list(input.kind, input.limit ?? 25) };
      },
    }),
    defineTool({
      name: 'get_entity',
      description: 'Get one entity by kind and id, with its incoming/outgoing relations.',
      input: v.object({ kind: v.string(), id: v.string() }),
      async run({ input }) {
        const detail = await store.get(input.kind, input.id);
        return detail ?? { error: 'not found' };
      },
    }),
    defineTool({
      name: 'get_snapshot',
      description:
        'Compact snapshot of current state: entities grouped by kind (capped per kind, newest first). Pass kinds to narrow, omit for everything.',
      input: v.object({ kinds: v.optional(v.array(v.string())) }),
      async run({ input }) {
        return { snapshot: await store.snapshot(input.kinds) };
      },
    }),
  ];
}
