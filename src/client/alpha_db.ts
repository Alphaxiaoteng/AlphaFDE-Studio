/**
 * AlphaFDE Studio — In-Browser SQLite & Relational Engine (TypeScript Client)
 */
import { Policy, Company, Match, SopStepDef } from "../types/schema";

declare global {
  interface Window {
    initSqlJs?: (config: any) => Promise<any>;
    ALPHA_STATIC_SEED?: any;
    AlphaDB?: AlphaDatabaseClient;
  }
}

const STORAGE_KEY = "alphafde_sqlite_db_v1";

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

export interface ClientStore {
  meta: Record<string, any>;
  policies: Policy[];
  companies: Company[];
  matches: Match[];
  sop_logs: any[];
  confirm_logs: any[];
  remind_logs: any[];
}

export class AlphaDatabaseClient {
  public mode: string = "initializing";
  private db: any = null;
  private sqlJs: any = null;
  public store: ClientStore = {
    meta: {},
    policies: [],
    companies: [],
    matches: [],
    sop_logs: [],
    confirm_logs: [],
    remind_logs: []
  };
  public readyPromise: Promise<boolean>;

  constructor() {
    this.readyPromise = this.init();
  }

  public async init(): Promise<boolean> {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.policies && parsed.policies.length > 0) {
          this.store = parsed;
          this.mode = "local-storage-restored";
        }
      } catch (e) {
        console.warn("[AlphaDB] LocalStorage parse failed, using seed", e);
      }
    }

    if (!this.store.policies || this.store.policies.length === 0) {
      if (typeof window !== "undefined" && window.ALPHA_STATIC_SEED) {
        this.loadFromSeed(window.ALPHA_STATIC_SEED);
      } else {
        try {
          const resp = await fetch("static_db.json");
          if (resp.ok) {
            const seedData = await resp.json();
            this.loadFromSeed(seedData);
          }
        } catch (err) {
          console.warn("[AlphaDB] Failed to fetch static_db.json", err);
        }
      }
    }

    try {
      if (typeof window !== "undefined" && typeof window.initSqlJs === "function") {
        this.sqlJs = await window.initSqlJs({
          locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
        });
        this.db = new this.sqlJs.Database();
        this.buildSqliteTables();
        this.mode = "wasm-sqlite";
      } else {
        this.mode = "in-browser-relational";
      }
    } catch {
      this.mode = "in-browser-relational";
    }

    this.save();
    return true;
  }

  public loadFromSeed(seed: any): void {
    this.store.meta = seed.meta || {
      product: "云谷企服雷达智能匹配系统",
      engine: "In-Browser SQLite Engine",
      updated_at: new Date().toISOString()
    };
    this.store.policies = (seed.radar || []).map((p: any) => ({ ...p }));
    this.store.companies = (seed.companies || []).map((c: any) => ({ ...c }));
    this.store.matches = (seed.all_matches || []).map((m: any) => {
      const step = m.current ?? m.sop_step ?? 0;
      return {
        ...m,
        current: step,
        sop_step: step,
        sop_status: m.sop_status || "active",
        sop_steps: SOP_STEPS,
        primary_action: SOP_ACTIONS[step] || "标记已通过"
      };
    });
    this.store.sop_logs = (seed.sop_log || []).map((l: any) => ({ ...l }));
    this.store.confirm_logs = (seed.confirm_log || []).map((l: any) => ({ ...l }));
    this.store.remind_logs = [];
  }

  public buildSqliteTables(): void {
    if (!this.db) return;
    try {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS policies (
          id TEXT PRIMARY KEY,
          title TEXT,
          channel TEXT,
          track TEXT,
          days_left INTEGER,
          urgency TEXT,
          benefit TEXT,
          value_one_liner TEXT,
          citation TEXT,
          raw_json TEXT
        );
        CREATE TABLE IF NOT EXISTS companies (
          id TEXT PRIMARY KEY,
          code TEXT,
          display_name TEXT,
          direction TEXT,
          raw_json TEXT
        );
        CREATE TABLE IF NOT EXISTS matches (
          id TEXT PRIMARY KEY,
          company_id TEXT,
          radar_id TEXT,
          state TEXT,
          sop_step INTEGER,
          sop_status TEXT,
          raw_json TEXT
        );
      `);

      const insertP = this.db.prepare("INSERT OR REPLACE INTO policies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      for (const p of this.store.policies) {
        insertP.run([
          p.id, p.title, p.channel, p.track || "", p.days_left ?? 999,
          p.urgency || "ok", p.benefit || "both", p.value_one_liner || "",
          p.citation || "", JSON.stringify(p)
        ]);
      }
      insertP.free();

      const insertC = this.db.prepare("INSERT OR REPLACE INTO companies VALUES (?, ?, ?, ?, ?)");
      for (const c of this.store.companies) {
        insertC.run([c.id, c.code, c.display_name || c.code, c.direction, JSON.stringify(c)]);
      }
      insertC.free();

      const insertM = this.db.prepare("INSERT OR REPLACE INTO matches VALUES (?, ?, ?, ?, ?, ?, ?)");
      for (const m of this.store.matches) {
        insertM.run([
          m.id, m.company_id, m.radar_id, m.state, m.current || 0,
          m.sop_status || "active", JSON.stringify(m)
        ]);
      }
      insertM.free();
    } catch (e) {
      console.warn("[AlphaDB] SQLite WASM build table error:", e);
    }
  }

  public save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    } catch (e) {
      console.warn("[AlphaDB] LocalStorage save quota error:", e);
    }
  }

  public reset(): boolean {
    localStorage.removeItem(STORAGE_KEY);
    if (typeof window !== "undefined" && window.ALPHA_STATIC_SEED) {
      this.loadFromSeed(window.ALPHA_STATIC_SEED);
    }
    this.buildSqliteTables();
    this.save();
    return true;
  }

  public exportSqliteDb(): void {
    if (this.db) {
      const binary = this.db.export();
      const blob = new Blob([binary], { type: "application/x-sqlite3" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "alphafde.db";
      a.click();
    } else {
      const blob = new Blob([JSON.stringify(this.store, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "alphafde_store.json";
      a.click();
    }
  }

  public async handleRequest(path: string, opts: any = {}): Promise<any> {
    await this.readyPromise;
    const method = (opts.method || "GET").toUpperCase();
    const urlObj = new URL(path, "http://localhost");
    const pathname = urlObj.pathname;
    const params = Object.fromEntries(urlObj.searchParams.entries());

    if (pathname === "/api/health") {
      return {
        ok: true,
        engine: this.mode,
        product: "云谷企服雷达智能匹配系统",
        host: "client-local",
        records: {
          policies: this.store.policies.length,
          companies: this.store.companies.length,
          matches: this.store.matches.length
        }
      };
    }

    if (pathname === "/api/dashboard") {
      const companiesCount = this.store.companies.length;
      const policiesCount = this.store.policies.length;
      const matchesPassed = this.store.matches.filter(m => m.sop_status === "passed").length;
      const matchesActive = this.store.matches.filter(m => m.sop_status === "active").length;
      const urgentCount = this.store.policies.filter(p => p.urgency === "urgent").length;

      return {
        meta: this.store.meta,
        total_companies: companiesCount,
        total_policies: policiesCount,
        stats: {
          enterprises: companiesCount,
          active_policies: policiesCount,
          in_progress: matchesActive,
          passed: matchesPassed,
          urgent: urgentCount
        },
        funnel: [
          { label: "政策雷达初筛", count: policiesCount, pct: 100 },
          { label: "适企智能匹配", count: this.store.matches.length, pct: 75 },
          { label: "专员确认放行", count: this.store.matches.filter(m => m.state === "符合").length, pct: 50 },
          { label: "SOP 申报辅导", count: matchesActive + matchesPassed, pct: 35 },
          { label: "通过获得补贴", count: matchesPassed, pct: 20 }
        ]
      };
    }

    if (pathname === "/api/policy_radar") {
      let items = [...this.store.policies];
      if (params.channel) {
        items = items.filter(p => p.channel === params.channel || p.track === params.channel);
      }
      if (params.benefit === "both") {
        items = items.filter(p => p.benefit === "both" || (p.helps_park && p.helps_enterprise));
      } else if (params.benefit === "park") {
        items = items.filter(p => p.helps_park);
      } else if (params.benefit === "enterprise") {
        items = items.filter(p => p.helps_enterprise);
      }

      const incExpired = params.include_expired === "1" || params.include_expired === "true";
      let skipped = 0;
      if (!incExpired) {
        const orig = items.length;
        items = items.filter(p => p.urgency !== "expired");
        skipped = orig - items.length;
      }

      const rank: Record<string, number> = { urgent: 0, watch: 1, ok: 2, expired: 3 };
      items.sort((a, b) => {
        const ra = rank[a.urgency] ?? 2;
        const rb = rank[b.urgency] ?? 2;
        if (ra !== rb) return ra - rb;
        return (a.days_left ?? 999) - (b.days_left ?? 999);
      });

      return { meta: this.store.meta, items, skipped_expired: skipped };
    }

    if (pathname === "/api/company_profile") {
      const comp = this.store.companies.find(c => c.id === params.company_id) || this.store.companies[0];
      if (!comp) return { error: "not found" };
      const sop = this.store.matches
        .filter(m => m.company_id === comp.id)
        .map(m => {
          const r = this.store.policies.find(p => p.id === m.radar_id);
          return {
            match_id: m.id,
            title: m.label || r?.title || m.id,
            sop_steps: m.sop_steps || SOP_STEPS,
            current: m.current ?? 0,
            sop_status: m.sop_status || "active"
          };
        });
      return { meta: this.store.meta, company: comp, sop };
    }

    if (pathname === "/api/policy_match") {
      const comp = this.store.companies.find(c => c.id === params.company_id) || this.store.companies[0];
      if (!comp) return { error: "not found" };
      const matches = this.store.matches
        .filter(m => m.company_id === comp.id)
        .map(m => ({
          ...m,
          radar: this.store.policies.find(p => p.id === m.radar_id),
          primary_action: SOP_ACTIONS[m.current || 0] || "标记已通过"
        }));
      return { meta: this.store.meta, company: comp, matches, conflict_pairs: [] };
    }

    if (pathname === "/api/sop" && method === "POST") {
      const body = typeof opts.body === "string" ? JSON.parse(opts.body) : (opts.body || {});
      const m = this.store.matches.find(item => item.id === body.match_id);
      if (!m) throw new Error(`match_id not found: ${body.match_id}`);

      let step = m.current ?? m.sop_step ?? 0;
      if (body.action === "next") {
        if (step < 4) step += 1;
        if (step === 4) m.sop_status = "passed";
      } else if (body.action === "accept") {
        step = Math.max(step, 1);
      } else if (body.action === "reject") {
        m.sop_status = "rejected";
      } else if (body.action === "reset") {
        step = Math.max(0, step - 1);
        m.sop_status = "active";
      }

      m.current = step;
      m.sop_step = step;
      m.primary_action = SOP_ACTIONS[step] || "标记已通过";

      this.store.sop_logs.unshift({
        ts: new Date().toISOString(),
        match_id: body.match_id,
        action: body.action,
        operator: body.operator || "OP-01"
      });

      this.save();
      return {
        ok: true,
        match_id: body.match_id,
        current: m.current,
        sop_step: m.sop_step,
        sop_status: m.sop_status,
        primary_action: m.primary_action
      };
    }

    if (pathname === "/api/confirm" && method === "POST") {
      const body = typeof opts.body === "string" ? JSON.parse(opts.body) : (opts.body || {});
      const m = this.store.matches.find(item => item.id === body.match_id);
      if (!m) throw new Error(`match_id not found: ${body.match_id}`);

      if (body.action === "confirm") {
        m.state = "符合";
        const r = this.store.policies.find(p => p.id === m.radar_id);
        m.draft = `【企服通知】您好，关于申报《${r?.title || m.label || "相关扶持政策"}》，园区专员已初审确认符合申报条件。申报窗口剩余约 ${r?.days_left || 5} 天，请及时与专员沟通补充材料。`;
      } else if (body.action === "reject") {
        m.state = "排除";
      }

      this.store.confirm_logs.unshift({
        ts: new Date().toISOString(),
        match_id: body.match_id,
        action: body.action,
        operator: body.operator || "OP-01",
        draft: m.draft
      });

      this.save();
      return {
        ok: true,
        company_id: body.company_id,
        match_id: body.match_id,
        action: body.action,
        state: m.state,
        draft: m.draft
      };
    }

    return null;
  }
}

if (typeof window !== "undefined") {
  window.AlphaDB = new AlphaDatabaseClient();
}
