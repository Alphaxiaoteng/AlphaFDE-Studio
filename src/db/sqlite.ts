/**
 * AlphaFDE Studio — Native SQLite Database Layer
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Policy, Company, Match, SopLog, ConfirmLog } from "../types/schema";

export class SqliteManager {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(customPath?: string) {
    const root = path.resolve(__dirname, "../../");
    this.dbPath = customPath || path.join(root, "alphafde.db");

    if (fs.existsSync(this.dbPath)) {
      this.db = new DatabaseSync(this.dbPath);
    } else {
      this.db = new DatabaseSync(":memory:");
      this.initSchema();
      this.seedFromStaticJson(path.join(root, "static_db.json"));
    }
  }

  public initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        title TEXT,
        channel TEXT,
        track TEXT,
        version TEXT,
        window TEXT,
        window_kind TEXT,
        window_start TEXT,
        window_end TEXT,
        days_left INTEGER,
        urgency TEXT,
        benefit TEXT,
        helps_park INTEGER,
        helps_enterprise INTEGER,
        value_one_liner TEXT,
        citation TEXT,
        company_ids TEXT,
        auth_status TEXT,
        raw_json TEXT
      );

      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        code TEXT,
        display_name TEXT,
        alias TEXT,
        direction TEXT,
        direction_tag TEXT,
        industry TEXT,
        size_band TEXT,
        headcount_range TEXT,
        funding_stage TEXT,
        address TEXT,
        contact_lead TEXT,
        contact_phone TEXT,
        service_needs TEXT,
        raw_json TEXT
      );

      CREATE TABLE IF NOT EXISTS matches (
        id TEXT PRIMARY KEY,
        company_id TEXT,
        radar_id TEXT,
        state TEXT,
        label TEXT,
        gap TEXT,
        sop_step INTEGER,
        sop_status TEXT,
        primary_action TEXT,
        draft TEXT,
        raw_json TEXT
      );

      CREATE TABLE IF NOT EXISTS sop_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT,
        match_id TEXT,
        company_id TEXT,
        action TEXT,
        operator TEXT,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS confirm_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT,
        company_id TEXT,
        match_id TEXT,
        action TEXT,
        operator TEXT,
        draft TEXT
      );
    `);
  }

  public seedFromStaticJson(jsonPath: string): void {
    if (!fs.existsSync(jsonPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      
      const insertPolicy = this.db.prepare(`
        INSERT OR REPLACE INTO policies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of data.radar || []) {
        insertPolicy.run(
          p.id, p.title, p.channel, p.track || "", p.version || "", p.window || "",
          p.window_kind || "", p.window_start || "", p.window_end || "",
          p.days_left ?? 999, p.urgency || "ok", p.benefit || "both",
          p.helps_park ? 1 : 0, p.helps_enterprise ? 1 : 0,
          p.value_one_liner || "", p.citation || "",
          (p.company_ids || []).join(","), p.auth_status || "",
          JSON.stringify(p)
        );
      }

      const insertComp = this.db.prepare(`
        INSERT OR REPLACE INTO companies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of data.companies || []) {
        insertComp.run(
          c.id, c.code, c.display_name || c.code, c.alias || "",
          c.direction || "", c.direction_tag || "", c.industry || "",
          c.size_band || "", c.headcount_range || "", c.funding_stage || "",
          c.address || "", c.contact_lead || "", c.contact_phone || "",
          (c.service_needs || []).join(","), JSON.stringify(c)
        );
      }

      const insertMatch = this.db.prepare(`
        INSERT OR REPLACE INTO matches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const m of data.all_matches || []) {
        insertMatch.run(
          m.id, m.company_id, m.radar_id, m.state, m.label || "",
          m.gap || null, m.current ?? m.sop_step ?? 0,
          m.sop_status || "active", m.primary_action || "发送",
          m.draft || null, JSON.stringify(m)
        );
      }
    } catch (err) {
      console.error("[SqliteManager] Seed error:", err);
    }
  }

  public queryAll<T>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    return (stmt.get(...params) as T) || null;
  }

  public run(sql: string, params: any[] = []): void {
    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }
}

// Global Singleton
export const dbManager = new SqliteManager();
