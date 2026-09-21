/**
 * AlphaFDE Studio — Match & Enterprise Service (TypeScript)
 */
import { dbManager } from "../db/sqlite";
import { Company, Match, SopStepDef, Policy } from "../types/schema";
import {
  CompanyProfileResponse,
  PolicyMatchResponse,
  PolicyMatchForResponse,
  SopMutationRequest,
  SopMutationResponse,
  ConfirmMutationRequest,
  ConfirmMutationResponse
} from "../types/api";

const SOP_STEPS: SopStepDef[] = [
  { id: "send", label: "发送", index: 0 },
  { id: "accept", label: "企业接受", index: 1 },
  { id: "apply", label: "申请提交", index: 2 },
  { id: "processing", label: "办理中", index: 3 },
  { id: "passed", label: "已通过", index: 4 }
];

const SOP_ACTIONS = [
  "发送",
  "标记企业已接受",
  "标记已申请",
  "标记办理中",
  "标记已通过"
];

export class MatchService {
  public static getCompanies(params: { size_band?: string; direction?: string }) {
    let sql = "SELECT * FROM companies WHERE 1=1";
    const sqlParams: any[] = [];

    if (params.size_band) {
      sql += " AND size_band = ?";
      sqlParams.push(params.size_band);
    }
    if (params.direction) {
      sql += " AND (direction_tag = ? OR direction LIKE ?)";
      sqlParams.push(params.direction, `%${params.direction}%`);
    }

    const rows = dbManager.queryAll<any>(sql, sqlParams);
    const comps = rows.map(r => {
      try {
        const c = JSON.parse(r.raw_json);
        const matchCountRow = dbManager.queryOne<{ cnt: number }>(
          "SELECT count(*) as cnt FROM matches WHERE company_id = ?",
          [c.id]
        );
        return {
          ...c,
          match_count: matchCountRow ? matchCountRow.cnt : 0
        };
      } catch {
        return {
          id: r.id,
          code: r.code,
          display_name: r.display_name,
          direction: r.direction,
          service_needs: r.service_needs ? r.service_needs.split(",") : []
        };
      }
    });

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQLite Engine",
        updated_at: new Date().toISOString()
      },
      companies: comps,
      direction_tags: {
        smart_tools: "智能工具",
        digital_content: "数字内容",
        ecommerce: "电商运营",
        hardtech: "硬科创孵化",
        industrial_vision: "工业视觉",
        logistics: "仓配物流"
      }
    };
  }

  public static getCompanyProfile(companyId: string): CompanyProfileResponse | null {
    const compRow = dbManager.queryOne<any>("SELECT * FROM companies WHERE id = ?", [companyId]);
    if (!compRow) return null;

    let company: Company;
    try { company = JSON.parse(compRow.raw_json); } catch {
      company = {
        id: compRow.id,
        code: compRow.code,
        display_name: compRow.display_name,
        direction: compRow.direction,
        service_needs: compRow.service_needs ? compRow.service_needs.split(",") : []
      };
    }

    const matchRows = dbManager.queryAll<any>("SELECT * FROM matches WHERE company_id = ?", [companyId]);
    const sop = matchRows.map(m => {
      const pRow = dbManager.queryOne<any>("SELECT title FROM policies WHERE id = ?", [m.radar_id]);
      return {
        match_id: m.id,
        title: m.label || (pRow ? pRow.title : m.id),
        sop_steps: SOP_STEPS,
        current: m.sop_step ?? 0,
        sop_status: m.sop_status || "active"
      };
    });

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQLite Engine",
        updated_at: new Date().toISOString()
      },
      company,
      sop
    };
  }

  public static getPolicyMatch(companyId: string): PolicyMatchResponse | null {
    const compRow = dbManager.queryOne<any>("SELECT * FROM companies WHERE id = ?", [companyId]);
    if (!compRow) return null;

    let company: Company;
    try { company = JSON.parse(compRow.raw_json); } catch {
      company = {
        id: compRow.id,
        code: compRow.code,
        display_name: compRow.display_name,
        direction: compRow.direction,
        service_needs: compRow.service_needs ? compRow.service_needs.split(",") : []
      };
    }

    const matchRows = dbManager.queryAll<any>("SELECT * FROM matches WHERE company_id = ?", [companyId]);
    const matches: Match[] = matchRows.map(r => {
      let raw: any = {};
      try { raw = JSON.parse(r.raw_json); } catch {}
      const pRow = dbManager.queryOne<any>("SELECT raw_json FROM policies WHERE id = ?", [r.radar_id]);
      let radar: Policy | undefined;
      if (pRow) {
        try { radar = JSON.parse(pRow.raw_json); } catch {}
      }

      const step = r.sop_step ?? 0;
      return {
        ...raw,
        id: r.id,
        company_id: r.company_id,
        radar_id: r.radar_id,
        state: r.state,
        label: r.label || raw.label || "初筛",
        gap: r.gap,
        sop_step: step,
        current: step,
        sop_status: r.sop_status || "active",
        primary_action: SOP_ACTIONS[step] || "标记已通过",
        draft: r.draft,
        radar
      };
    });

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQLite Engine",
        updated_at: new Date().toISOString()
      },
      company,
      matches,
      conflict_pairs: []
    };
  }

  public static getPolicyMatchFor(radarId: string, benefit?: string): PolicyMatchForResponse | null {
    const pRow = dbManager.queryOne<any>("SELECT * FROM policies WHERE id = ?", [radarId]);
    if (!pRow) return null;

    let radar: any = {};
    try { radar = JSON.parse(pRow.raw_json); } catch {}

    const matchRows = dbManager.queryAll<any>("SELECT * FROM matches WHERE radar_id = ?", [radarId]);
    const items = matchRows.map(m => {
      const cRow = dbManager.queryOne<any>("SELECT * FROM companies WHERE id = ?", [m.company_id]);
      let comp: any = {};
      if (cRow) {
        try { comp = JSON.parse(cRow.raw_json); } catch {}
      }

      const isUrgent = radar.urgency === "urgent";
      let timingLabel = "可马上报";
      let timingRank = 1;

      if (isUrgent && (comp.service_needs || []).some((n: string) => n.includes("补贴") || n.includes("申报"))) {
        timingLabel = `优先 · 剩 ${radar.days_left || 0} 天`;
        timingRank = 0;
      } else if (m.state === "待核验" || (m.gap && m.gap.trim())) {
        timingLabel = "先补材料再报";
        timingRank = 2;
      }

      return {
        match_id: m.id,
        company_id: m.company_id,
        company_name: comp.display_name || comp.code || m.company_id,
        company_code: comp.code || m.company_id,
        direction: comp.direction,
        timing_label: timingLabel,
        timing_rank: timingRank,
        state: m.state,
        gap: m.gap
      };
    });

    items.sort((a, b) => a.timing_rank - b.timing_rank);

    return {
      radar_id: radarId,
      urgency: radar.urgency || "ok",
      days_left: radar.days_left || 0,
      items
    };
  }

  public static mutateSop(req: SopMutationRequest): SopMutationResponse {
    const { match_id, action, operator } = req;
    const m = dbManager.queryOne<any>("SELECT * FROM matches WHERE id = ?", [match_id]);
    if (!m) throw new Error(`match_id not found: ${match_id}`);

    let step = m.sop_step ?? 0;
    let status = m.sop_status || "active";

    if (action === "next") {
      if (step < 4) step += 1;
      if (step === 4) status = "passed";
    } else if (action === "accept") {
      step = Math.max(step, 1);
    } else if (action === "reject") {
      status = "rejected";
    } else if (action === "reset") {
      step = Math.max(0, step - 1);
      status = "active";
    }

    const primaryAction = SOP_ACTIONS[step] || "标记已通过";

    dbManager.run(
      "UPDATE matches SET sop_step = ?, sop_status = ?, primary_action = ? WHERE id = ?",
      [step, status, primaryAction, match_id]
    );

    dbManager.run(
      "INSERT INTO sop_logs (ts, match_id, action, operator) VALUES (?, ?, ?, ?)",
      [new Date().toISOString(), match_id, action, operator || "OP-01"]
    );

    return {
      ok: true,
      match_id,
      current: step,
      sop_step: step,
      sop_status: status,
      primary_action: primaryAction
    };
  }

  public static mutateConfirm(req: ConfirmMutationRequest): ConfirmMutationResponse {
    const { company_id, match_id, action, operator } = req;
    const m = dbManager.queryOne<any>("SELECT * FROM matches WHERE id = ?", [match_id]);
    if (!m) throw new Error(`match_id not found: ${match_id}`);

    let state = m.state;
    let draft = m.draft;

    if (action === "confirm") {
      state = "符合";
      const pRow = dbManager.queryOne<any>("SELECT title, days_left FROM policies WHERE id = ?", [m.radar_id]);
      const title = pRow ? pRow.title : (m.label || "相关扶持政策");
      const days = pRow ? (pRow.days_left || 5) : 5;
      draft = `【企服通知】您好，关于申报《${title}》，园区专员已初审确认符合申报条件。申报窗口剩余约 ${days} 天，请及时与专员沟通补充材料。`;
    } else if (action === "reject") {
      state = "排除";
    }

    dbManager.run(
      "UPDATE matches SET state = ?, draft = ? WHERE id = ?",
      [state, draft, match_id]
    );

    dbManager.run(
      "INSERT INTO confirm_logs (ts, company_id, match_id, action, operator, draft) VALUES (?, ?, ?, ?, ?, ?)",
      [new Date().toISOString(), company_id, match_id, action, operator || "OP-01", draft]
    );

    return {
      ok: true,
      company_id,
      match_id,
      action,
      state,
      draft
    };
  }

  public static getMatchBoard(params: { state?: string; benefit?: string }) {
    let sql = "SELECT * FROM matches WHERE 1=1";
    const sqlParams: any[] = [];

    if (params.state) {
      sql += " AND state = ?";
      sqlParams.push(params.state);
    }

    const rows = dbManager.queryAll<any>(sql, sqlParams);
    const items = rows.map(m => {
      const cRow = dbManager.queryOne<any>("SELECT display_name, code FROM companies WHERE id = ?", [m.company_id]);
      const pRow = dbManager.queryOne<any>("SELECT title, raw_json FROM policies WHERE id = ?", [m.radar_id]);
      let radar: any = {};
      if (pRow) {
        try { radar = JSON.parse(pRow.raw_json); } catch {}
      }

      return {
        ...m,
        company_name: cRow ? (cRow.display_name || cRow.code) : m.company_id,
        radar_title: pRow ? pRow.title : m.radar_id,
        radar
      };
    });

    const stats = {
      符合: dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE state = '符合'")?.cnt || 0,
      排除: dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE state = '排除'")?.cnt || 0,
      待核验: dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM matches WHERE state = '待核验'")?.cnt || 0,
      双益: dbManager.queryOne<{ cnt: number }>("SELECT count(*) as cnt FROM policies WHERE benefit = 'both'")?.cnt || 0
    };

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQLite Engine",
        updated_at: new Date().toISOString()
      },
      stats,
      items
    };
  }
}
