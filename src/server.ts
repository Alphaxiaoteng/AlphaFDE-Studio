/**
 * AlphaFDE Studio — Production TypeScript HTTP Server
 */
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import * as url from "node:url";

import { PolicyRepository } from "./repositories/policyRepository";
import { CompanyRepository } from "./repositories/companyRepository";
import { MatchRepository } from "./repositories/matchRepository";
import { AuditRepository } from "./repositories/auditRepository";
import { RadarService } from "./services/radarService";
import { MatchService } from "./services/matchService";
import { DashboardService } from "./services/dashboardService";
import { SopStateMachine } from "./services/sopStateMachine";
import { MatchingEngine } from "./services/matchingEngine";

const ROOT = path.resolve(__dirname, "../");
const PORT = parseInt(process.env.PORT || "8766", 10);
const HOST = process.env.HOST || "0.0.0.0";

const policyRepo = new PolicyRepository();
const companyRepo = new CompanyRepository();
const matchRepo = new MatchRepository();
const auditRepo = new AuditRepository();
const sopMachine = new SopStateMachine();
const matchingEngine = new MatchingEngine();

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Studio-Token");
}

function sendJson(res: http.ServerResponse, statusCode: number, data: any): void {
  setCorsHeaders(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function sendFile(res: http.ServerResponse, filePath: string, contentType: string): void {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }
  setCorsHeaders(res);
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

function parseJsonBody<T = any>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);
  const query = Object.fromEntries(parsedUrl.searchParams.entries());
  const method = req.method?.toUpperCase() || "GET";

  if (method === "OPTIONS") {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    // 1. Static Files
    if (pathname === "/" || pathname === "/index.html") {
      return sendFile(res, path.join(ROOT, "index.html"), "text/html; charset=utf-8");
    }
    if (pathname === "/skills.md") {
      return sendFile(res, path.join(ROOT, "skills.md"), "text/markdown; charset=utf-8");
    }
    if (pathname === "/static_db.js") {
      return sendFile(res, path.join(ROOT, "static_db.js"), "application/javascript; charset=utf-8");
    }
    if (pathname === "/static_db.json") {
      return sendFile(res, path.join(ROOT, "static_db.json"), "application/json; charset=utf-8");
    }
    if (pathname === "/alpha_db.js") {
      return sendFile(res, path.join(ROOT, "alpha_db.js"), "application/javascript; charset=utf-8");
    }
    if (pathname === "/alphafde.db") {
      return sendFile(res, path.join(ROOT, "alphafde.db"), "application/x-sqlite3");
    }
    if (pathname === "/README.md") {
      return sendFile(res, path.join(ROOT, "README.md"), "text/markdown; charset=utf-8");
    }
    if (pathname === "/LICENSE") {
      return sendFile(res, path.join(ROOT, "LICENSE"), "text/plain; charset=utf-8");
    }

    if (pathname.startsWith("/screenshots/") || pathname.startsWith("/logos/")) {
      const subPath = pathname.startsWith("/screenshots/") ? pathname.slice(13) : pathname.slice(7);
      const targetDir = pathname.startsWith("/screenshots/") ? "screenshots" : "logos";
      const fullPath = path.join(ROOT, targetDir, ...subPath.split("/"));
      
      const ext = path.extname(fullPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".svg": "image/svg+xml",
        ".webp": "image/webp",
        ".ico": "image/x-icon"
      };
      return sendFile(res, fullPath, mimeTypes[ext] || "application/octet-stream");
    }

    // 2. API Endpoints
    if (pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        name: "云谷企服雷达智能匹配系统",
        product: "云谷企服雷达智能匹配系统",
        engine: "TypeScript Node.js SQLite Engine",
        host: HOST,
        port: PORT,
        records: {
          policies: policyRepo.countTotal(),
          companies: companyRepo.countTotal(),
          matches: matchRepo.findAll().length
        }
      });
    }

    if (pathname === "/api/dashboard") {
      return sendJson(res, 200, DashboardService.getDashboardData());
    }

    if (pathname === "/api/policy_radar") {
      const resp = RadarService.getRadarPolicies({
        channel: query.channel as string,
        benefit: query.benefit as string,
        include_expired: query.include_expired as string
      });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/company_profile") {
      const cid = query.company_id as string;
      const resp = matchingEngine.getCompanyProfile(cid);
      if (!resp) return sendJson(res, 404, { error: "Company not found" });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/policy_match") {
      const cid = query.company_id as string;
      const resp = matchingEngine.getMatchesForCompany(cid);
      if (!resp) return sendJson(res, 404, { error: "Company not found" });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/policy_match_for") {
      const rid = query.radar_id as string;
      const resp = matchingEngine.getMatchesForRadar(rid, query.benefit as string);
      if (!resp) return sendJson(res, 404, { error: "Radar item not found" });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/companies") {
      const resp = MatchService.getCompanies({
        size_band: query.size_band as string,
        direction: query.direction as string
      });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/corp_home") {
      const cid = query.company_id as string;
      const resp = matchingEngine.getCorpHome(cid);
      if (!resp) return sendJson(res, 404, { error: "Company not found" });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/match_board") {
      const resp = MatchService.getMatchBoard({
        state: query.state as string,
        benefit: query.benefit as string
      });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/policy_body") {
      const rid = query.id as string;
      const resp = RadarService.getPolicyBody(rid);
      if (!resp) return sendJson(res, 404, { error: "Policy not found" });
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/media_hotspots" || pathname === "/api/media_hot") {
      return sendJson(res, 200, {
        meta: { product: "云谷企服雷达", source: "Allnet / TikHub" },
        items: [
          { title: "2026 浙江省数字经济创新提质一号工程深入推进", source: "浙江经信", time: "今日" },
          { title: "西湖区发放首批普惠算力券，最高支持 30 万元", source: "西湖科技", time: "昨日" },
          { title: "一人公司（OPC）扶持创新载体落地首批试点名单发布", source: "创投观察", time: "近 3 天" }
        ]
      });
    }

    // Mutations (POST)
    if (pathname === "/api/sop" && method === "POST") {
      const body = await parseJsonBody(req);
      const resp = sopMachine.transition(body);
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/confirm" && method === "POST") {
      const body = await parseJsonBody(req);
      const resp = matchingEngine.confirmMatch(body);
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/review" && method === "POST") {
      const body = await parseJsonBody(req);
      const resp = matchingEngine.confirmMatch(body);
      return sendJson(res, 200, resp);
    }

    if (pathname === "/api/remind" && method === "POST") {
      const body = await parseJsonBody(req);
      auditRepo.recordRemind(body.company_id, body.channel, body.operator, body.note);
      return sendJson(res, 200, { ok: true, notice: "演示通道 · 不发公网", recorded: true });
    }

    // Fallback 404
    sendJson(res, 404, { error: `Endpoint not found: ${pathname}` });
  } catch (err: any) {
    console.error("[ServerError]", err);
    sendJson(res, 500, { error: err.message || "Internal Server Error" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`📡 [TypeScript] 云谷企服雷达智能匹配系统 监听 http://${HOST}:${PORT}/`);
  console.log(`   本地地址: http://127.0.0.1:${PORT}/`);
});

export default server;
