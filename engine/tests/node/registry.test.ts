import { describe, expect, it } from 'vitest';
import {
  createDefaultRegistry,
  DuplicateKindError,
  UnknownKindError,
} from '../../src/domain/registry.ts';
import { GoalSchema } from '../../src/domain/entities/goals.ts';
import type { EntitySchema } from '../../src/domain/registry.ts';

const base = {
  id: '01J00000000000000000000000',
  workspaceId: 'default',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

describe('EntityRegistry', () => {
  it('registers all 15 default kinds', () => {
    const registry = createDefaultRegistry();
    expect(registry.kinds()).toHaveLength(15);
    expect(registry.has('goal')).toBe(true);
    expect(registry.has('instruction')).toBe(true);
  });

  it('parses a valid goal', () => {
    const registry = createDefaultRegistry();
    const goal = registry.parse('goal', {
      ...base,
      kind: 'goal',
      mode: 'project',
      title: 'Write a book',
      outcome: 'A finished manuscript',
      status: 'active',
      owner: { type: 'human', name: 'sahil' },
    });
    expect(goal.kind).toBe('goal');
  });

  it('rejects a goal without an owner', () => {
    const registry = createDefaultRegistry();
    expect(() =>
      registry.parse('goal', {
        ...base,
        kind: 'goal',
        mode: 'project',
        title: 'x',
        outcome: 'y',
        status: 'active',
      }),
    ).toThrow();
  });

  it('defaults omittable array fields to [] (weak models drop them)', () => {
    const registry = createDefaultRegistry();
    const q = registry.parse('research-question', {
      ...base,
      kind: 'research-question',
      question: 'App or tutor?',
      status: 'open',
      // goalIds intentionally omitted
    });
    expect(q['goalIds']).toEqual([]);
    const review = registry.parse('review', {
      ...base,
      kind: 'review',
      subjectRef: { kind: 'goal', id: 'g1' },
      outcomeSummary: 's',
      verdict: 'partial',
      // learnings omitted
    });
    expect(review['learnings']).toEqual([]);
  });

  it('rejects unknown kinds and duplicate registration', () => {
    const registry = createDefaultRegistry();
    expect(() => registry.parse('nope', {})).toThrow(UnknownKindError);
    expect(() => registry.register('goal', GoalSchema as EntitySchema)).toThrow(
      DuplicateKindError,
    );
  });

  it('safeParse reports issues without throwing', () => {
    const registry = createDefaultRegistry();
    const result = registry.safeParse('review', { ...base, kind: 'review' });
    expect(result.success).toBe(false);
  });
});
