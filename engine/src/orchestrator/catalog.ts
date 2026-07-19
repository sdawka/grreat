import type { BucketId } from '../domain/buckets.ts';

/**
 * The workflow catalog — the links between and within buckets, straight from
 * the landing page's feedback-loop copy. Single source of truth for the
 * interpreter's dispatch vocabulary, each workflow's prompt, and the admin
 * catalog page. Adding an edge = one entry here + one workflow file.
 */
export interface WorkflowCatalogEntry {
  id: string;
  type: 'edge' | 'intra';
  from?: BucketId;
  to?: BucketId;
  bucket?: BucketId;
  title: string;
  /** When the interpreter should fire it — the site's own copy. */
  trigger: string;
  /** Task prompt given to the workflow's model over the state snapshot. */
  prompt: string;
  /** Entity kinds included in the snapshot context. */
  contextKinds: string[];
}

const GOALS = ['goal'];
const RESEARCH = ['research-question', 'finding'];
const ROADMAP = ['roadmap-item', 'milestone', 'sprint'];
const EXECUTION = ['next-action', 'execution-log', 'working-session'];
const ANALYSIS = ['review'];
const TIME = ['estimate', 'time-entry'];

export const EDGE_CATALOG: readonly WorkflowCatalogEntry[] = [
  {
    id: 'analysis-to-goals',
    type: 'edge',
    from: 'analysis',
    to: 'goals',
    title: 'Analysis → Goals',
    trigger: 'Did we achieve what we set out to? Revise objectives.',
    prompt:
      'Given the recent reviews and the current goals, judge whether we achieved what we set out to. Propose revisions to goal outcomes and statuses: mark done, drop, reframe between project and program, or revise the desired outcome. Respect the WIP limit of 5 active goals — parking a goal requires a decision with rationale.',
    contextKinds: [...ANALYSIS, ...GOALS],
  },
  {
    id: 'analysis-to-research',
    type: 'edge',
    from: 'analysis',
    to: 'research',
    title: 'Analysis → Research',
    trigger: 'What did we learn that changes what we need to know?',
    prompt:
      'From the learnings in recent reviews, work out what we now need to know: open new research questions, mark answered ones, and record findings that changed the picture, linked to the questions they answer.',
    contextKinds: [...ANALYSIS, ...RESEARCH, ...GOALS],
  },
  {
    id: 'analysis-to-roadmap',
    type: 'edge',
    from: 'analysis',
    to: 'roadmap',
    title: 'Analysis → Roadmap',
    trigger: 'Does the evidence change the sequence of work?',
    prompt:
      'Compare review evidence against the current roadmap sequence. Propose reordering, cutting, or adding roadmap items where the evidence warrants it. Never touch items inside an active sprint — the roadmap adjusts, never mid-sprint.',
    contextKinds: [...ANALYSIS, ...ROADMAP],
  },
  {
    id: 'execution-to-research',
    type: 'edge',
    from: 'execution',
    to: 'research',
    title: 'Execution → Research',
    trigger: 'Blocked? Surface what you need to learn next.',
    prompt:
      'For each blocked next action, surface the unknown behind the blocker as a research question linked to the affected goal. Do not unblock by guessing — name what must be learned.',
    contextKinds: [...EXECUTION, ...RESEARCH, ...GOALS],
  },
  {
    id: 'execution-to-roadmap',
    type: 'edge',
    from: 'execution',
    to: 'roadmap',
    title: 'Execution → Roadmap',
    trigger: "Scope wrong? Propose a structural change, don't ad-lib.",
    prompt:
      'Execution has revealed the scope is wrong. For safe content changes, propose resequencing or re-scoping roadmap items outside active sprints. For anything structural, emit a propose mutation describing the change for review — never ad-lib structural change.',
    contextKinds: [...EXECUTION, ...ROADMAP],
  },
  {
    id: 'execution-to-time',
    type: 'edge',
    from: 'execution',
    to: 'time',
    title: 'Execution → Time',
    trigger: 'Estimate mismatch? Feed back actuals to recalibrate.',
    prompt:
      'From execution logs and working sessions, record time entries against the items worked, and flag where actuals diverge from estimates so future estimates recalibrate.',
    contextKinds: [...EXECUTION, ...TIME, ...ROADMAP],
  },
  {
    id: 'time-to-roadmap',
    type: 'edge',
    from: 'time',
    to: 'roadmap',
    title: 'Time → Roadmap',
    trigger: 'Actuals drifting from estimates? Recalibrate the sequence ahead.',
    prompt:
      'Actuals are drifting from estimates. Recalibrate the sequence ahead: reorder, split, or re-estimate upcoming roadmap items so the plan reflects observed pace. Do not modify active-sprint items.',
    contextKinds: [...TIME, ...ROADMAP],
  },
  {
    id: 'time-to-goals',
    type: 'edge',
    from: 'time',
    to: 'goals',
    title: 'Time → Goals',
    trigger: 'Chronic overrun? Re-check whether the goal is scoped right.',
    prompt:
      'A goal shows chronic overrun. Question its scoping: propose revising the desired outcome, converting between project and program, or parking with a recorded decision.',
    contextKinds: [...TIME, ...GOALS, ...ROADMAP],
  },
  {
    id: 'time-to-research',
    type: 'edge',
    from: 'time',
    to: 'research',
    title: 'Time → Research',
    trigger: 'Stuck on unknowns? Name what to learn to move faster.',
    prompt:
      'Slow progress is rooted in unknowns. Name what must be learned to move faster as concrete research questions linked to the affected goals.',
    contextKinds: [...TIME, ...RESEARCH, ...GOALS],
  },
  {
    id: 'research-to-goals',
    type: 'edge',
    from: 'research',
    to: 'goals',
    title: 'Research → Goals',
    trigger: 'A finding changes the stakes? Reframe what success means.',
    prompt:
      'A finding changes the stakes. Reframe what success means: revise goal outcomes or metrics accordingly and record the decision with its rationale.',
    contextKinds: [...RESEARCH, ...GOALS],
  },
  {
    id: 'research-to-roadmap',
    type: 'edge',
    from: 'research',
    to: 'roadmap',
    title: 'Research → Roadmap',
    trigger: 'Harder than scoped? Resequence around what you learned.',
    prompt:
      'Findings show the work is harder or easier than scoped. Resequence the roadmap around what was learned: reorder, split, add, or cut items outside active sprints.',
    contextKinds: [...RESEARCH, ...ROADMAP],
  },
  {
    id: 'research-to-execution',
    type: 'edge',
    from: 'research',
    to: 'execution',
    title: 'Research → Execution',
    trigger: 'Found a better path? Hand execution the change, not a surprise.',
    prompt:
      'Research found a better path. Hand execution the change, not a surprise: update or replace next actions with clear rationale, keeping every action owned and exactly one primary action per goal.',
    contextKinds: [...RESEARCH, ...EXECUTION, ...GOALS],
  },
];

export const INTRA_CATALOG: readonly WorkflowCatalogEntry[] = [
  {
    id: 'goals-refine',
    type: 'intra',
    bucket: 'goals',
    title: 'Goals · refine',
    trigger: 'A goal is vague, unowned, or conflates several outcomes.',
    prompt:
      'Clarify the goals: split conflated goals, set project vs program mode, sharpen the desired outcome into something checkable, and ensure every goal has an explicit owner. Respect the WIP limit of 5.',
    contextKinds: GOALS,
  },
  {
    id: 'research-synthesize',
    type: 'intra',
    bucket: 'research',
    title: 'Research · synthesize',
    trigger: 'Findings have accumulated against open questions.',
    prompt:
      'Synthesize accumulated findings: mark research questions answered where the evidence suffices, link findings to the questions they answer, and surface implications.',
    contextKinds: RESEARCH,
  },
  {
    id: 'execution-plan-next',
    type: 'intra',
    bucket: 'execution',
    title: 'Execution · plan next',
    trigger: 'An active goal has no primary next action (orphaned project).',
    prompt:
      'Repair orphaned projects: every active goal must have exactly one primary next action with an explicit owner, or a proposal to park it with a recorded decision. Create the missing next actions.',
    contextKinds: [...EXECUTION, ...GOALS],
  },
];

export const WORKFLOW_CATALOG: readonly WorkflowCatalogEntry[] = [
  ...EDGE_CATALOG,
  ...INTRA_CATALOG,
];

export const EDGE_IDS = EDGE_CATALOG.map((entry) => entry.id) as [string, ...string[]];
export const INTRA_IDS = INTRA_CATALOG.map((entry) => entry.id) as [string, ...string[]];

export function catalogEntry(id: string): WorkflowCatalogEntry | undefined {
  return WORKFLOW_CATALOG.find((entry) => entry.id === id);
}
