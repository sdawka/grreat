import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('analysis-to-goals');
export default workflow;
export { runs };
