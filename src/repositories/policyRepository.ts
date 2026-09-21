/**
 * AlphaFDE Studio — Policy SQL Repository
 */
import { DatabaseConnection } from "../db/connection";
import { Policy, UrgencyLevel, BenefitType } from "../types/schema";

export interface PolicyFilter {
  channel?: string;
  benefit?: string;
  urgency?: string;
  includeExpired?: boolean;
  minDaysLeft?: number;
  searchKeyword?: string;
}

export class PolicyRepository {
  private conn: DatabaseConnection;

  constructor(conn?: DatabaseConnection) {
    this.conn = conn || DatabaseConnection.getInstance();
  }

  public findAll(filter: PolicyFilter = {}): Policy[] {
    let sql = "SELECT * FROM policies WHERE 1=1";
    const params: any[] = [];

    if (filter.channel) {
      sql += " AND (channel = ? OR track = ?)";
      params.push(filter.channel, filter.channel);
    }

    if (filter.benefit === "park") {
      sql += " AND helps_park = 1";
    } else if (filter.benefit === "enterprise") {
      sql += " AND helps_enterprise = 1";
    } else if (filter.benefit === "both") {
      sql += " AND (benefit = 'both' OR (helps_park = 1 AND helps_enterprise = 1))";
    }

    if (!filter.includeExpired) {
      sql += " AND urgency != 'expired'";
    }

    if (filter.searchKeyword) {
      sql += " AND (title LIKE ? OR value_one_liner LIKE ? OR citation LIKE ?)";
      const kw = `%${filter.searchKeyword}%`;
      params.push(kw, kw, kw);
    }

    sql += " ORDER BY CASE urgency WHEN 'urgent' THEN 0 WHEN 'watch' THEN 1 WHEN 'ok' THEN 2 ELSE 3 END ASC, days_left ASC";

    const rows = this.conn.query<any>(sql, params);
    return rows.map(this.mapRowToPolicy);
  }

  public findById(id: string): Policy | null {
    const row = this.conn.queryOne<any>("SELECT * FROM policies WHERE id = ?", [id]);
    return row ? this.mapRowToPolicy(row) : null;
  }

  public countExpired(): number {
    const row = this.conn.queryOne<{ cnt: number }>(
      "SELECT count(*) as cnt FROM policies WHERE urgency = 'expired'"
    );
    return row ? row.cnt : 0;
  }

  public countTotal(): number {
    const row = this.conn.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM policies");
    return row ? row.cnt : 0;
  }

  public insert(policy: Policy): void {
    const sql = `
      INSERT OR REPLACE INTO policies (
        id, title, channel, track, version, window, window_kind, window_start, window_end,
        days_left, urgency, benefit, helps_park, helps_enterprise, value_one_liner, citation,
        company_ids, auth_status, hard_criteria, doc_no, full_body, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    this.conn.execute(sql, [
      policy.id,
      policy.title,
      policy.channel,
      policy.track || "",
      policy.version || "2026正式执行版",
      policy.window || "",
      policy.window_kind || "",
      policy.window_start || "",
      policy.window_end || "",
      policy.days_left ?? 999,
      policy.urgency || "ok",
      policy.benefit || "both",
      policy.helps_park ? 1 : 0,
      policy.helps_enterprise ? 1 : 0,
      policy.value_one_liner || "",
      policy.citation || "",
      (policy.company_ids || []).join(","),
      policy.auth_status || "official_verified",
      JSON.stringify(policy.hard_criteria || []),
      policy.doc_no || "",
      policy.full_body || ""
    ]);
  }

  public delete(id: string): void {
    this.conn.execute("DELETE FROM policies WHERE id = ?", [id]);
  }

  private mapRowToPolicy(r: any): Policy {
    let hardCriteria: string[] = [];
    try {
      if (r.hard_criteria) hardCriteria = JSON.parse(r.hard_criteria);
    } catch {}

    return {
      id: r.id,
      title: r.title,
      channel: r.channel,
      track: r.track,
      version: r.version,
      window: r.window,
      window_kind: r.window_kind,
      window_start: r.window_start,
      window_end: r.window_end,
      days_left: r.days_left,
      urgency: r.urgency as UrgencyLevel,
      benefit: r.benefit as BenefitType,
      helps_park: r.helps_park === 1,
      helps_enterprise: r.helps_enterprise === 1,
      value_one_liner: r.value_one_liner,
      citation: r.citation,
      company_ids: r.company_ids ? r.company_ids.split(",").filter(Boolean) : [],
      auth_status: r.auth_status,
      hard_criteria: hardCriteria,
      doc_no: r.doc_no,
      full_body: r.full_body
    };
  }
}
