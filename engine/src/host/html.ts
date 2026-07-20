/** Models and stored data never emit HTML — everything is escaped text. */
export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function pre(value: unknown): string {
  return `<pre>${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · grreat engine</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
         max-width: 72rem; margin: 2rem auto; padding: 0 1rem; }
  h1, h2 { font-weight: 600; }
  a { color: inherit; }
  nav a { margin-right: 1rem; }
  pre { background: rgba(127,127,127,.12); padding: .75rem; border-radius: 6px;
        overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border-bottom: 1px solid rgba(127,127,127,.3); padding: .35rem .5rem;
           text-align: left; vertical-align: top; }
  .warn { color: #b45309; }
  .muted { opacity: .65; }
</style>
</head>
<body>
<nav>
  <a href="/admin">dashboard</a>
  <a href="/admin/entities">entities</a>
  <a href="/admin/relations">relations</a>
  <a href="/admin/workflows">workflows</a>
  <a href="/admin/runs">runs</a>
</nav>
<h1>${escapeHtml(title)}</h1>
${body}
</body>
</html>`;
}
