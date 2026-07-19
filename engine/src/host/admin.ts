import { Hono } from 'hono';
import {
  checkOrphans,
  META_KINDS,
  BUCKET_KINDS,
  type Goal,
  type NextAction,
} from '../domain/index.ts';
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
