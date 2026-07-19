import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('execution-to-roadmap');
export default workflow;
export { runs };
