/**
 * AlphaFDE Studio — Full TypeScript Test Suite
 */
import { DatabaseConnection } from "./db/connection";
import { PolicyRepository } from "./repositories/policyRepository";
import { CompanyRepository } from "./repositories/companyRepository";
import { MatchRepository } from "./repositories/matchRepository";
import { AuditRepository } from "./repositories/auditRepository";
import { RadarService } from "./services/radarService";
import { MatchService } from "./services/matchService";
import { DashboardService } from "./services/dashboardService";
import { SopStateMachine } from "./services/sopStateMachine";
import { MatchingEngine } from "./services/matchingEngine";

async function runAllTests() {
  console.log("🚀 Starting AlphaFDE Studio TypeScript Backend Test Suite...\n");

  const conn = DatabaseConnection.getInstance();
  console.log("✅ 1. SQLite Database Connection & Migration OK");

  // Repositories
  const policyRepo = new PolicyRepository(conn);
  const companyRepo = new CompanyRepository(conn);
  const matchRepo = new MatchRepository(conn);
  const auditRepo = new AuditRepository(conn);

  // 1. Policy Repo
  const totalPolicies = policyRepo.countTotal();
  console.log(`✅ 2. PolicyRepository: total policies = ${totalPolicies}`);
  if (totalPolicies < 40) throw new Error("Expected at least 40 policies");

  const urgentPolicies = policyRepo.findAll({ urgency: "urgent" });
  console.log(`✅ 3. PolicyRepository: urgent count = ${urgentPolicies.length}`);

  // 2. Company Repo
  const totalComps = companyRepo.countTotal();
  console.log(`✅ 4. CompanyRepository: total companies = ${totalComps}`);
  if (totalComps !== 7) throw new Error("Expected 7 companies");

  const opc1 = companyRepo.findById("corp_opc_1");
  if (!opc1 || opc1.code !== "企业甲") throw new Error("Failed to find corp_opc_1");
  console.log(`✅ 5. CompanyRepository: found ${opc1.code} (${opc1.display_name})`);

  // 3. Match Repo
  const matches = matchRepo.findByCompanyId("corp_opc_1");
  console.log(`✅ 6. MatchRepository: matches for corp_opc_1 = ${matches.length}`);
  if (matches.length === 0) throw new Error("Expected matches for corp_opc_1");

  // 4. SOP State Machine
  const sopMachine = new SopStateMachine();
  const testMatch = matches[0];
  const oldStep = testMatch.sop_step;

  const sopAdvance = sopMachine.transition({
    match_id: testMatch.id,
    action: "next",
    operator: "OP-TEST"
  });
  console.log(`✅ 7. SopStateMachine: advanced match ${testMatch.id} from step ${oldStep} to ${sopAdvance.current} (${sopAdvance.primary_action})`);
  if (sopAdvance.current !== oldStep + 1 && oldStep < 4) throw new Error("SOP step advance failed");

  // 5. Matching Engine & Confirm
  const matchingEngine = new MatchingEngine();
  const confirmRes = matchingEngine.confirmMatch({
    company_id: testMatch.company_id,
    match_id: testMatch.id,
    action: "confirm",
    operator: "OP-TEST"
  });
  console.log(`✅ 8. MatchingEngine: confirmed match ${testMatch.id}, state = ${confirmRes.state}`);
  if (confirmRes.state !== "符合" || !confirmRes.draft) throw new Error("Confirm mutation failed");

  // 6. Audit Repo
  const recentLogs = auditRepo.getRecentConfirmLogs(5);
  console.log(`✅ 9. AuditRepository: recent confirm logs = ${recentLogs.length}`);
  if (recentLogs.length === 0) throw new Error("Audit log missing");

  // 7. Dashboard Service
  const dash = DashboardService.getDashboardData();
  console.log(`✅ 10. DashboardService: companies = ${dash.total_companies}, policies = ${dash.total_policies}, active = ${dash.stats.in_progress}`);
  if (dash.total_companies !== 7) throw new Error("Dashboard company count mismatch");

  // 8. Radar Service
  const radarResp = RadarService.getRadarPolicies({ channel: "政府政策" });
  console.log(`✅ 11. RadarService: government policy count = ${radarResp.items.length}`);
  if (radarResp.items.length === 0) throw new Error("Radar response empty");

  console.log("\n🎉 ALL 11 TYPESCRIPT BACKEND UNIT & INTEGRATION TESTS PASSED SUCCESSFULLY!\n");
}

runAllTests().catch(err => {
  console.error("❌ Test failed with error:", err);
  process.exit(1);
});
