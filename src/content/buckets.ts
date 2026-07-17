export interface Bucket {
  bucket: 'goals' | 'research' | 'roadmap' | 'execution' | 'analysis' | 'time';
  letter: string;
  name: string;
  desc: string;
}

// Field name is `bucket` (not `key`) so BucketExplainer can spread each entry
// straight onto BucketCard's identically-named prop.
export const buckets: Bucket[] = [
  {
    bucket: 'goals',
    letter: 'G',
    name: 'Goals',
    desc: 'Define what success looks like. A goal runs as a project (driven to completion) or a program (steered for consistent improvement on a metric) — both with revisable desired outcomes that evolve as analysis feeds back.',
  },
  {
    bucket: 'research',
    letter: 'R¹',
    name: 'Research',
    desc: 'Gather what you need to know. When execution hits a blocker, research re-engages to unblock it.',
  },
  {
    bucket: 'roadmap',
    letter: 'R²',
    name: 'Roadmap',
    desc: 'Sequence the work. When scope drifts, the roadmap adjusts — never mid-sprint.',
  },
  {
    bucket: 'execution',
    letter: 'E',
    name: 'Execution',
    desc: 'The doing. Every active project has a clear primary next action and an explicit owner.',
  },
  {
    bucket: 'analysis',
    letter: 'A',
    name: 'Analysis',
    desc: 'Review outcomes. Analysis feeds back into Goals, Research, and Roadmap — the engine of the cycle.',
  },
  {
    bucket: 'time',
    letter: 'T',
    name: 'Time',
    desc: 'Track estimates vs actuals. When estimates mismatch, execution feeds back to recalibrate.',
  },
];
