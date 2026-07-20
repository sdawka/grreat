import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('time-to-roadmap');
export default workflow;
export { runs };
