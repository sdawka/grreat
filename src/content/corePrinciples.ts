export interface CorePrinciple {
  name: string; // short tab label — the tab row reads "Cyclical · Honest · Action"
  lead: string; // panel headline
  note: string; // panel explanation
}

export const corePrinciples: CorePrinciple[] = [
  {
    name: 'Cyclical',
    lead: 'Cyclical, not linear.',
    note: 'Every bucket feeds back into the others; the system learns from each pass instead of running once and stopping.',
  },
  {
    name: 'Honest',
    lead: 'Trust your gut, but measure your steps.',
    note: "Start by looking honestly at what you want — then where you actually are, and the world around you. That means measuring the things you're not doing and facing where you're blocked, not just the progress that flatters you. Instinct sets the direction; honest measurement keeps the picture true.",
  },
  {
    name: 'Action',
    lead: 'Always a next step.',
    note: "Focus on the next step. A series of next steps gets you further than looking too far ahead — and as long as there's something you want, there's always something you can be doing to move toward it.",
  },
];
