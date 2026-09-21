/**
 * AlphaFDE Studio — Dashboard Service (TypeScript)
 */
import { dbManager } from "../db/sqlite";
import { DashboardStats } from "../types/schema";

export class DashboardService {
  public static getDashboardData(): DashboardStats {
    const totalCompanies = dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM companies")?.cnt || 0;
    const totalPolicies = dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM policies")?.cnt || 0;
    const activeMatches = dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE sop_status = 'active'")?.cnt || 0;
    const passedMatches = dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE sop_status = 'passed'")?.cnt || 0;
    const urgentPolicies = dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM policies WHERE urgency = 'urgent'")?.cnt || 0;
    const confirmedMatches = dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE state = '符合'")?.cnt || 0;
    const totalMatches = dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches")?.cnt || 0;

    return {
      total_companies: totalCompanies,
      total_policies: totalPolicies,
      stats: {
        enterprises: totalCompanies,
        active_policies: totalPolicies,
        in_progress: activeMatches,
        passed: passedMatches,
        urgent: urgentPolicies
      },
      funnel: [
        { label: "政策雷达初筛", count: totalPolicies, pct: 100 },
        { label: "适企智能匹配", count: totalMatches, pct: 75 },
        { label: "专员确认放行", count: confirmedMatches, pct: 50 },
        { label: "SOP 申报辅导", count: activeMatches + passedMatches, pct: 35 },
        { label: "通过获得补贴", count: passedMatches, pct: 20 }
      ]
    };
  }
}
