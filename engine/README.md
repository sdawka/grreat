# grreat engine

The backend for GRREAT: a typed domain model on Durable Objects plus an
agentic orchestration layer built with [Flue](https://flueframework.com)
(`@flue/runtime`, Cloudflare target). One Worker (`grreat-engine`), separate
from the Astro landing-site Worker.

## Shape

- `src/domain/` — valibot schemas for the six buckets' entity kinds + meta
  (instruction, decision-record, proposal), typed relations, the Mutation
  union, constraint functions. New kind = one schema file + one `register()`.
- `src/store/workspace-store.ts` — one SQLite Durable Object per workspace;
  the single write path (`POST /mutations/apply`) validates, enforces
  constraints (WIP 5, explicit owner, proposal-only structural change), and
  logs every mutation with provenance.
- `src/workflows/` — `interpret` (front door) + 12 feedback-edge and 3 intra
  workflows generated from `src/orchestrator/catalog.ts` via one factory.
  Each becomes a Durable Object class; support code lives in `workflows/lib/`
  (top-level files are discovered as workflows).
- `src/orchestrator/` — Intent schema (the model's entire authority),
  deterministic orchestrator, catalog, stub interpreter for keyless runs.
- `src/app.ts` — Hono entrypoint: `/api/instructions`, `/admin/*`, and the
  mounted Flue routes (`/workflows/*`, `/runs/*`).
- `.claude/agents/flue-expert.md` (repo root) — subagent grounded in the
  bundled Flue docs (`npx flue docs`).

## Flow

`POST /api/instructions {text}` → Instruction entity (provenance root) →
`interpret` workflow → validated Intent → orchestrator applies direct
mutations / records decisions / `invoke()`s edge workflows → every write
lands in the store with `{instructionId, runId, workflowName}` → inspect at
`/admin` (entities, relations, workflow catalog + prompts, runs).

`STUB_MODE=1` (default in `wrangler.jsonc` vars) runs the whole pipeline
deterministically with zero model calls. Set `0` plus `MODEL_INTERPRETER` /
`MODEL_EDGE` (`cloudflare/@cf/...` — keyless via the `AI` binding) for live
interpretation. OpenRouter later = `registerProvider` in `app.ts` + var swap.

## Develop

```sh
npm install
npm test              # node suite + workers-pool (workerd) suite
npm run typecheck
npm run dev           # flue build + wrangler dev on the generated config
echo 'ENGINE_ADMIN_TOKEN=devtoken' > .dev.vars   # admin/api 404 until set
curl -s -X POST localhost:8787/api/instructions \
  -H 'Authorization: Bearer devtoken' -H 'Content-Type: application/json' \
  -d '{"text":"Add a goal: write a novel"}'
open "http://localhost:8787/admin?token=devtoken"
```

Local `wrangler dev` proxies the AI binding and currently breaks streamed
model responses ("Stream ended without finish_reason") — live-model behavior
must be smoke-tested on a deploy; stub mode is unaffected.

## Deploy

```sh
npm run deploy        # flue build && wrangler deploy --config dist/grreat_engine/wrangler.json
npx wrangler secret put ENGINE_ADMIN_TOKEN --name grreat-engine
```

Always deploy the generated `dist/grreat_engine/wrangler.json` (it merges
Flue's DO bindings), never the source `wrangler.jsonc`. Adding a workflow
adds a generated DO class: append a new uniquely-tagged migration entry in
`wrangler.jsonc` — never edit deployed entries.
