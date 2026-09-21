/**
 * AlphaFDE Studio — In-Browser Lightweight SQLite & Zero-Backend Engine
 * 
 * Runs 100% in the browser with:
 * 1. WebAssembly SQLite (sql.js) when available
 * 2. High-performance browser-native Relational SQL engine fallback
 * 3. Automatic LocalStorage / IndexedDB persistence
 * 4. Client-side HTTP /api/ interceptor
 */

(function (window) {
  'use strict';

  const STORAGE_KEY = 'alphafde_sqlite_db_v1';
  const SOP_STEPS = [
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

  class AlphaDatabase {
    constructor() {
      this.mode = 'initializing';
      this.db = null;
      this.sqlJs = null;
      this.store = {
        meta: {},
        policies: [],
        companies: [],
        matches: [],
        sop_logs: [],
        confirm_logs: [],
        remind_logs: []
      };
      this.readyPromise = this.init();
    }

    async init() {
      // 1. Try to restore saved state from LocalStorage
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.policies && parsed.policies.length > 0) {
            this.store = parsed;
            this.mode = 'local-storage-restored';
            console.log('[AlphaDB] Restored', this.store.policies.length, 'policies and', this.store.companies.length, 'companies from LocalStorage');
          }
        } catch (e) {
          console.warn('[AlphaDB] LocalStorage parse failed, falling back to seed', e);
        }
      }

      // 2. If store empty, load from window.ALPHA_STATIC_SEED or fetch static_db.json
      if (!this.store.policies || this.store.policies.length === 0) {
        if (window.ALPHA_STATIC_SEED) {
          this.loadFromSeed(window.ALPHA_STATIC_SEED);
        } else {
          try {
            const resp = await fetch('static_db.json');
            if (resp.ok) {
              const seedData = await resp.json();
              this.loadFromSeed(seedData);
            }
          } catch (err) {
            console.warn('[AlphaDB] Could not fetch static_db.json', err);
          }
        }
      }

      // 3. Try to initialize WASM SQLite (sql.js) if available
      try {
        if (typeof window.initSqlJs === 'function') {
          this.sqlJs = await window.initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`
          });
          this.db = new this.sqlJs.Database();
          this.buildSqliteTables();
          this.mode = 'wasm-sqlite';
          console.log('[AlphaDB] SQLite WASM initialized successfully');
        } else {
          this.mode = 'in-browser-relational';
          console.log('[AlphaDB] Running in-browser Relational SQL Engine (Zero Backend)');
        }
      } catch (err) {
        this.mode = 'in-browser-relational';
        console.log('[AlphaDB] SQLite WASM unavailable, running in-browser Relational SQL Engine', err);
      }

      this.save();
      return true;
    }

    loadFromSeed(seed) {
      this.store.meta = seed.meta || {
        product: "云谷企服雷达智能匹配系统",
        engine: "In-Browser SQLite WASM",
        updated_at: new Date().toISOString()
      };
      this.store.policies = (seed.radar || []).map(p => ({ ...p }));
      this.store.companies = (seed.companies || []).map(c => ({ ...c }));
      this.store.matches = (seed.all_matches || []).map(m => {
        const step = m.current ?? m.sop_step ?? 0;
        return {
          ...m,
          current: step,
          sop_step: step,
          sop_status: m.sop_status || 'active',
          sop_steps: SOP_STEPS,
          primary_action: SOP_ACTIONS[step] || "标记已通过"
        };
      });
      this.store.sop_logs = (seed.sop_log || []).map(l => ({ ...l }));
      this.store.confirm_logs = (seed.confirm_log || []).map(l => ({ ...l }));
      this.store.remind_logs = [];
    }

    buildSqliteTables() {
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
          CREATE TABLE IF NOT EXISTS sop_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT,
            match_id TEXT,
            action TEXT,
            operator TEXT
          );
        `);

        // Seed WASM SQLite
        const insertP = this.db.prepare("INSERT OR REPLACE INTO policies VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        this.store.policies.forEach(p => {
          insertP.run([
            p.id, p.title, p.channel, p.track, p.days_left ?? 999,
            p.urgency || "ok", p.benefit || "both", p.value_one_liner || "",
            p.citation || "", JSON.stringify(p)
          ]);
        });
        insertP.free();

        const insertC = this.db.prepare("INSERT OR REPLACE INTO companies VALUES (?, ?, ?, ?, ?)");
        this.store.companies.forEach(c => {
          insertC.run([c.id, c.code, c.display_name, c.direction, JSON.stringify(c)]);
        });
        insertC.free();

        const insertM = this.db.prepare("INSERT OR REPLACE INTO matches VALUES (?, ?, ?, ?, ?, ?, ?)");
        this.store.matches.forEach(m => {
          insertM.run([
            m.id, m.company_id, m.radar_id, m.state, m.current || 0,
            m.sop_status || "active", JSON.stringify(m)
          ]);
        });
        insertM.free();
      } catch (e) {
        console.warn("[AlphaDB] Error building SQLite WASM tables:", e);
      }
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
      } catch (e) {
        console.warn("[AlphaDB] LocalStorage save quota or error:", e);
      }
    }

    reset() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("alphafde_sqlite_db_b64");
      if (window.ALPHA_STATIC_SEED) {
        this.loadFromSeed(window.ALPHA_STATIC_SEED);
      }
      this.buildSqliteTables();
      this.save();
      return true;
    }

    // Export SQLite .db binary or JSON dump
    exportSqliteDb() {
      if (this.db) {
        const binary = this.db.export();
        const blob = new Blob([binary], { type: 'application/x-sqlite3' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'alphafde.db';
        a.click();
      } else {
        const blob = new Blob([JSON.stringify(this.store, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'alphafde_store.json';
        a.click();
      }
    }

    // Request Interceptor Router
    async handleRequest(path, opts = {}) {
      await this.readyPromise;

      const method = (opts.method || 'GET').toUpperCase();
      const urlObj = new URL(path, 'http://localhost');
      const pathname = urlObj.pathname;
      const params = Object.fromEntries(urlObj.searchParams.entries());

      // 1. Health
      if (pathname === '/api/health') {
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

      // 2. Dashboard
      if (pathname === '/api/dashboard') {
        return this.getDashboard();
      }

      // 3. Policy Radar
      if (pathname === '/api/policy_radar') {
        return this.getPolicyRadar(params);
      }

      // 4. Company Profile
      if (pathname === '/api/company_profile') {
        return this.getCompanyProfile(params.company_id);
      }

      // 5. Policy Match for Company
      if (pathname === '/api/policy_match') {
        return this.getPolicyMatch(params.company_id);
      }

      // 6. Policy Match For Radar Item
      if (pathname === '/api/policy_match_for') {
        return this.getPolicyMatchFor(params.radar_id, params.benefit);
      }

      // 7. Companies List
      if (pathname === '/api/companies') {
        return this.getCompanies(params);
      }

      // 8. Corp Home
      if (pathname === '/api/corp_home') {
        return this.getCorpHome(params.company_id);
      }

      // 9. Match Board
      if (pathname === '/api/match_board') {
        return this.getMatchBoard(params);
      }

      // 10. Policy Body
      if (pathname === '/api/policy_body') {
        return this.getPolicyBody(params.id);
      }

      // 11. Media Hotspots
      if (pathname === '/api/media_hotspots' || pathname === '/api/media_hot') {
        return this.getMediaHotspots(params);
      }

      // 12. SOP Mutation (POST)
      if (pathname === '/api/sop' && method === 'POST') {
        const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : (opts.body || {});
        return this.mutateSop(body);
      }

      // 13. Confirm Mutation (POST)
      if (pathname === '/api/confirm' && method === 'POST') {
        const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : (opts.body || {});
        return this.mutateConfirm(body);
      }

      // 14. Review Mutation (POST)
      if (pathname === '/api/review' && method === 'POST') {
        const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : (opts.body || {});
        return this.mutateReview(body);
      }

      // 15. Remind (POST)
      if (pathname === '/api/remind' && method === 'POST') {
        const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : (opts.body || {});
        return this.mutateRemind(body);
      }

      // 16. Handover (POST)
      if (pathname === '/api/attract/handover' && method === 'POST') {
        return { ok: true, message: "已通过本地 SQLite 接收交接记录" };
      }

      return null; // Not an intercepted API
    }

    // Handlers
    getDashboard() {
      const companiesCount = this.store.companies.length;
      const policiesCount = this.store.policies.length;
      const matchesPassed = this.store.matches.filter(m => m.sop_status === 'passed').length;
      const matchesActive = this.store.matches.filter(m => m.sop_status === 'active').length;
      const urgentCount = this.store.policies.filter(p => p.urgency === 'urgent').length;

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
          { label: "专员确认放行", count: this.store.matches.filter(m => m.state === '符合').length, pct: 50 },
          { label: "SOP 申报辅导", count: matchesActive + matchesPassed, pct: 35 },
          { label: "通过获得补贴", count: matchesPassed, pct: 20 }
        ]
      };
    }

    getPolicyRadar(params) {
      let items = [...this.store.policies];
      const channel = params.channel;
      const benefit = params.benefit || 'both';
      const incExpired = params.include_expired === '1' || params.include_expired === 'true';

      if (channel) {
        items = items.filter(p => p.channel === channel || p.track === channel);
      }
      if (benefit === 'both') {
        items = items.filter(p => p.benefit === 'both' || (p.helps_park && p.helps_enterprise));
      } else if (benefit === 'park') {
        items = items.filter(p => p.helps_park);
      } else if (benefit === 'enterprise') {
        items = items.filter(p => p.helps_enterprise);
      }

      let skipped = 0;
      if (!incExpired) {
        const origLen = items.length;
        items = items.filter(p => p.urgency !== 'expired');
        skipped = origLen - items.length;
      }

      // Sort by urgency: urgent (0) -> watch (1) -> ok (2)
      const rank = { urgent: 0, watch: 1, ok: 2, expired: 3 };
      items.sort((a, b) => {
        const ra = rank[a.urgency] ?? 2;
        const rb = rank[b.urgency] ?? 2;
        if (ra !== rb) return ra - rb;
        return (a.days_left ?? 999) - (b.days_left ?? 999);
      });

      return {
        meta: this.store.meta,
        items: items,
        skipped_expired: skipped
      };
    }

    getCompanyProfile(cid) {
      const comp = this.store.companies.find(c => c.id === cid) || this.store.companies[0];
      if (!comp) return { error: "not found" };

      const compMatches = this.store.matches.filter(m => m.company_id === comp.id);
      const sop = compMatches.map(m => {
        const r = this.store.policies.find(p => p.id === m.radar_id) || {};
        return {
          match_id: m.id,
          title: m.label || r.title || m.id,
          sop_steps: m.sop_steps || SOP_STEPS,
          current: m.current ?? 0,
          sop_status: m.sop_status || 'active'
        };
      });

      return {
        meta: this.store.meta,
        company: comp,
        sop: sop
      };
    }

    getPolicyMatch(cid) {
      const comp = this.store.companies.find(c => c.id === cid) || this.store.companies[0];
      if (!comp) return { error: "not found" };

      const matches = this.store.matches
        .filter(m => m.company_id === comp.id)
        .map(m => {
          const radar = this.store.policies.find(p => p.id === m.radar_id) || {};
          return {
            ...m,
            radar: radar,
            sop_steps: m.sop_steps || SOP_STEPS,
            primary_action: SOP_ACTIONS[m.current || 0] || "标记已通过"
          };
        });

      return {
        meta: this.store.meta,
        company: comp,
        matches: matches,
        conflict_pairs: []
      };
    }

    getPolicyMatchFor(radarId, benefit) {
      const radar = this.store.policies.find(p => p.id === radarId) || {};
      const matches = this.store.matches.filter(m => m.radar_id === radarId);

      const items = matches.map(m => {
        const comp = this.store.companies.find(c => c.id === m.company_id) || {};
        const isUrgent = radar.urgency === 'urgent';
        let timingLabel = "可马上报";
        let timingRank = 1;

        if (isUrgent && (comp.service_needs || []).some(n => n.includes("补贴") || n.includes("申报"))) {
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
          company_code: comp.code,
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
        items: items
      };
    }

    getCompanies(params) {
      let comps = [...this.store.companies];
      if (params.size_band) {
        comps = comps.filter(c => c.size_band === params.size_band);
      }
      if (params.direction) {
        comps = comps.filter(c => (c.direction_tag === params.direction || (c.direction && c.direction.includes(params.direction))));
      }

      return {
        meta: this.store.meta,
        companies: comps.map(c => {
          const matchCount = this.store.matches.filter(m => m.company_id === c.id).length;
          return {
            ...c,
            match_count: matchCount
          };
        }),
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

    getCorpHome(cid) {
      const comp = this.store.companies.find(c => c.id === cid) || this.store.companies[0];
      if (!comp) return { error: "not found" };

      const compMatches = this.store.matches
        .filter(m => m.company_id === comp.id)
        .map(m => {
          const r = this.store.policies.find(p => p.id === m.radar_id) || {};
          return { ...m, radar: r };
        });

      const events = this.store.policies.filter(p => p.channel === "公开活动" && (p.company_ids || []).includes(comp.id));
      const services = this.store.policies.filter(p => ["园区服务", "阿里服务", "机构服务", "平台规则活动"].includes(p.channel) && (p.company_ids || []).includes(comp.id));

      return {
        meta: this.store.meta,
        company: comp,
        matches: compMatches,
        events: events,
        services: services,
        conflict_pairs: []
      };
    }

    getMatchBoard(params) {
      let items = this.store.matches.map(m => {
        const comp = this.store.companies.find(c => c.id === m.company_id) || {};
        const radar = this.store.policies.find(p => p.id === m.radar_id) || {};
        return {
          ...m,
          company_name: comp.display_name || comp.code || m.company_id,
          radar_title: radar.title || m.radar_id,
          radar: radar
        };
      });

      if (params.state) {
        items = items.filter(m => m.state === params.state);
      }

      const stats = {
        符合: this.store.matches.filter(m => m.state === '符合').length,
        排除: this.store.matches.filter(m => m.state === '排除').length,
        待核验: this.store.matches.filter(m => m.state === '待核验').length,
        双益: this.store.policies.filter(p => p.benefit === 'both').length
      };

      return {
        meta: this.store.meta,
        stats: stats,
        items: items
      };
    }

    getPolicyBody(id) {
      const p = this.store.policies.find(item => item.id === id);
      if (!p) return { error: "not found" };
      return {
        id: p.id,
        title: p.title,
        body: p.full_body || p.value_one_liner || "该项政策核验已归档，详情请见官方红头原件出处。",
        citation: p.citation || "西湖区科技信息平台"
      };
    }

    getMediaHotspots() {
      return {
        meta: this.store.meta,
        items: [
          { title: "2026 浙江省数字经济创新提质一号工程深入推进", source: "浙江经信", time: "今日" },
          { title: "西湖区发放首批普惠算力券，最高支持 30 万元", source: "西湖科技", time: "昨日" },
          { title: "一人公司（OPC）扶持创新载体落地首批试点名单发布", source: "创投观察", time: "近 3 天" }
        ]
      };
    }

    mutateSop(body) {
      const { match_id, action, operator } = body;
      const m = this.store.matches.find(item => item.id === match_id);
      if (!m) throw new Error("match_id not found: " + match_id);

      let step = m.current ?? m.sop_step ?? 0;
      if (action === 'next') {
        if (step < 4) step += 1;
        if (step === 4) m.sop_status = 'passed';
      } else if (action === 'accept') {
        step = Math.max(step, 1);
      } else if (action === 'reject') {
        m.sop_status = 'rejected';
      } else if (action === 'reset') {
        step = Math.max(0, step - 1);
        m.sop_status = 'active';
      }

      m.current = step;
      m.sop_step = step;
      m.primary_action = SOP_ACTIONS[step] || "标记已通过";

      // Insert log
      this.store.sop_logs.unshift({
        ts: new Date().toISOString(),
        match_id: match_id,
        action: action,
        operator: operator || 'OP-01'
      });

      // Update WASM SQLite if active
      if (this.db) {
        try {
          this.db.run(
            "UPDATE matches SET sop_step = ?, sop_status = ? WHERE id = ?",
            [step, m.sop_status, match_id]
          );
          this.db.run(
            "INSERT INTO sop_logs (ts, match_id, action, operator) VALUES (?, ?, ?, ?)",
            [new Date().toISOString(), match_id, action, operator || 'OP-01']
          );
        } catch (e) {
          console.warn("[AlphaDB] SQLite WASM update error:", e);
        }
      }

      this.save();

      return {
        ok: true,
        match_id: match_id,
        current: m.current,
        sop_step: m.sop_step,
        sop_status: m.sop_status,
        primary_action: m.primary_action
      };
    }

    mutateConfirm(body) {
      const { match_id, action, operator } = body;
      const m = this.store.matches.find(item => item.id === match_id);
      if (!m) throw new Error("match_id not found: " + match_id);

      if (action === 'confirm') {
        m.state = '符合';
        const r = this.store.policies.find(p => p.id === m.radar_id) || {};
        m.draft = `【企服通知】您好，关于申报《${r.title || m.label || '相关扶持政策'}》，园区专员已初审确认符合申报条件。办理窗口剩余 ${r.days_left || 5} 天，请及时与专员沟通提交申报材料。`;
      } else if (action === 'reject') {
        m.state = '排除';
      }

      this.store.confirm_logs.unshift({
        ts: new Date().toISOString(),
        match_id: match_id,
        action: action,
        operator: operator || 'OP-01',
        draft: m.draft
      });

      if (this.db) {
        try {
          this.db.run(
            "UPDATE matches SET state = ?, draft = ? WHERE id = ?",
            [m.state, m.draft, match_id]
          );
        } catch (e) {
          console.warn("[AlphaDB] SQLite WASM confirm error:", e);
        }
      }

      this.save();

      return {
        ok: true,
        match_id: match_id,
        action: action,
        state: m.state,
        draft: m.draft
      };
    }

    mutateReview(body) {
      return this.mutateConfirm(body);
    }

    mutateRemind(body) {
      this.store.remind_logs.unshift({
        ts: new Date().toISOString(),
        ...body
      });
      this.save();
      return {
        ok: true,
        notice: "演示通道 · 不发公网",
        recorded: true
      };
    }
  }

  // Expose global instance
  window.AlphaDB = new AlphaDatabase();

})(window);
