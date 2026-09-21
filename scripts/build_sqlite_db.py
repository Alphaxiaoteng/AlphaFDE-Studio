#!/usr/bin/env python3
"""Build local SQLite database alphafde.db from static_db.json."""
import json
import os
import sqlite3

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_PATH = os.path.join(ROOT, "static_db.json")
DB_PATH = os.path.join(ROOT, "alphafde.db")

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Create schema
cursor.executescript("""
CREATE TABLE system_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE policies (
    id TEXT PRIMARY KEY,
    title TEXT,
    channel TEXT,
    track TEXT,
    version TEXT,
    window TEXT,
    window_kind TEXT,
    window_start TEXT,
    window_end TEXT,
    days_left INTEGER,
    urgency TEXT,
    benefit TEXT,
    helps_park INTEGER,
    helps_enterprise INTEGER,
    value_one_liner TEXT,
    citation TEXT,
    company_ids TEXT,
    auth_status TEXT,
    raw_json TEXT
);

CREATE TABLE companies (
    id TEXT PRIMARY KEY,
    code TEXT,
    display_name TEXT,
    alias TEXT,
    direction TEXT,
    direction_tag TEXT,
    industry TEXT,
    size_band TEXT,
    headcount_range TEXT,
    funding_stage TEXT,
    address TEXT,
    contact_lead TEXT,
    contact_phone TEXT,
    service_needs TEXT,
    raw_json TEXT
);

CREATE TABLE matches (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    radar_id TEXT,
    state TEXT,
    label TEXT,
    gap TEXT,
    sop_step INTEGER,
    sop_status TEXT,
    primary_action TEXT,
    draft TEXT,
    raw_json TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (radar_id) REFERENCES policies(id)
);

CREATE TABLE sop_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT,
    match_id TEXT,
    company_id TEXT,
    action TEXT,
    operator TEXT,
    note TEXT
);

CREATE TABLE confirm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT,
    company_id TEXT,
    match_id TEXT,
    action TEXT,
    operator TEXT,
    draft TEXT
);
""")

with open(JSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

# Meta
cursor.execute("INSERT INTO system_meta VALUES (?, ?)", ("product", "云谷企服雷达智能匹配系统"))
cursor.execute("INSERT INTO system_meta VALUES (?, ?)", ("engine", "In-Browser SQLite WASM + LocalStorage"))

# Policies
for p in data.get("radar", []):
    cursor.execute("""
        INSERT INTO policies (
            id, title, channel, track, version, window, window_kind, window_start, window_end,
            days_left, urgency, benefit, helps_park, helps_enterprise, value_one_liner, citation,
            company_ids, auth_status, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        p.get("id"),
        p.get("title"),
        p.get("channel"),
        p.get("track"),
        p.get("version"),
        p.get("window"),
        p.get("window_kind"),
        p.get("window_start"),
        p.get("window_end"),
        p.get("days_left", 999),
        p.get("urgency"),
        p.get("benefit", "both"),
        1 if p.get("helps_park") else 0,
        1 if p.get("helps_enterprise") else 0,
        p.get("value_one_liner"),
        p.get("citation"),
        ",".join(p.get("company_ids") or []),
        p.get("auth_status"),
        json.dumps(p, ensure_ascii=False)
    ))

# Companies
for c in data.get("companies", []):
    cursor.execute("""
        INSERT INTO companies (
            id, code, display_name, alias, direction, direction_tag, industry,
            size_band, headcount_range, funding_stage, address, contact_lead,
            contact_phone, service_needs, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        c.get("id"),
        c.get("code"),
        c.get("display_name"),
        c.get("alias"),
        c.get("direction"),
        c.get("direction_tag"),
        c.get("industry"),
        c.get("size_band"),
        c.get("headcount_range"),
        c.get("funding_stage"),
        c.get("address"),
        c.get("contact_lead"),
        c.get("contact_phone"),
        ",".join(c.get("service_needs") or []),
        json.dumps(c, ensure_ascii=False)
    ))

# Matches
for m in data.get("all_matches", []):
    cursor.execute("""
        INSERT INTO matches (
            id, company_id, radar_id, state, label, gap, sop_step, sop_status,
            primary_action, draft, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        m.get("id"),
        m.get("company_id"),
        m.get("radar_id"),
        m.get("state"),
        m.get("label"),
        m.get("gap"),
        m.get("current", 0),
        m.get("sop_status", "active"),
        m.get("primary_action"),
        m.get("draft"),
        json.dumps(m, ensure_ascii=False)
    ))

conn.commit()
conn.close()

print(f"Successfully generated SQLite database at {DB_PATH}, size: {os.path.getsize(DB_PATH)} bytes.")
