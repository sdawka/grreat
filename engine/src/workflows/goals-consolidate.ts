import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('goals-consolidate');
export default workflow;
export { runs };
