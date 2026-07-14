# GRREAT — The Working Edition

Public homepage and waitlist for **GRREAT**: Goals, Research, Roadmap, Execution, Analysis, and Time.

The site is an Astro application deployed as a Cloudflare Worker. The homepage is prerendered; `/api/signup` runs on the Worker and stores normalized email addresses in Cloudflare D1.

## Requirements

- Node.js 22.12+
- npm
- A Cloudflare account for remote D1 and deployment

## Install

```bash
npm install
```

## Test and verify

```bash
npm test
npm run typecheck
npm run build
```

## Local development without D1

```bash
npm run dev
```

Open http://localhost:4321. The site renders normally, but valid signup requests return HTTP `503` until a D1 binding is available. The API never returns a fake signup success when storage is missing.

## Local D1 development

The checked-in `wrangler.toml` uses `database_id = "local-dev"`, which is valid for Wrangler's local database emulator.

Apply migrations locally:

```bash
npm run db:migrate:local
```

Run the Worker locally with D1:

```bash
npm run dev:worker
```

Open the URL printed by Wrangler, normally http://localhost:8787. A first signup returns `200`; submitting the same normalized email again returns `409`.

Inspect local rows without printing them from application logs:

```bash
npx wrangler d1 execute grreat-waitlist --local \
  --command "SELECT id, created_at FROM waitlist ORDER BY id DESC LIMIT 10"
```

## Production D1 setup

Authenticate and create the remote database:

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 create grreat-waitlist
```

Replace `local-dev` in `wrangler.toml` with the returned database ID. Then apply the migration remotely:

```bash
npm run db:migrate:remote
```

## Deploy

```bash
npm run build
npm run deploy
```

After deployment, verify the homepage and API using the Worker URL printed by Wrangler.

## Signup behavior

`POST /api/signup` accepts JSON:

```json
{"email":"person@example.com","website":""}
```

Responses:

- `200` — inserted successfully
- `200` — honeypot filled; silently accepted without storage
- `400` — invalid JSON or email
- `409` — normalized email already exists
- `500` — unexpected storage failure
- `503` — D1 binding is unavailable

Raw email addresses are never written to application logs.

## Architecture

```text
src/
├── components/         Editorial homepage sections and reusable signup form
├── layouts/            SEO and document shell
├── lib/signup.ts       Validation and response helpers
├── pages/index.astro   Public homepage
├── pages/api/signup.ts Worker API route
└── styles/global.css   “The Working Edition” design system
migrations/             D1 schema
public/                  Static social image assets
tests/                   Vitest signup behavior tests
```

## Design language

The page shares the GRREAT vault's **Working Edition** system: warm paper, dense black ink, oversized serif headlines, IBM Plex Sans/Mono, hard editorial rules, numbered folios, a high-contrast yellow NOW panel, and bucket-specific colors for G / R¹ / R² / E / A / T.
