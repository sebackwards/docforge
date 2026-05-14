import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(":memory:");
    initSchema(_db);
    seed(_db);
  }
  return _db;
}

export function resetDb(): Database.Database {
  _db = null;
  return getDb();
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id   TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT NOT NULL,
      email        TEXT NOT NULL,
      role         TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      api_key      TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      filename     TEXT NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      created_by   TEXT NOT NULL REFERENCES users(id),
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      is_shared    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS export_jobs (
      id           TEXT PRIMARY KEY,
      template_id  TEXT NOT NULL REFERENCES templates(id),
      status       TEXT NOT NULL DEFAULT 'pending',
      output_path  TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      created_by   TEXT NOT NULL REFERENCES users(id)
    );
  `);
}

function seed(db: Database.Database) {
  db.exec(`
    INSERT OR IGNORE INTO workspaces VALUES ('ws-alpha', 'Alpha Corp');
    INSERT OR IGNORE INTO workspaces VALUES ('ws-beta',  'Beta LLC');

    INSERT OR IGNORE INTO users VALUES
      ('u-alice', 'alice', 'alice@alpha.com', 'admin',  'ws-alpha', 'key-alice');
    INSERT OR IGNORE INTO users VALUES
      ('u-carol', 'carol', 'carol@alpha.com', 'editor', 'ws-alpha', 'key-carol');
    INSERT OR IGNORE INTO users VALUES
      ('u-frank', 'frank', 'frank@alpha.com', 'viewer', 'ws-alpha', 'key-frank');
    INSERT OR IGNORE INTO users VALUES
      ('u-bob',   'bob',   'bob@beta.com',    'admin',  'ws-beta',  'key-bob');
    INSERT OR IGNORE INTO users VALUES
      ('u-dave',  'dave',  'dave@beta.com',   'editor', 'ws-beta',  'key-dave');

    INSERT OR IGNORE INTO templates VALUES
      ('tpl-001', 'Invoice Template',   'invoice.html',       'ws-alpha', 'u-alice', '2024-03-01 09:00:00', 0);
    INSERT OR IGNORE INTO templates VALUES
      ('tpl-002', 'Shared Header',      'shared-header.html', 'ws-alpha', 'u-alice', '2024-03-01 10:00:00', 1);
    INSERT OR IGNORE INTO templates VALUES
      ('tpl-003', 'Quarterly Report',   'quarterly.html',     'ws-alpha', 'u-carol', '2024-03-02 11:00:00', 0);
    INSERT OR IGNORE INTO templates VALUES
      ('tpl-004', 'Receipt Template',   'receipt.html',       'ws-beta',  'u-bob',   '2024-03-01 08:00:00', 0);
    INSERT OR IGNORE INTO templates VALUES
      ('tpl-005', 'Beta Shared Footer', 'shared-footer.html', 'ws-beta',  'u-bob',   '2024-03-03 14:00:00', 1);
  `);
}
