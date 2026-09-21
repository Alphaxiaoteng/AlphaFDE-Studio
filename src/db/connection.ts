/**
 * AlphaFDE Studio — SQLite Database Connection & Transaction Manager
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private db: DatabaseSync;
  private readonly dbPath: string;

  private constructor(customPath?: string) {
    const root = path.resolve(__dirname, "../../");
    this.dbPath = customPath || path.join(root, "alphafde.db");

    const exists = fs.existsSync(this.dbPath);
    this.db = new DatabaseSync(this.dbPath);

    // Apply schema and migrations
    this.runMigrations();

    if (!exists) {
      this.seedInitialData(path.join(root, "static_db.json"));
    }
  }

  public static getInstance(customPath?: string): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection(customPath);
    }
    return DatabaseConnection.instance;
  }

  private runMigrations(): void {
    let schemaPath = path.join(__dirname, "schema.sql");
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(__dirname, "../../src/db/schema.sql");
    }
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, "utf-8");
      this.db.exec(sql);
    }
    // Safe column migrations for existing alphafde.db
    const safeCols = [
      "ALTER TABLE matches ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))",
      "ALTER TABLE matches ADD COLUMN created_at TEXT DEFAULT (datetime('now'))",
      "ALTER TABLE matches ADD COLUMN conflict INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE matches ADD COLUMN conflict_radar_id TEXT",
      "ALTER TABLE policies ADD COLUMN created_at TEXT DEFAULT (datetime('now'))",
      "ALTER TABLE policies ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))"
    ];
    for (const stmt of safeCols) {
      try {
        this.db.exec(stmt);
      } catch {}
    }
  }

  private seedInitialData(jsonPath: string): void {
    if (!fs.existsSync(jsonPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      this.transaction(() => {
        // Seed Meta
        const metaStmt = this.db.prepare("INSERT OR REPLACE INTO system_meta (key, value) VALUES (?, ?)");
        metaStmt.run("product", "云谷企服雷达智能匹配系统");
        metaStmt.run("version", "1.0.0");
        metaStmt.run("engine", "TypeScript SQLite Engine");

        // Seed Policies
        const policyStmt = this.db.prepare(`
          INSERT OR REPLACE INTO policies (
            id, title, channel, track, version, window, window_kind, window_start, window_end,
            days_left, urgency, benefit, helps_park, helps_enterprise, value_one_liner, citation,
            company_ids, auth_status, hard_criteria, doc_no, full_body
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of data.radar || []) {
          policyStmt.run(
            p.id,
            p.title,
            p.channel,
            p.track || "",
            p.version || "2026正式执行版",
            p.window || "",
            p.window_kind || "",
            p.window_start || "",
            p.window_end || "",
            p.days_left ?? 999,
            p.urgency || "ok",
            p.benefit || "both",
            p.helps_park ? 1 : 0,
            p.helps_enterprise ? 1 : 0,
            p.value_one_liner || "",
            p.citation || "",
            (p.company_ids || []).join(","),
            p.auth_status || "official_verified",
            JSON.stringify(p.hard_criteria || []),
            p.doc_no || "",
            p.full_body || p.value_one_liner || ""
          );
        }

        // Seed Companies
        const compStmt = this.db.prepare(`
          INSERT OR REPLACE INTO companies (
            id, code, display_name, alias, logo, direction, direction_tag, industry,
            size_band, headcount_range, funding_stage, address, contact_lead, contact_phone,
            service_needs, headcount_bands_json, fields_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const c of data.companies || []) {
          compStmt.run(
            c.id,
            c.code,
            c.display_name || c.code,
            c.alias || c.display_name || c.code,
            c.logo || "",
            c.direction || "",
            c.direction_tag || "",
            c.industry || "",
            c.size_band || "sme",
            c.headcount_range || "",
            c.funding_stage || "",
            c.address || "",
            c.contact_lead || "",
            c.contact_phone || "",
            (c.service_needs || []).join(","),
            JSON.stringify(c.headcount_bands || {}),
            JSON.stringify(c.fields || {})
          );
        }

        // Seed Matches
        const matchStmt = this.db.prepare(`
          INSERT OR REPLACE INTO matches (
            id, company_id, radar_id, state, label, gap, sop_step, sop_status,
            primary_action, draft, citation, conflict, conflict_radar_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const m of data.all_matches || []) {
          matchStmt.run(
            m.id,
            m.company_id,
            m.radar_id,
            m.state || "待核验",
            m.label || "初筛",
            m.gap || null,
            m.current ?? m.sop_step ?? 0,
            m.sop_status || "active",
            m.primary_action || "发送",
            m.draft || null,
            m.citation || "",
            m.conflict ? 1 : 0,
            (m.conflicts && m.conflicts[0]) ? m.conflicts[0].radar_id : null
          );
        }
      });
      console.log("[DatabaseConnection] Initial data seeded successfully from static_db.json");
    } catch (err) {
      console.error("[DatabaseConnection] Seeding error:", err);
    }
  }

  public getDb(): DatabaseSync {
    return this.db;
  }

  public query<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params) as T[];
  }

  public queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const stmt = this.db.prepare(sql);
    return (stmt.get(...params) as T) || null;
  }

  public execute(sql: string, params: any[] = []): void {
    const stmt = this.db.prepare(sql);
    stmt.run(...params);
  }

  public transaction<T>(callback: () => T): T {
    this.db.exec("BEGIN TRANSACTION;");
    try {
      const result = callback();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    }
  }
}
