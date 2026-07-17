export interface CorePrinciple {
  lead: string;
  note: string;
}

export const corePrinciples: CorePrinciple[] = [
  {
    lead: 'Cyclical, not linear.',
    note: 'Every bucket feeds back into the others; the system learns from each pass instead of running once and stopping.',
  },
  {
    lead: 'Always a next action.',
    note: "There's always something to do. For a project, the next action moves toward completion; for a program, it improves the metric you're steering. When the move isn't obvious, the system offers a choice — never a dead end.",
  },
  {
    lead: 'Surface blockers early.',
    note: 'Make where work is actually stuck visible before planning further ahead. A short, honest picture of what\'s blocked beats a long, speculative queue.',
  },
];
