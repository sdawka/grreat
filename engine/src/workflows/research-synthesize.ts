import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('research-synthesize');
export default workflow;
export { runs };
