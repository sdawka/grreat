import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('research-to-roadmap');
export default workflow;
export { runs };
