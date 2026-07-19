import { isStructuralChange } from '../domain/constraints.ts';
import type { Intent } from './intent.ts';

/**
 * Deterministic keyword interpreter — the keyless path (smalltalk's FakeBrain
 * analog). Lets the full pipeline (instruction → intent → mutations →
 * provenance) run end-to-end in CI and STUB_MODE with zero model calls.
 */
export function fakeInterpret(text: string): Intent {
  if (isStructuralChange(text)) {
    return {
      classification: 'instruction',
      buckets: [],
      directMutations: [
        {
          op: 'propose',
          description: text,
          rationale: 'Structural change requested; proposal-only per the constraints.',
        },
      ],
      edgeTriggers: [],
      intraTriggers: [],
      decision: {
        summary: 'Routed structural change to a proposal',
        rationale: 'No ad-lib changes to the system.',
      },
    };
  }

  const goalMatch = text.match(/(?:add|create|new)\s+(?:a\s+)?goal[:\s]+(.{3,120})/i);
  if (goalMatch) {
    const title = goalMatch[1]!.trim().replace(/[.!?]$/, '');
    return {
      classification: 'instruction',
      buckets: ['goals', 'execution'],
      directMutations: [
        {
          op: 'create',
          kind: 'goal',
          data: {
            mode: /\b(habit|improve|consistent|maintain)\b/i.test(text) ? 'program' : 'project',
            title,
            outcome: title,
            status: 'active',
            owner: { type: 'human', name: 'user' },
          },
        },
      ],
      edgeTriggers: [],
      intraTriggers: [{ workflow: 'execution-plan-next', reason: 'New goal needs a primary next action.' }],
    };
  }

  if (/\b(blocked|stuck)\b/i.test(text)) {
    return {
      classification: 'instruction',
      buckets: ['execution', 'research'],
      edgeTriggers: [
        { edge: 'execution-to-research', reason: 'Execution reported a blocker.' },
      ],
      intraTriggers: [],
    };
  }

  if (/\b(finished|completed|done|shipped|review)\b/i.test(text)) {
    return {
      classification: 'instruction',
      buckets: ['analysis', 'goals'],
      edgeTriggers: [
        { edge: 'analysis-to-goals', reason: 'Work completed; review outcomes against objectives.' },
      ],
      intraTriggers: [],
    };
  }

  if (/\b(took|spent|hours?|minutes?|overrun|estimate)\b/i.test(text)) {
    return {
      classification: 'instruction',
      buckets: ['time'],
      edgeTriggers: [
        { edge: 'execution-to-time', reason: 'Time actuals reported.' },
      ],
      intraTriggers: [],
    };
  }

  return {
    classification: 'question',
    buckets: [],
    answer:
      'Stub mode: no model configured. Your instruction was stored; ask about goals, report blockers, or add a goal to see the pipeline move.',
    edgeTriggers: [],
    intraTriggers: [],
  };
}
