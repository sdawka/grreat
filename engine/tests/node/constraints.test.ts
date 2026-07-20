import { describe, expect, it } from 'vitest';
import {
  checkOrphans,
  checkOwnership,
  checkWipLimit,
  isStructuralChange,
} from '../../src/domain/constraints.ts';
import type { Goal } from '../../src/domain/entities/goals.ts';
import type { NextAction } from '../../src/domain/entities/execution.ts';
import type { Mutation } from '../../src/domain/mutations.ts';

const base = {
  id: 'g',
  workspaceId: 'default',
  createdAt: '2026-07-19T00:00:00.000Z',
  updatedAt: '2026-07-19T00:00:00.000Z',
};

function goal(id: string, status: Goal['status'] = 'active'): Goal {
  return {
    ...base,
    id,
    kind: 'goal',
    mode: 'project',
    title: `goal ${id}`,
    outcome: 'done',
    status,
    owner: { type: 'human', name: 'sahil' },
  } as Goal;
}

function action(id: string, goalId: string, isPrimary = true): NextAction {
  return {
    ...base,
    id,
    kind: 'next-action',
    description: 'do it',
    goalId,
    owner: { type: 'ai', name: 'hermes' },
    isPrimary,
    status: 'todo',
  } as NextAction;
}

describe('checkWipLimit', () => {
  it('allows up to 5 active goals', () => {
    const creates: Mutation[] = [
      { op: 'create', kind: 'goal', data: { status: 'active' } },
    ];
    expect(checkWipLimit(creates, ['a', 'b', 'c', 'd'])).toBeNull();
  });

  it('rejects a 6th active goal', () => {
    const creates: Mutation[] = [
      { op: 'create', kind: 'goal', data: { status: 'active' } },
    ];
    const violation = checkWipLimit(creates, ['a', 'b', 'c', 'd', 'e']);
    expect(violation?.code).toBe('wip-limit');
  });

  it('parking an existing goal frees a slot in the same batch', () => {
    const batch: Mutation[] = [
      { op: 'update', kind: 'goal', id: 'a', patch: { status: 'parked' } },
      { op: 'create', kind: 'goal', data: { status: 'active' } },
    ];
    expect(checkWipLimit(batch, ['a', 'b', 'c', 'd', 'e'])).toBeNull();
  });
});

describe('checkOwnership', () => {
  it('rejects goal creation without owner', () => {
    const m: Mutation = { op: 'create', kind: 'goal', data: { title: 'x' } };
    expect(checkOwnership(m)?.code).toBe('no-owner');
  });

  it('accepts next-action with owner; ignores other kinds', () => {
    expect(
      checkOwnership({
        op: 'create',
        kind: 'next-action',
        data: { owner: { type: 'ai', name: 'hermes' } },
      }),
    ).toBeNull();
    expect(checkOwnership({ op: 'create', kind: 'finding', data: {} })).toBeNull();
  });
});

describe('checkOrphans', () => {
  it('flags active goals with no primary next action', () => {
    const violations = checkOrphans([goal('g1'), goal('g2', 'parked')], [action('a1', 'g3')]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.subjects).toEqual(['g1']);
  });

  it('is satisfied by an open primary action', () => {
    expect(checkOrphans([goal('g1')], [action('a1', 'g1')])).toHaveLength(0);
  });
});

describe('isStructuralChange', () => {
  it('detects structural asks', () => {
    expect(isStructuralChange('please add a bucket for finances')).toBe(true);
    expect(isStructuralChange('change the WIP limit to 10')).toBe(true);
  });

  it('ignores ordinary content changes', () => {
    expect(isStructuralChange('add a goal to run a marathon')).toBe(false);
  });
});
