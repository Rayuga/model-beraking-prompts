import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export type Row = Record<string, any>;

export class Store {
  db: DatabaseSync;
  ready = false;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
    this.migrate();
  }

  all(sql: string, params: any[] = []): Row[] {
    return this.db.prepare(sql).all(...params) as Row[];
  }
  one(sql: string, params: any[] = []): Row | undefined {
    return this.db.prepare(sql).get(...params) as Row | undefined;
  }
  run(sql: string, params: any[] = []) {
    this.db.prepare(sql).run(...params);
  }

  migrate() {
    const cols = this.all("PRAGMA table_info(boards)");
    if (cols.length && !cols.some((c) => c.name === "owner_id")) {
      for (const t of [
        "share_links", "shares", "activity", "ops", "versions", "replies", "comments",
        "components", "groups", "connectors", "objects", "boards", "tokens", "users",
        "clients", "kv",
      ]) this.run(`DROP TABLE IF EXISTS ${t}`);
    }
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS users(
        id TEXT PRIMARY KEY, email TEXT UNIQUE, display_name TEXT,
        password_hash TEXT, color TEXT, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS tokens(
        token TEXT PRIMARY KEY, user_id TEXT, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS boards(
        id TEXT PRIMARY KEY, owner_id TEXT, name TEXT, status TEXT, favorite INTEGER,
        created_at TEXT, updated_at TEXT, background TEXT, grid INTEGER,
        snap INTEGER, viewport_x REAL, viewport_y REAL, zoom REAL, revision INTEGER
      );
      CREATE TABLE IF NOT EXISTS objects(
        id TEXT PRIMARY KEY, board_id TEXT, type TEXT, name TEXT,
        x REAL, y REAL, width REAL, height REAL, rotation REAL,
        style_json TEXT, z_order INTEGER, parent_frame TEXT, group_id TEXT,
        locked INTEGER, hidden INTEGER, text TEXT, component_id TEXT,
        overrides_json TEXT, created_at TEXT, updated_at TEXT,
        creator TEXT, editor TEXT, obj_revision INTEGER, tombstone INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS connectors(
        id TEXT PRIMARY KEY, board_id TEXT, start_id TEXT, start_anchor TEXT,
        end_id TEXT, end_anchor TEXT, start_x REAL, start_y REAL, end_x REAL, end_y REAL,
        decoration TEXT, color TEXT, z_order INTEGER
      );
      CREATE TABLE IF NOT EXISTS groups(
        id TEXT PRIMARY KEY, board_id TEXT, name TEXT
      );
      CREATE TABLE IF NOT EXISTS components(
        id TEXT PRIMARY KEY, board_id TEXT, name TEXT, width REAL, height REAL,
        fill TEXT, text TEXT
      );
      CREATE TABLE IF NOT EXISTS comments(
        id TEXT PRIMARY KEY, board_id TEXT, object_id TEXT, x REAL, y REAL,
        author TEXT, text TEXT, status TEXT, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS replies(
        id TEXT PRIMARY KEY, thread_id TEXT, author TEXT, text TEXT, created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS versions(
        id TEXT PRIMARY KEY, board_id TEXT, name TEXT, revision INTEGER,
        actor TEXT, created_at TEXT, snapshot_json TEXT
      );
      CREATE TABLE IF NOT EXISTS ops(
        id TEXT PRIMARY KEY, board_id TEXT, client_id TEXT, type TEXT,
        payload_json TEXT, before_json TEXT, after_json TEXT, revision INTEGER, at TEXT
      );
      CREATE TABLE IF NOT EXISTS activity(
        id TEXT PRIMARY KEY, actor TEXT, board_id TEXT, action TEXT,
        target_type TEXT, target_id TEXT, before_json TEXT, after_json TEXT,
        revision INTEGER, at TEXT, correlation_id TEXT
      );
      CREATE TABLE IF NOT EXISTS shares(
        id TEXT PRIMARY KEY, board_id TEXT, email TEXT, image_png TEXT,
        delivered INTEGER, via TEXT, at TEXT, share_url TEXT
      );
      CREATE TABLE IF NOT EXISTS share_links(
        token TEXT PRIMARY KEY, board_id TEXT, owner_id TEXT, created_at TEXT
      );
    `);
  }

  reset() {
    for (const t of [
      "share_links", "shares", "activity", "ops", "versions", "replies", "comments",
      "components", "groups", "connectors", "objects", "boards", "tokens", "users", "kv",
    ]) this.run(`DELETE FROM ${t}`);
    this.ready = false;
  }

  seed() {
    this.reset();
    this.run("INSERT INTO kv VALUES(?,?)", ["seeded", "1"]);
    this.ready = true;
  }
}
