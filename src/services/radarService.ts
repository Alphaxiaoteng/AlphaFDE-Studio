/**
 * AlphaFDE Studio — Radar Service (TypeScript)
 */
import { dbManager } from "../db/sqlite";
import { Policy, UrgencyLevel } from "../types/schema";
import { PolicyRadarParams, PolicyRadarResponse } from "../types/api";

const URGENCY_RANK: Record<UrgencyLevel, number> = {
  urgent: 0,
  watch: 1,
  ok: 2,
  expired: 3
};

export class RadarService {
  public static getRadarPolicies(params: PolicyRadarParams): PolicyRadarResponse {
    let sql = "SELECT * FROM policies WHERE 1=1";
    const sqlParams: any[] = [];

    if (params.channel) {
      sql += " AND (channel = ? OR track = ?)";
      sqlParams.push(params.channel, params.channel);
    }

    if (params.benefit === "park") {
      sql += " AND helps_park = 1";
    } else if (params.benefit === "enterprise") {
      sql += " AND helps_enterprise = 1";
    } else if (params.benefit === "both") {
      sql += " AND (benefit = 'both' OR (helps_park = 1 AND helps_enterprise = 1))";
    }

    const incExpired = params.include_expired === "1" || params.include_expired === true || params.include_expired === "true";
    if (!incExpired) {
      sql += " AND urgency != 'expired'";
    }

    sql += " ORDER BY days_left ASC";

    const rows = dbManager.queryAll<any>(sql, sqlParams);
    const policies: Policy[] = rows.map(r => {
      try {
        return JSON.parse(r.raw_json);
      } catch {
        return {
          id: r.id,
          title: r.title,
          channel: r.channel,
          track: r.track,
          days_left: r.days_left,
          urgency: r.urgency as UrgencyLevel,
          benefit: r.benefit,
          value_one_liner: r.value_one_liner,
          citation: r.citation,
          company_ids: r.company_ids ? r.company_ids.split(",") : []
        };
      }
    });

    // In-memory sort by urgency rank then days_left
    policies.sort((a, b) => {
      const ra = URGENCY_RANK[a.urgency] ?? 2;
      const rb = URGENCY_RANK[b.urgency] ?? 2;
      if (ra !== rb) return ra - rb;
      return (a.days_left ?? 999) - (b.days_left ?? 999);
    });

    // Count skipped expired if needed
    let skipped = 0;
    if (!incExpired) {
      const totalCountRow = dbManager.queryOne<{ count: number }>(
        "SELECT count(*) as count FROM policies WHERE urgency = 'expired'"
      );
      skipped = totalCountRow ? totalCountRow.count : 0;
    }

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQLite Engine",
        updated_at: new Date().toISOString()
      },
      items: policies,
      skipped_expired: skipped
    };
  }

  public static getPolicyBody(id: string): { id: string; title: string; body: string; citation: string } | null {
    const row = dbManager.queryOne<any>("SELECT * FROM policies WHERE id = ?", [id]);
    if (!row) return null;
    let raw: any = {};
    try { raw = JSON.parse(row.raw_json); } catch {}
    return {
      id: row.id,
      title: row.title,
      body: raw.full_body || row.value_one_liner || "该项政策已归档核验，详情见官方发文原件。",
      citation: row.citation || "西湖区科技企业信息平台"
    };
  }
}
