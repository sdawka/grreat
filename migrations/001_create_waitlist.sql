-- Migration: Create waitlist table
-- Apply locally: npx wrangler d1 execute grreat-waitlist --file=./migrations/001_create_waitlist.sql

CREATE TABLE IF NOT EXISTS waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
