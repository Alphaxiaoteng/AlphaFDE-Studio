/**
 * AlphaFDE Studio — Core Domain Types
 */

export type UrgencyLevel = "urgent" | "watch" | "ok" | "expired";
export type BenefitType = "both" | "park" | "enterprise" | "all";
export type MatchState = "符合" | "排除" | "待核验" | "待检验" | "待审核" | "已审核" | "已确认";
export type SopStatus = "active" | "passed" | "rejected";

export interface SopStepDef {
  id: string;
  label: string;
  index: number;
  state?: "current" | "done" | "pending";
}

export interface Policy {
  id: string;
  title: string;
  channel: string;
  track?: string;
  version?: string;
  window?: string;
  window_kind?: string;
  window_start?: string;
  window_end?: string;
  days_left: number;
  urgency: UrgencyLevel;
  benefit?: BenefitType;
  helps_park?: boolean;
  helps_enterprise?: boolean;
  value_one_liner?: string;
  citation?: string;
  company_ids?: string[];
  auth_status?: string;
  full_body?: string;
  hard_criteria?: string[];
  doc_no?: string;
}

export interface CompanyField {
  value: string;
  source: string;
  confirmed: boolean;
}

export interface HeadcountBands {
  rd: number;
  biz: number;
  other: number;
}

export interface Company {
  id: string;
  code: string;
  display_name?: string;
  alias?: string;
  logo?: string;
  direction: string;
  direction_tag?: string;
  industry?: string;
  size_band?: string;
  headcount_range?: string;
  funding_stage?: string;
  service_needs: string[];
  headcount_bands?: HeadcountBands;
  fields?: Record<string, CompanyField>;
  address?: string;
  contact_lead?: string;
  phone?: string;
  contact_phone?: string;
  match_count?: number;
}

export interface Match {
  id: string;
  company_id: string;
  radar_id: string;
  state: MatchState;
  label?: string;
  gap?: string | null;
  sop_step: number;
  current: number;
  sop_status: SopStatus;
  sop_steps?: SopStepDef[];
  primary_action?: string;
  draft?: string | null;
  citation?: string;
  radar?: Policy;
  conflicts?: Array<{ radar_id: string; title: string }>;
  conflict?: boolean;
}

export interface SopLog {
  id?: number;
  ts: string;
  match_id: string;
  company_id?: string;
  action: string;
  operator: string;
  note?: string;
}

export interface ConfirmLog {
  id?: number;
  ts: string;
  company_id: string;
  match_id: string;
  action: string;
  operator: string;
  draft?: string | null;
}

export interface DashboardStats {
  total_companies: number;
  total_policies: number;
  stats: {
    enterprises: number;
    active_policies: number;
    in_progress: number;
    passed: number;
    urgent: number;
  };
  funnel: Array<{
    label: string;
    count: number;
    pct: number;
  }>;
}
