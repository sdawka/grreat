export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_kind
  ON entities(workspace_id, kind, created_at);

CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  from_kind TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_kind TEXT NOT NULL,
  to_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_relations_from ON relations(from_kind, from_id);
CREATE INDEX IF NOT EXISTS idx_relations_to ON relations(to_kind, to_id);

CREATE TABLE IF NOT EXISTS mutation_log (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  instruction_id TEXT,
  run_id TEXT,
  workflow TEXT,
  op TEXT NOT NULL,
  payload TEXT NOT NULL,
  result TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mutlog_instruction ON mutation_log(instruction_id);
`;
