#!/usr/bin/env node
/**
 * AlphaFDE Studio — TypeScript CLI Tool
 */
import { PolicyRepository } from "./repositories/policyRepository";
import { CompanyRepository } from "./repositories/companyRepository";
import { MatchingEngine } from "./services/matchingEngine";
import { DashboardService } from "./services/dashboardService";

const policyRepo = new PolicyRepository();
const companyRepo = new CompanyRepository();
const matchingEngine = new MatchingEngine();

const args = process.argv.slice(2);
const command = args[0] || "help";

switch (command) {
  case "list": {
    const channel = args[1];
    const policies = policyRepo.findAll({ channel });
    console.log(`\n=== 政策雷达列表 (共 ${policies.length} 条) ===`);
    for (const p of policies) {
      console.log(`[${p.urgency}] ${p.title} (剩余 ${p.days_left} 天, 适企: ${p.company_ids?.length || 0} 家)`);
    }
    break;
  }

  case "companies": {
    const comps = companyRepo.findAll();
    console.log(`\n=== 在园企业底账 (共 ${comps.length} 家) ===`);
    for (const c of comps) {
      console.log(`- [${c.code}] ${c.display_name} (${c.direction}) - 诉求: ${c.service_needs.join(", ")}`);
    }
    break;
  }

  case "match": {
    const cid = args[1] || "corp_opc_1";
    const res = matchingEngine.getMatchesForCompany(cid);
    if (!res) {
      console.error(`企业不存在: ${cid}`);
      process.exit(1);
    }
    console.log(`\n=== 企业匹配结果: ${res.company.display_name} (${res.company.code}) ===`);
    for (const m of res.matches) {
      console.log(`- [${m.state}] ${m.radar?.title || m.label} | SOP当前: ${m.sop_step} 步 (${m.primary_action})`);
    }
    break;
  }

  case "stats": {
    const stats = DashboardService.getDashboardData();
    console.log("\n=== 运营看板实时统计 ===");
    console.log(`总在园企业: ${stats.total_companies}`);
    console.log(`总现行政策: ${stats.total_policies}`);
    console.log(`待办推进中: ${stats.stats.in_progress}`);
    console.log(`已办结通过: ${stats.stats.passed}`);
    console.log(`紧急倒计时: ${stats.stats.urgent}`);
    break;
  }

  default:
    console.log(`
AlphaFDE Studio TypeScript CLI
使用方式:
  node dist/cli.js list [channel]       查看政策雷达清单
  node dist/cli.js companies            查看在园企业底账
  node dist/cli.js match <company_id>   查看指定企业政策匹配与SOP
  node dist/cli.js stats                查看全景运营统计
    `);
    break;
}
