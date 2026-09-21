#!/usr/bin/env python3
import json
import os

with open("tmp/fde/ops-console/data.json", "r", encoding="utf-8") as f:
    ops_data = json.load(f)

fresh_policies = ops_data.get("policy_radar", [])

# Map to park-agent format
agent_policies = []
for p in fresh_policies:
    level = "西湖区级"
    if "部" in p.get("agency", "") or "人民银行" in p.get("agency", "") or "国家" in p.get("agency", ""):
        level = "国家级"
    elif "浙江省" in p.get("agency", ""):
        level = "省级"
    elif "杭州市" in p.get("agency", ""):
        level = "市级"

    agent_policies.append({
        "id": p["id"],
        "track": "政府政策",
        "level": level,
        "name": p["title"],
        "doc_no": p["doc_no"],
        "department": p["agency"],
        "daysLeft": 12,
        "deadline": p["window"],
        "awardDesc": p["value_one_liner"],
        "requirements": p["hard_criteria"],
        "helps_park": p.get("helps_park", True),
        "helps_enterprise": p.get("helps_enterprise", True),
        "park_help": p.get("park_help", ""),
        "enterprise_help": p.get("enterprise_help", ""),
        "dual_benefit": True
    })

with open("apps/park-agent/data/policies.json", "w", encoding="utf-8") as f:
    json.dump(agent_policies, f, ensure_ascii=False, indent=2)

print(f"Successfully mapped {len(agent_policies)} policies to apps/park-agent/data/policies.json")
