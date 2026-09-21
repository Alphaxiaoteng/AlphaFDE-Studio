#!/usr/bin/env python3
"""Export all current policy, company, match, and dashboard data into static JSON and SQL seed."""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import server

print("Exporting data from server.py...")
db = {
    "dashboard": server.dashboard(),
    "radar": server.policy_radar(include_expired=True).get("items", []),
    "companies": server.list_companies().get("companies", []),
    "profiles": {},
    "matches_by_company": {},
    "corp_homes": {},
    "policy_match_for": {},
    "confirm_log": [],
    "sop_log": [],
}

for c in db["companies"]:
    cid = c["id"]
    prof = server.company_profile(cid)
    if prof:
        db["profiles"][cid] = prof
    match_data = server.policy_match(cid)
    if match_data:
        db["matches_by_company"][cid] = match_data
    ch = server.corp_home(cid)
    if ch:
        db["corp_homes"][cid] = ch

for p in db["radar"]:
    rid = p["id"]
    pm = server.policy_match_for(rid, "all")
    if pm:
        db["policy_match_for"][rid] = pm

# Flatten all matches into a list
all_matches = []
seen_ids = set()
for cid, mdata in db["matches_by_company"].items():
    for m in mdata.get("matches", []):
        mid = m.get("id")
        if mid and mid not in seen_ids:
            seen_ids.add(mid)
            m["company_id"] = cid
            if "radar_id" not in m:
                m["radar_id"] = (m.get("radar") or {}).get("id")
            all_matches.append(m)
db["all_matches"] = all_matches

out_path = os.path.join(ROOT, "static_db.json")
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

print(f"Exported static_db.json: {len(db['radar'])} policies, {len(db['companies'])} companies, {len(all_matches)} matches.")
