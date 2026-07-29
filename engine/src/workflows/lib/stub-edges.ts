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

  if (id === 'goals-prioritize') {
    const goals = (await store.list('goal')).filter((g) => g.status === 'active');
    goals.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    const proposedMutations: Mutation[] = goals.map((g, i) => ({
      op: 'update',
      kind: 'goal',
      id: g.id,
      patch: { rank: i + 1 },
    }));
    return {
      proposedMutations,
      rationale: `Stub: ranked ${goals.length} active goal(s) by age (oldest first).`,
      ...(proposedMutations.length
        ? {
            decision: {
              summary: 'Prioritized active goals',
              rationale: 'Stub order: oldest active goal ranks highest.',
            },
          }
        : {}),
    };
  }

  if (id === 'goals-consolidate') {
    const goals = (await store.list('goal')).filter((g) => g.status === 'active');
    const norm = (t: unknown) => String(t).trim().toLowerCase();
    const survivor = new Map<string, (typeof goals)[number]>();
    for (const g of goals) {
      const key = norm(g.title);
      const cur = survivor.get(key);
      if (!cur || String(g.createdAt) < String(cur.createdAt)) survivor.set(key, g);
    }
    const proposedMutations: Mutation[] = [];
    let merges = 0;
    for (const g of goals) {
      const keep = survivor.get(norm(g.title))!;
      if (keep.id === g.id) continue;
      merges += 1;
      proposedMutations.push({ op: 'update', kind: 'goal', id: g.id, patch: { status: 'dropped' } });
      proposedMutations.push({
        op: 'relate',
        relationKind: 'merged-into',
        from: { kind: 'goal', id: g.id },
        to: { kind: 'goal', id: keep.id },
      });
    }
    return {
      proposedMutations,
      rationale: merges
        ? `Stub: merged ${merges} duplicate-title goal(s) into their earliest twin. Thematic aspiration clustering requires the live model.`
        : 'Stub: no duplicate-title goals to merge; aspiration clustering requires the live model.',
      ...(merges
        ? {
            decision: {
              summary: 'Merged duplicate goals',
              rationale: 'Stub: identical titles collapsed to the earliest goal.',
            },
          }
        : {}),
    };
  }

  return {
    proposedMutations: [],
    rationale: `Stub mode: ${id} evaluated "${input.reason}" — no changes proposed without a model.`,
  };
}
