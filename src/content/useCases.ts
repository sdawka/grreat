import type { Bucket } from './buckets';

type BucketId = Bucket['bucket'];

export interface UseCase {
  id: string;
  label: string;
  // One-line flavor per bucket. Keys match Bucket['bucket'] so the carousel can
  // look each bucket's line up by id while the letter/name stay constant.
  flavors: Record<BucketId, string>;
}

// The use-case axis: position 0 is the generic framework (so first paint and the
// no-JS base still teach what each bucket is); the rest reflavor the same six
// buckets for a specific goal, proving the framework generalizes.
export const useCases: UseCase[] = [
  {
    id: 'framework',
    label: 'The framework',
    flavors: {
      goals: 'Define what success looks like.',
      research: 'Gather what you need to know.',
      roadmap: 'Sequence the work.',
      execution: 'The doing — one clear next action.',
      analysis: 'Review outcomes, then feed them back.',
      time: 'Track estimates against actuals.',
    },
  },
  {
    id: 'business',
    label: 'Start a business',
    flavors: {
      goals: "Something that's yours — and it finally pays.",
      research: 'Interview customers; size the market.',
      roadmap: 'MVP first, then customers, then scale.',
      execution: 'Ship the landing page this week.',
      analysis: 'Read the metrics; keep what converts.',
      time: 'Runway vs. burn — know your months.',
    },
  },
  {
    id: 'book',
    label: 'Write a book',
    flavors: {
      goals: 'The book in you, finally out in the world.',
      research: 'Read the field; outline the argument.',
      roadmap: 'Outline, draft, revise, publish.',
      execution: 'Write the next chapter.',
      analysis: "Reread; cut what isn't working.",
      time: 'Words per week vs. the deadline.',
    },
  },
  {
    id: 'fitness',
    label: 'Get in shape',
    flavors: {
      goals: 'Feeling strong and at home in your body.',
      research: 'Learn what training and nutrition work.',
      roadmap: 'Base, then build, then peak.',
      execution: "Do today's workout.",
      analysis: 'Track progress; adjust the plan.',
      time: "Hours you'll train vs. hours you do.",
    },
  },
  {
    id: 'semester',
    label: 'Ace the semester',
    flavors: {
      goals: 'Walking into the exam actually ready.',
      research: 'Map the syllabus; find the best sources.',
      roadmap: 'Plan the term around deadlines and exams.',
      execution: 'Finish this problem set.',
      analysis: 'Review returned work; fix the gaps.',
      time: 'Study hours planned vs. spent.',
    },
  },
  {
    id: 'retire',
    label: 'Retire early',
    flavors: {
      goals: 'Waking up knowing your time is yours.',
      research: 'Learn investing, taxes, and safe withdrawal.',
      roadmap: 'Cut costs, grow income, then coast.',
      execution: "Invest this month's surplus.",
      analysis: 'Check the portfolio; rebalance.',
      time: 'Years to freedom vs. your savings rate.',
    },
  },
];
