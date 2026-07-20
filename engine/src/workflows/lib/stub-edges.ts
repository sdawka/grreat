import type { Goal, Mutation, NextAction } from '../../domain/index.ts';
import type { StorePort } from '../../store/store-client.ts';
import type { EdgeInput, EdgeOutput } from './shared.ts';

/**
 * Deterministic stub outputs so the full fan-out pipeline runs offline.
 * Two workflows have real (deterministic, state-reading) logic because the
 * e2e path exercises them; the rest are no-ops with a rationale.
 */
export async function stubEdgeOutput(
  id: string,
  input: EdgeInput,
  store: StorePort,
): Promise<EdgeOutput> {
  if (id === 'execution-plan-next') {
    const [goals, actions] = await Promise.all([store.list('goal'), store.list('next-action')]);
    const active = goals.filter((g) => g.status === 'active') as unknown as Goal[];
    const open = actions.filter((a) => a.status !== 'done') as unknown as NextAction[];
    const orphaned = active.filter(
      (goal) => !open.some((action) => action.goalId === goal.id && action.isPrimary),
    );
    const proposedMutations: Mutation[] = orphaned.map((goal) => ({
      op: 'create',
      kind: 'next-action',
      data: {
        description: `Define the first concrete step for "${goal.title}"`,
        goalId: goal.id,
        owner: { type: 'ai', name: 'engine' },
        isPrimary: true,
        status: 'todo',
      },
    }));
    return {
      proposedMutations,
      rationale: orphaned.length
        ? `Stub repair: created a primary next action for ${orphaned.length} orphaned goal(s).`
        : 'Stub: no orphaned goals; nothing to repair.',
    };
  }

  if (id === 'execution-to-research') {
    return {
      proposedMutations: [
        {
          op: 'create',
          kind: 'research-question',
          data: {
            question: `What must be learned to unblock: "${input.instructionText.slice(0, 140)}"`,
            status: 'open',
            goalIds: [],
          },
        },
      ],
      rationale: 'Stub: surfaced the reported blocker as an open research question.',
    };
  }

  return {
    proposedMutations: [],
    rationale: `Stub mode: ${id} evaluated "${input.reason}" — no changes proposed without a model.`,
  };
}
