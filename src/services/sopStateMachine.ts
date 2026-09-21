/**
 * AlphaFDE Studio — SOP State Machine Engine
 */
import { MatchRepository } from "../repositories/matchRepository";
import { AuditRepository } from "../repositories/auditRepository";
import { DatabaseConnection } from "../db/connection";
import { SopStatus, SopStepDef } from "../types/schema";
import { SopMutationRequest, SopMutationResponse } from "../types/api";

export const SOP_STEPS: SopStepDef[] = [
  { id: "send", label: "发送", index: 0 },
  { id: "accept", label: "企业接受", index: 1 },
  { id: "apply", label: "申请提交", index: 2 },
  { id: "processing", label: "办理中", index: 3 },
  { id: "passed", label: "已通过", index: 4 }
];

export const SOP_PRIMARY_ACTIONS = [
  "发送",
  "标记企业已接受",
  "标记已申请",
  "标记办理中",
  "标记已通过"
];

export class SopStateMachine {
  private matchRepo: MatchRepository;
  private auditRepo: AuditRepository;
  private conn: DatabaseConnection;

  constructor() {
    this.conn = DatabaseConnection.getInstance();
    this.matchRepo = new MatchRepository(this.conn);
    this.auditRepo = new AuditRepository(this.conn);
  }

  public transition(req: SopMutationRequest): SopMutationResponse {
    const { match_id, action, operator = "OP-01", note } = req;
    const match = this.matchRepo.findById(match_id);
    if (!match) {
      throw new Error(`Match not found for id: ${match_id}`);
    }

    let currentStep = match.sop_step;
    let nextStep = currentStep;
    let nextStatus: SopStatus = match.sop_status;

    switch (action) {
      case "next":
        if (currentStep < 4) {
          nextStep = currentStep + 1;
        }
        if (nextStep === 4) {
          nextStatus = "passed";
        }
        break;

      case "accept":
        // Only valid if currently at 'send' step
        nextStep = Math.max(currentStep, 1);
        nextStatus = "active";
        break;

      case "reject":
        nextStatus = "rejected";
        break;

      case "reset":
        nextStep = Math.max(0, currentStep - 1);
        nextStatus = "active";
        break;

      default:
        throw new Error(`Unsupported SOP action: ${action}`);
    }

    const primaryAction = SOP_PRIMARY_ACTIONS[nextStep] || "标记已通过";

    // Run update in transaction
    this.conn.transaction(() => {
      this.matchRepo.updateSop(match_id, nextStep, nextStatus, primaryAction);
      this.auditRepo.recordSopAction(
        match_id,
        action,
        operator,
        currentStep,
        nextStep,
        match.company_id,
        note
      );
    });

    return {
      ok: true,
      match_id,
      current: nextStep,
      sop_step: nextStep,
      sop_status: nextStatus,
      primary_action: primaryAction
    };
  }
}
