import { defineAgent, defineWorkflow, type WorkflowRouteHandler, type WorkflowRunsHandler } from '@flue/runtime';
import * as v from 'valibot';

export const route: WorkflowRouteHandler = async (_c, next) => next();
export const runs: WorkflowRunsHandler = async (_c, next) => next();

export default defineWorkflow({
  agent: defineAgent(() => ({
    model: 'cloudflare/@cf/meta/llama-3.1-8b-instruct',
  })),
  input: v.object({ name: v.string() }),
  output: v.object({ greeting: v.string() }),
  async run({ input }) {
    return { greeting: `hello ${input.name}` };
  },
});
