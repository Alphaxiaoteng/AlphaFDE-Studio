-- AlphaFDE Studio SQL Schema & DDL
-- Database: SQLite 3

CREATE TABLE IF NOT EXISTS system_meta (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel TEXT NOT NULL,
    track TEXT,
    version TEXT,
    window TEXT,
    window_kind TEXT,
    window_start TEXT,
    window_end TEXT,
    days_left INTEGER NOT NULL DEFAULT 999,
    urgency TEXT NOT NULL DEFAULT 'ok',
    benefit TEXT NOT NULL DEFAULT 'both',
    helps_park INTEGER NOT NULL DEFAULT 1,
    helps_enterprise INTEGER NOT NULL DEFAULT 1,
    value_one_liner TEXT,
    citation TEXT,
    company_ids TEXT,
    auth_status TEXT,
    hard_criteria TEXT,
    doc_no TEXT,
    full_body TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_policies_channel ON policies(channel);
CREATE INDEX IF NOT EXISTS idx_policies_urgency ON policies(urgency);
CREATE INDEX IF NOT EXISTS idx_policies_days_left ON policies(days_left);
CREATE INDEX IF NOT EXISTS idx_policies_benefit ON policies(benefit);

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    display_name TEXT,
    alias TEXT,
    logo TEXT,
    direction TEXT NOT NULL,
    direction_tag TEXT,
    industry TEXT,
    size_band TEXT,
    headcount_range TEXT,
    funding_stage TEXT,
    address TEXT,
    contact_lead TEXT,
    contact_phone TEXT,
    service_needs TEXT,
    headcount_bands_json TEXT,
    fields_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
CREATE INDEX IF NOT EXISTS idx_companies_direction_tag ON companies(direction_tag);
CREATE INDEX IF NOT EXISTS idx_companies_size_band ON companies(size_band);

CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    radar_id TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT '待核验',
    label TEXT NOT NULL DEFAULT '初筛',
    gap TEXT,
    sop_step INTEGER NOT NULL DEFAULT 0,
    sop_status TEXT NOT NULL DEFAULT 'active',
    primary_action TEXT,
    draft TEXT,
    citation TEXT,
    conflict INTEGER NOT NULL DEFAULT 0,
    conflict_radar_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (radar_id) REFERENCES policies(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_matches_company_id ON matches(company_id);
CREATE INDEX IF NOT EXISTS idx_matches_radar_id ON matches(radar_id);
CREATE INDEX IF NOT EXISTS idx_matches_state ON matches(state);
CREATE INDEX IF NOT EXISTS idx_matches_sop_status ON matches(sop_status);

CREATE TABLE IF NOT EXISTS sop_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL,
    company_id TEXT,
    action TEXT NOT NULL,
    old_step INTEGER,
    new_step INTEGER,
    operator TEXT NOT NULL DEFAULT 'OP-01',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sop_logs_match_id ON sop_logs(match_id);
CREATE INDEX IF NOT EXISTS idx_sop_logs_created_at ON sop_logs(created_at);

CREATE TABLE IF NOT EXISTS confirm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    match_id TEXT NOT NULL,
    action TEXT NOT NULL,
    operator TEXT NOT NULL DEFAULT 'OP-01',
    draft TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_confirm_logs_company_id ON confirm_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_confirm_logs_match_id ON confirm_logs(match_id);

CREATE TABLE IF NOT EXISTS remind_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'sms',
    operator TEXT NOT NULL DEFAULT 'OP-01',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Aggregated Statistics View
CREATE VIEW IF NOT EXISTS v_dashboard_summary AS
SELECT 
    (SELECT COUNT(*) FROM companies) AS total_companies,
    (SELECT COUNT(*) FROM policies) AS total_policies,
    (SELECT COUNT(*) FROM matches WHERE sop_status = 'active') AS active_matches,
    (SELECT COUNT(*) FROM matches WHERE sop_status = 'passed') AS passed_matches,
    (SELECT COUNT(*) FROM matches WHERE state = '符合') AS confirmed_matches,
    (SELECT COUNT(*) FROM policies WHERE urgency = 'urgent') AS urgent_policies;
