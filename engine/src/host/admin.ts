import { getRun, listRuns } from '@flue/runtime';
import { Hono } from 'hono';
import {
  checkOrphans,
  META_KINDS,
  BUCKET_KINDS,
  type Goal,
  type NextAction,
} from '../domain/index.ts';
import { catalogEntry, WORKFLOW_CATALOG } from '../orchestrator/catalog.ts';
import { interpreterInstructions } from '../orchestrator/instructions.ts';
import { getStore, type StoredEntity } from '../store/store-client.ts';
import { requireToken } from './auth.ts';
import type { EngineEnv } from './env.ts';
import { escapeHtml, layout, pre } from './html.ts';

export const admin = new Hono<{ Bindings: EngineEnv }>();

admin.use('*', requireToken);

const ALL_KINDS = [...Object.values(BUCKET_KINDS).flat(), ...META_KINDS];

function entityLink(kind: string, id: string): string {
  return `<a href="/admin/entities/${escapeHtml(kind)}/${escapeHtml(id)}">${escapeHtml(id)}</a>`;
}

admin.get('/', async (c) => {
  const store = getStore(c.env);
  const [stats, goals, actions, instructions] = await Promise.all([
    store.stats(),
    store.list('goal'),
    store.list('next-action'),
    store.list('instruction', 10),
  ]);
  const orphans = checkOrphans(goals as unknown as Goal[], actions as unknown as NextAction[]);
  const activeGoals = goals.filter((g) => g.status === 'active').length;

  const countRows = stats.counts
    .map(
      (row) =>
        `<tr><td><a href="/admin/entities/${escapeHtml(row.kind)}">${escapeHtml(row.kind)}</a></td><td>${row.n}</td></tr>`,
    )
    .join('');
  const violations = [
    ...(activeGoals > 5
      ? [`<li class="warn">WIP limit exceeded: ${activeGoals} active goals (max 5)</li>`]
      : []),
    ...orphans.map((violation) => `<li class="warn">${escapeHtml(violation.message)}</li>`),
  ];
  const instructionRows = instructions
    .map(
      (ins) =>
        `<tr><td>${entityLink('instruction', ins.id)}</td><td>${escapeHtml(ins.status)}</td><td>${escapeHtml(String(ins['text']).slice(0, 90))}</td><td class="muted">${escapeHtml(ins.createdAt)}</td></tr>`,
    )
    .join('');

  return c.html(
    layout(
      'dashboard',
      `
<h2>entity counts</h2>
<table><tr><th>kind</th><th>count</th></tr>${countRows || '<tr><td colspan="2" class="muted">empty</td></tr>'}</table>
<p class="muted">${stats.relationCount} relations · ${stats.logCount} mutation-log rows · ${activeGoals}/5 WIP</p>
<h2>constraint violations</h2>
${violations.length ? `<ul>${violations.join('')}</ul>` : '<p class="muted">none</p>'}
<h2>recent instructions</h2>
<table><tr><th>id</th><th>status</th><th>text</th><th>received</th></tr>${instructionRows || '<tr><td colspan="4" class="muted">none yet</td></tr>'}</table>`,
    ),
  );
});

admin.get('/entities', (c) => {
  const items = ALL_KINDS.map(
    (kind) => `<li><a href="/admin/entities/${escapeHtml(kind)}">${escapeHtml(kind)}</a></li>`,
  ).join('');
  return c.html(layout('entities', `<ul>${items}</ul>`));
});

admin.get('/entities/:kind', async (c) => {
  const kind = c.req.param('kind');
  const store = getStore(c.env);
  const entities = await store.list(kind);
  const rows = entities
    .map(
      (entity) =>
        `<tr><td>${entityLink(kind, entity.id)}</td><td>${pre(entity)}</td></tr>`,
    )
    .join('');
  return c.html(
    layout(
      `${kind} (${entities.length})`,
      `<table><tr><th>id</th><th>raw</th></tr>${rows || '<tr><td colspan="2" class="muted">empty</td></tr>'}</table>`,
    ),
  );
});

admin.get('/entities/:kind/:id', async (c) => {
  const { kind, id } = c.req.param();
  const store = getStore(c.env);
  const detail = await store.get(kind, id);
  if (!detail) return c.html(layout('not found', '<p>no such entity</p>'), 404);

  const relationRow = (relation: { kind: string; from: { kind: string; id: string }; to: { kind: string; id: string } }) =>
    `<tr><td>${escapeHtml(relation.kind)}</td><td>${escapeHtml(relation.from.kind)} ${entityLink(relation.from.kind, relation.from.id)}</td><td>→</td><td>${escapeHtml(relation.to.kind)} ${entityLink(relation.to.kind, relation.to.id)}</td></tr>`;

  let provenanceSection = '';
  if (kind === 'instruction') {
    const log = await store.provenance(id);
    const rows = log
      .map(
        (row) =>
          `<tr><td>${escapeHtml(row.workflow ?? '—')}</td><td>${escapeHtml(row.op)}</td><td>${row.result.applied ? 'applied' : `<span class="warn">${escapeHtml(row.result.error?.code ?? 'failed')}</span>`}</td><td>${row.result.id && row.result.kind ? entityLink(row.result.kind, row.result.id) : '—'}</td><td class="muted">${escapeHtml(row.runId ?? '')}</td></tr>`,
      )
      .join('');
    provenanceSection = `<h2>everything this instruction caused</h2>
<table><tr><th>workflow</th><th>op</th><th>result</th><th>entity</th><th>run</th></tr>${rows || '<tr><td colspan="5" class="muted">no mutations yet</td></tr>'}</table>`;
  } else {
    const provenance = detail.entity.provenance as
      | { instructionId?: string; runId?: string; workflowName?: string }
      | undefined;
    if (provenance?.instructionId) {
      provenanceSection = `<h2>provenance</h2><p>caused by instruction ${entityLink('instruction', provenance.instructionId)}${provenance.workflowName ? ` via <code>${escapeHtml(provenance.workflowName)}</code>` : ''}${provenance.runId ? ` (run <a href="/admin/runs/${escapeHtml(provenance.runId)}">${escapeHtml(provenance.runId)}</a>)` : ''}</p>`;
    }
  }

  return c.html(
    layout(
      `${kind} · ${id}`,
      `${pre(detail.entity)}
<h2>relations</h2>
<table>${[...detail.relations.outgoing, ...detail.relations.incoming].map(relationRow).join('') || '<tr><td class="muted">none</td></tr>'}</table>
${provenanceSection}`,
    ),
  );
});

const EDGE_IO_DOC = `input  = { instructionId, instructionText, reason }
output = { applied: number, failed: number, rationale: string }
model contract (EdgeOutput) = { proposedMutations: Mutation[], rationale, decision? }`;

admin.get('/workflows', (c) => {
  const rows = WORKFLOW_CATALOG.map(
    (entry) =>
      `<tr><td><a href="/admin/workflows/${escapeHtml(entry.id)}">${escapeHtml(entry.id)}</a></td><td>${escapeHtml(entry.type)}</td><td>${escapeHtml(entry.type === 'edge' ? `${entry.from} → ${entry.to}` : (entry.bucket ?? ''))}</td><td>${escapeHtml(entry.trigger)}</td></tr>`,
  ).join('');
  return c.html(
    layout(
      'workflows',
      `<p class="muted">The links between and within buckets. <a href="/admin/workflows/interpret">interpret</a> is the front door; the rest fire from its intent.</p>
<table><tr><th>workflow</th><th>type</th><th>link</th><th>fires when</th></tr>
<tr><td><a href="/admin/workflows/interpret">interpret</a></td><td>front door</td><td>instruction → intent</td><td>Every stored instruction.</td></tr>
${rows}</table>`,
    ),
  );
});

admin.get('/workflows/:id', (c) => {
  const id = c.req.param('id');
  if (id === 'interpret') {
    return c.html(
      layout(
        'interpret',
        `<p>The front-door workflow: turns one stored Instruction into a validated Intent, then deterministic code applies mutations and fans out to edge workflows.</p>
<h2>input / output</h2><pre>input  = { instructionId, text }
output = { intent: Intent, dispatched: [{workflow, runId}], skipped: string[] }</pre>
<h2>system instructions (given to the model)</h2>${pre(interpreterInstructions())}`,
      ),
    );
  }
  const entry = catalogEntry(id);
  if (!entry) return c.html(layout('not found', '<p>no such workflow</p>'), 404);
  return c.html(
    layout(
      entry.id,
      `<p><strong>${escapeHtml(entry.title)}</strong> · ${escapeHtml(entry.type)}</p>
<p>fires when: ${escapeHtml(entry.trigger)}</p>
<h2>input / output</h2><pre>${escapeHtml(EDGE_IO_DOC)}</pre>
<h2>task prompt (over a snapshot of: ${escapeHtml(entry.contextKinds.join(', '))})</h2>
${pre(entry.prompt)}`,
    ),
  );
});

admin.get('/runs', async (c) => {
  try {
    const { runs } = await listRuns({ limit: 100 });
    const rows = runs
      .map(
        (run) =>
          `<tr><td><a href="/admin/runs/${escapeHtml(run.runId)}">${escapeHtml(run.runId)}</a></td><td><a href="/admin/workflows/${escapeHtml(run.workflowName)}">${escapeHtml(run.workflowName)}</a></td><td>${run.isError ? '<span class="warn">error</span>' : escapeHtml(run.status)}</td><td class="muted">${escapeHtml(run.startedAt)}</td><td class="muted">${run.durationMs ?? ''}ms</td></tr>`,
      )
      .join('');
    return c.html(
      layout(
        `runs (${runs.length})`,
        `<table><tr><th>run</th><th>workflow</th><th>status</th><th>started</th><th>duration</th></tr>${rows || '<tr><td colspan="5" class="muted">none yet</td></tr>'}</table>`,
      ),
    );
  } catch (error) {
    return c.html(layout('runs', `<p class="warn">run store unavailable: ${escapeHtml(String(error))}</p>`));
  }
});

admin.get('/runs/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const record = await getRun(id);
    if (!record) return c.html(layout('not found', '<p>no such run</p>'), 404);
    const input = record.input as { instructionId?: string } | undefined;
    const instructionLink = input?.instructionId
      ? `<p>instruction: ${entityLink('instruction', input.instructionId)}</p>`
      : '';
    return c.html(
      layout(
        `run · ${id}`,
        `<p><a href="/admin/workflows/${escapeHtml(record.workflowName)}">${escapeHtml(record.workflowName)}</a> · ${record.isError ? '<span class="warn">error</span>' : escapeHtml(record.status)} · ${record.durationMs ?? '?'}ms</p>
${instructionLink}
<h2>input</h2>${pre(record.input)}
<h2>${record.isError ? 'error' : 'result'}</h2>${pre(record.isError ? record.error : record.result)}`,
      ),
    );
  } catch (error) {
    return c.html(layout('run', `<p class="warn">run store unavailable: ${escapeHtml(String(error))}</p>`));
  }
});

/** Raw provenance chain as JSON — payloads, results, error messages. */
admin.get('/provenance/:instructionId', async (c) => {
  const store = getStore(c.env);
  const log = await store.provenance(c.req.param('instructionId'));
  return c.json({ log });
});

admin.get('/relations', async (c) => {
  const store = getStore(c.env);
  const relations = await store.listRelations();
  const rows = relations
    .map(
      (relation) =>
        `<tr><td>${escapeHtml(relation.kind)}</td><td>${escapeHtml(relation.from.kind)} ${entityLink(relation.from.kind, relation.from.id)}</td><td>→</td><td>${escapeHtml(relation.to.kind)} ${entityLink(relation.to.kind, relation.to.id)}</td><td class="muted">${escapeHtml(relation.createdAt)}</td></tr>`,
    )
    .join('');
  return c.html(
    layout(
      `relations (${relations.length})`,
      `<table><tr><th>kind</th><th>from</th><th></th><th>to</th><th>created</th></tr>${rows || '<tr><td colspan="5" class="muted">none</td></tr>'}</table>`,
    ),
  );
});
