/**
 * AlphaFDE Studio — API Interfaces
 */
import { Policy, Company, Match, DashboardStats, SopStepDef } from "./schema";

export interface HealthResponse {
  ok: boolean;
  engine: string;
  name: string;
  product: string;
  host: string;
  port: number;
  records?: {
    policies: number;
    companies: number;
    matches: number;
  };
}

export interface PolicyRadarParams {
  channel?: string;
  benefit?: string;
  include_expired?: string | boolean;
}

export interface PolicyRadarResponse {
  meta: Record<string, any>;
  items: Policy[];
  skipped_expired?: number;
}

export interface CompanyProfileResponse {
  meta: Record<string, any>;
  company: Company;
  sop: Array<{
    match_id: string;
    title: string;
    sop_steps: SopStepDef[];
    current: number;
    sop_status: string;
  }>;
}

export interface PolicyMatchResponse {
  meta: Record<string, any>;
  company: Company;
  match_key?: string[];
  conflict_pairs?: any[];
  matches: Match[];
}

export interface PolicyMatchForResponse {
  radar_id: string;
  urgency: string;
  days_left: number;
  items: Array<{
    match_id: string;
    company_id: string;
    company_name: string;
    company_code: string;
    direction?: string;
    timing_label: string;
    timing_rank: number;
    state: string;
    gap?: string | null;
  }>;
}

export interface SopMutationRequest {
  match_id: string;
  action: "next" | "accept" | "reject" | "reset";
  company_id?: string;
  operator?: string;
  note?: string;
}

export interface SopMutationResponse {
  ok: boolean;
  match_id: string;
  current: number;
  sop_step: number;
  sop_status: string;
  primary_action: string;
}

export interface ConfirmMutationRequest {
  company_id: string;
  match_id: string;
  action: "confirm" | "reject" | "escalate";
  operator: string;
}

export interface ConfirmMutationResponse {
  ok: boolean;
  company_id: string;
  match_id: string;
  action: string;
  state?: string;
  draft?: string | null;
}
