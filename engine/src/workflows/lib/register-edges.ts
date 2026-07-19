/**
 * Side-effect module: registers every implemented edge/intra workflow with
 * the invoker registry, so the orchestrator can invoke() them by catalog id.
 * Grows one import + register() per workflow.
 */
import { registerWorkflowRef } from './refs.ts';
import analysisToGoals from '../analysis-to-goals.ts';
import analysisToResearch from '../analysis-to-research.ts';
import analysisToRoadmap from '../analysis-to-roadmap.ts';
import executionToResearch from '../execution-to-research.ts';
import executionToRoadmap from '../execution-to-roadmap.ts';
import executionToTime from '../execution-to-time.ts';
import timeToRoadmap from '../time-to-roadmap.ts';
import timeToGoals from '../time-to-goals.ts';
import timeToResearch from '../time-to-research.ts';
import researchToGoals from '../research-to-goals.ts';
import researchToRoadmap from '../research-to-roadmap.ts';
import researchToExecution from '../research-to-execution.ts';
import goalsRefine from '../goals-refine.ts';
import researchSynthesize from '../research-synthesize.ts';
import executionPlanNext from '../execution-plan-next.ts';

registerWorkflowRef('analysis-to-goals', analysisToGoals);
registerWorkflowRef('analysis-to-research', analysisToResearch);
registerWorkflowRef('analysis-to-roadmap', analysisToRoadmap);
registerWorkflowRef('execution-to-research', executionToResearch);
registerWorkflowRef('execution-to-roadmap', executionToRoadmap);
registerWorkflowRef('execution-to-time', executionToTime);
registerWorkflowRef('time-to-roadmap', timeToRoadmap);
registerWorkflowRef('time-to-goals', timeToGoals);
registerWorkflowRef('time-to-research', timeToResearch);
registerWorkflowRef('research-to-goals', researchToGoals);
registerWorkflowRef('research-to-roadmap', researchToRoadmap);
registerWorkflowRef('research-to-execution', researchToExecution);
registerWorkflowRef('goals-refine', goalsRefine);
registerWorkflowRef('research-synthesize', researchSynthesize);
registerWorkflowRef('execution-plan-next', executionPlanNext);
