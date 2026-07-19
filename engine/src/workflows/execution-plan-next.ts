import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('execution-plan-next');
export default workflow;
export { runs };
