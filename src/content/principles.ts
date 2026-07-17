export interface Principle {
  lead: string;
  note: string;
}

export const principles: Principle[] = [
  {
    lead: 'Exactly one next action.',
    note: 'Every active project has a single primary next action. No ambiguity about what comes next.',
  },
  {
    lead: 'Explicit owner.',
    note: 'Every project and every next action has a named owner — either a human or an AI agent. Shared responsibility is abdicated responsibility.',
  },
  {
    lead: 'WIP max 5.',
    note: 'No more than five active projects at a time. Focus is enforced, not encouraged.',
  },
  {
    lead: 'Queue max 3.',
    note: 'The waiting queue is capped at three items. If it overflows, prioritize or archive.',
  },
  {
    lead: 'No orphaned projects.',
    note: 'Every project either has a next action or a decision record explaining why it is parked.',
  },
  {
    lead: 'Proposal-only changes.',
    note: 'Structural changes (adding a bucket, changing a constraint, altering a feedback rule) require a written proposal and review. No ad-lib changes to the system.',
  },
];
