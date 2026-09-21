/**
 * AlphaFDE Studio — Two-way Matching Engine
 */
import { MatchRepository } from "../repositories/matchRepository";
import { PolicyRepository } from "../repositories/policyRepository";
import { CompanyRepository } from "../repositories/companyRepository";
import { AuditRepository } from "../repositories/auditRepository";
import { DatabaseConnection } from "../db/connection";
import { Match, MatchState } from "../types/schema";
import {
  PolicyMatchResponse,
  PolicyMatchForResponse,
  ConfirmMutationRequest,
  ConfirmMutationResponse,
  CompanyProfileResponse
} from "../types/api";
import { SOP_STEPS, SOP_PRIMARY_ACTIONS } from "./sopStateMachine";

export class MatchingEngine {
  private matchRepo: MatchRepository;
  private policyRepo: PolicyRepository;
  private companyRepo: CompanyRepository;
  private auditRepo: AuditRepository;
  private conn: DatabaseConnection;

  constructor() {
    this.conn = DatabaseConnection.getInstance();
    this.matchRepo = new MatchRepository(this.conn);
    this.policyRepo = new PolicyRepository(this.conn);
    this.companyRepo = new CompanyRepository(this.conn);
    this.auditRepo = new AuditRepository(this.conn);
  }

  public getMatchesForCompany(companyId: string): PolicyMatchResponse | null {
    const company = this.companyRepo.findById(companyId);
    if (!company) return null;

    const matches = this.matchRepo.findByCompanyId(companyId);
    const enrichedMatches: Match[] = matches.map(m => {
      const policy = this.policyRepo.findById(m.radar_id);
      const step = m.sop_step;
      return {
        ...m,
        radar: policy || undefined,
        primary_action: SOP_PRIMARY_ACTIONS[step] || "标记已通过"
      };
    });

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQL Matching Engine",
        updated_at: new Date().toISOString()
      },
      company,
      match_key: ["size_band", "service_needs"],
      conflict_pairs: [],
      matches: enrichedMatches
    };
  }

  public getMatchesForRadar(radarId: string, benefit?: string): PolicyMatchForResponse | null {
    const policy = this.policyRepo.findById(radarId);
    if (!policy) return null;

    const matches = this.matchRepo.findByRadarId(radarId);
    const isUrgent = policy.urgency === "urgent";

    const items = matches.map(m => {
      const comp = this.companyRepo.findById(m.company_id);
      let timingLabel = "可马上报";
      let timingRank = 1;

      if (isUrgent && comp?.service_needs?.some(n => n.includes("补贴") || n.includes("申报"))) {
        timingLabel = `优先 · 剩 ${policy.days_left || 0} 天`;
        timingRank = 0;
      } else if (m.state === "待核验" || (m.gap && m.gap.trim())) {
        timingLabel = "先补材料再报";
        timingRank = 2;
      }

      return {
        match_id: m.id,
        company_id: m.company_id,
        company_name: comp?.display_name || comp?.code || m.company_id,
        company_code: comp?.code || m.company_id,
        direction: comp?.direction,
        timing_label: timingLabel,
        timing_rank: timingRank,
        state: m.state,
        gap: m.gap
      };
    });

    items.sort((a, b) => a.timing_rank - b.timing_rank);

    return {
      radar_id: radarId,
      urgency: policy.urgency,
      days_left: policy.days_left,
      items
    };
  }

  public confirmMatch(req: ConfirmMutationRequest): ConfirmMutationResponse {
    const { company_id, match_id, action, operator } = req;
    const match = this.matchRepo.findById(match_id);
    if (!match) {
      throw new Error(`Match not found for id: ${match_id}`);
    }

    let nextState: MatchState = match.state;
    let draft: string | null = match.draft || null;

    if (action === "confirm") {
      nextState = "符合";
      const policy = this.policyRepo.findById(match.radar_id);
      const title = policy?.title || match.label || "相关扶持政策";
      const days = policy?.days_left ?? 5;
      draft = `【企服通知】您好，关于申报《${title}》，园区专员已初审确认符合申报条件。申报窗口剩余约 ${days} 天，请及时与专员沟通补充材料。`;
    } else if (action === "reject") {
      nextState = "排除";
    }

    this.conn.transaction(() => {
      this.matchRepo.updateStateAndDraft(match_id, nextState, draft);
      this.auditRepo.recordConfirmAction(company_id, match_id, action, operator, draft);
    });

    return {
      ok: true,
      company_id,
      match_id,
      action,
      state: nextState,
      draft
    };
  }

  public getCompanyProfile(companyId: string): CompanyProfileResponse | null {
    const company = this.companyRepo.findById(companyId);
    if (!company) return null;

    const matches = this.matchRepo.findByCompanyId(companyId);
    const sop = matches.map(m => {
      const p = this.policyRepo.findById(m.radar_id);
      return {
        match_id: m.id,
        title: m.label || p?.title || m.id,
        sop_steps: SOP_STEPS,
        current: m.sop_step,
        sop_status: m.sop_status
      };
    });

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQL Matching Engine",
        updated_at: new Date().toISOString()
      },
      company,
      sop
    };
  }

  public getCorpHome(companyId: string) {
    const company = this.companyRepo.findById(companyId);
    if (!company) return null;

    const matches = this.matchRepo.findByCompanyId(companyId).map(m => {
      const r = this.policyRepo.findById(m.radar_id);
      return { ...m, radar: r || undefined };
    });

    const allPolicies = this.policyRepo.findAll({ includeExpired: false });
    const events = allPolicies.filter(p => p.channel === "公开活动" && (p.company_ids || []).includes(company.id));
    const services = allPolicies.filter(p => ["园区服务", "阿里服务", "机构服务", "平台规则活动"].includes(p.channel) && (p.company_ids || []).includes(company.id));

    return {
      meta: {
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript SQL Matching Engine",
        updated_at: new Date().toISOString()
      },
      company,
      match_key: ["size_band", "service_needs"],
      conflict_pairs: [],
      matches,
      events,
      services
    };
  }
}
