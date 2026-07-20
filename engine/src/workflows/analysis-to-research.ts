import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('analysis-to-research');
export default workflow;
export { runs };
