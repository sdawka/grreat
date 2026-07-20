import type { Goal } from './entities/goals.ts';
import type { NextAction } from './entities/execution.ts';
import type { Mutation } from './mutations.ts';

/** "WIP max 5. Focus is enforced, not encouraged." */
export const WIP_LIMIT = 5;

export interface ConstraintViolation {
  code: 'wip-limit' | 'no-owner' | 'orphaned-goal';
  message: string;
  /** Ids of the offending entities/mutations, where known. */
  subjects: string[];
}

/**
 * Would this batch push the number of active goals past the WIP limit?
 * `existingActive` is the count of currently active goals NOT touched by the batch.
 */
export function checkWipLimit(
  mutations: Mutation[],
  existingActiveGoalIds: readonly string[],
): ConstraintViolation | null {
  const active = new Set(existingActiveGoalIds);
  let pendingCreates = 0;
  for (const m of mutations) {
    if (m.op === 'create' && m.kind === 'goal') {
      if ((m.data as { status?: string }).status === 'active') pendingCreates += 1;
    } else if (m.op === 'update' && m.kind === 'goal') {
      const status = (m.patch as { status?: string }).status;
      if (status === 'active') active.add(m.id);
      else if (status !== undefined) active.delete(m.id);
    }
  }
  const total = active.size + pendingCreates;
  if (total > WIP_LIMIT) {
    return {
      code: 'wip-limit',
      message: `Batch would result in ${total} active goals; WIP limit is ${WIP_LIMIT}. Park or finish a goal first.`,
      subjects: [...active],
    };
  }
  return null;
}

/** Goals and next actions must carry an explicit owner on creation. */
export function checkOwnership(mutation: Mutation): ConstraintViolation | null {
  if (mutation.op !== 'create') return null;
  if (mutation.kind !== 'goal' && mutation.kind !== 'next-action') return null;
  const owner = (mutation.data as { owner?: { name?: string } }).owner;
  if (!owner || !owner.name) {
    return {
      code: 'no-owner',
      message: `A ${mutation.kind} requires an explicit owner (human or AI). Shared responsibility is abdicated responsibility.`,
      subjects: [],
    };
  }
  return null;
}

/**
 * "No orphaned projects": every active goal has a primary next action, or a
 * decision record explaining why it is parked. Batch-level health check —
 * surfaced in admin and repaired by the execution-plan-next workflow, not a
 * hard write-block (a goal is legitimately actionless between two creates).
 */
export function checkOrphans(
  goals: readonly Goal[],
  actions: readonly NextAction[],
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  for (const goal of goals) {
    if (goal.status !== 'active') continue;
    const hasPrimary = actions.some(
      (a) => a.goalId === goal.id && a.isPrimary && a.status !== 'done',
    );
    if (!hasPrimary) {
      violations.push({
        code: 'orphaned-goal',
        message: `Active goal "${goal.title}" has no primary next action.`,
        subjects: [goal.id],
      });
    }
  }
  return violations;
}

/**
 * Structural changes — anything not expressible as the Mutation union, such as
 * new buckets, changed constraints, or altered feedback rules — must go
 * through a Proposal. Mutations already only express content changes, so this
 * classifies free-text asks from the interpreter.
 */
export function isStructuralChange(text: string): boolean {
  return /\b(new bucket|add(ing)? a bucket|change (the )?(constraint|wip|feedback rule)|remove (the )?(constraint|bucket)|alter (the )?(system|method|feedback))\b/i.test(
    text,
  );
}
