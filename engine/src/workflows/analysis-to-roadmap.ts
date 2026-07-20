import { createEdgeWorkflow } from './lib/edge-workflow.ts';

const { workflow, runs } = createEdgeWorkflow('analysis-to-roadmap');
export default workflow;
export { runs };
