# Goals — UX

How a user works the **Goals** bucket (the `G` of GRREAT). This is the
product-facing companion to the engine's typed domain; it names the moves a
user makes on their goals and maps each to the engine primitive behind it.

**Status legend:** ✅ built · 🟡 new (this spec) · ⬜ doc-only (no engine work
yet).

## The pipeline

Goals move along a refinement gradient. Each move is looser on the left,
sharper on the right — you capture messily, cluster loosely, then commit.

```
capture ──▶ consolidate ──▶ refine ──▶ prioritize ──▶ visualize
 (loose)     (DUMB)         (SMART)     (rank)         (see it)
```

The one hard ordering: **consolidate runs before refine.** Consolidation is
DUMB-level grouping (Dream-driven, aspirational); refinement is SMART-level
sharpening (checkable outcomes). Sharpening before you've clustered wastes
work on goals you're about to merge.

---

### 1 · Capture — ✅ built

Put a goal in. Free text, no ceremony.

- **UX:** "Add a goal: write a novel."
- **Engine:** `POST /api/instructions {text}` → `interpret` → `create goal`
  mutation. Goals require an explicit owner and a desired `outcome`; `mode` is
  `project` (drive to done) or `program` (steer a metric).
- **No change.**

### 2 · Consolidate (DUMB) — 🟡 new

Cluster a pile of raw goals under a few **aspirations** — dream-level themes —
and merge near-duplicates. This is grouping, *not* narrowing: outcomes are not
sharpened here.

- **UX:** "Consolidate my goals." → goals get grouped under aspirations like
  *"Become a working writer"*; three overlapping fitness goals collapse into
  one.
- **Engine:**
  - New `aspiration` entity (goals bucket): `{ title, dream, status }`, where
    `dream` is the aspirational statement and `status ∈ open | realized |
    abandoned`. **No owner and no metric** — deliberately looser than a goal;
    the goals under it carry ownership.
  - New `serves` relation: `goal → aspiration`.
  - New `merged-into` relation: `goal → goal`, so a dropped duplicate stays
    traceable to its survivor.
  - New `goals-consolidate` intra-workflow: clusters goals under aspirations
    (`relate … serves`), and for near-duplicates drops the redundant goal
    (`status:'dropped'`), links it `merged-into` the survivor, and records a
    decision-record with rationale. Prompt states explicitly: DUMB grouping,
    do not narrow outcomes.

### 3 · Refine / redefine — ✅ built (prompt tweak)

Sharpen each goal's outcome into something checkable; split conflated goals;
ensure ownership; reframe project↔program as understanding shifts.

- **UX:** "This goal is vague." → outcome becomes a checkable statement.
- **Engine:** existing `goals-refine` intra-workflow, plus the feedback edges
  that redefine goals from evidence — `analysis→goals`, `research→goals`,
  `time→goals`. One-line prompt tweak so `goals-refine` notes it runs *after*
  consolidation (sharpen the goals under an aspiration; don't re-cluster).

### 4 · Prioritize — 🟡 new

Order the active goals. WIP is capped at 5 active goals; prioritization orders
*within* that cap (and informs what to park when you're over it).

- **UX:** "Prioritize my goals." → active goals get ranked 1..n with a recorded
  rationale.
- **Engine:**
  - New optional `rank` field on `GoalSchema` (`number`, 1 = highest).
  - New `goals-prioritize` intra-workflow: proposes a total order over active
    goals via `update … {rank}`, with the reasoning captured as a decision.
  - Soft check (admin-surfaced, like the orphaned-goal check — not a
    write-block): flag duplicate ranks among active goals.

### 5 · Visualize — ⬜ doc-only, not built

See the goal landscape as an **exercise**: aspirations as clusters, goals
ranked within them, on a map or 2×2 (e.g. impact × effort). Intended as an
interactive reflection step, not a static chart.

- **Status:** no engine work in this spec. The engine already emits everything
  a visualization would consume — `serves` clusters and `rank` order — so this
  is a future app-surface feature. There is no user-facing goals app today
  (only `/api/instructions` + the `/admin` inspector), which is why this move
  is deferred rather than built.

---

## Domain changes (summary)

| Change | File | Kind |
|---|---|---|
| `aspiration` entity | `domain/entities/aspiration.ts` + `registry.ts` | new entity |
| `serves` relation (goal→aspiration) | `domain/relations.ts` | new relation |
| `merged-into` relation (goal→goal) | `domain/relations.ts` | new relation |
| `rank?` on Goal | `domain/entities/goals.ts` | field add |
| `goals-consolidate` intra | `orchestrator/catalog.ts` + `workflows/goals-consolidate.ts` + `register-edges.ts` | new workflow (DO class `FlueGoalsConsolidateWorkflow`) |
| `goals-prioritize` intra | `orchestrator/catalog.ts` + `workflows/goals-prioritize.ts` + `register-edges.ts` | new workflow (DO class `FlueGoalsPrioritizeWorkflow`) |
| duplicate-rank soft check | `domain/constraints.ts` | admin-surfaced check |
| migration `v2` | `wrangler.jsonc` | append the two new DO classes (never edit `v1`) |

Adding the two catalog entries auto-extends `INTRA_IDS`, so the interpreter can
dispatch to consolidate/prioritize with no change to the Intent schema. New DO
classes require the `v2` migration entry; the `aspiration` entity does not (it
lives in the `WorkspaceStore` SQLite, not its own DO).
