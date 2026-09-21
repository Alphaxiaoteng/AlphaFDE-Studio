#!/usr/bin/env python3
"""云谷企服运营台 · 本地 API。端口 8766。"""
from __future__ import annotations

import json
import re
import os
import socket
import uuid
from datetime import date, datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from media_hot import media_hot, media_hotspots
from public_events import fetch_public_events
from urllib.parse import parse_qs, urlparse

# urgency 排序：紧急在前
URGENCY_RANK = {"urgent": 0, "watch": 1, "ok": 2, "expired": 3}
TIMING_RANK = {"优先触达": 0, "可马上报": 1, "先补材料": 2}
SUBSIDY_NEED_KEYS = ("补贴", "申报", "奖补", "资助", "加计", "房租", "算力", "税收")

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data.json")
LOG_PATH = os.path.join(ROOT, "confirm_log.jsonl")
COOP_PATH = os.path.join(ROOT, "coop_requests.jsonl")
SOP_PATH = os.path.join(ROOT, "sop_log.jsonl")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8766"))

# 政策办理 SOP：固定 5 步；不代发微信，仅记状态
SOP_STEPS = (
    {"id": "send", "label": "发送"},
    {"id": "accept", "label": "企业接受"},
    {"id": "apply", "label": "申请提交"},
    {"id": "processing", "label": "办理中"},
    {"id": "passed", "label": "已通过"},
)
SOP_PRIMARY = (
    "发送",
    "标记企业已接受",
    "标记已申请",
    "标记办理中",
    "标记已通过",
)


def _lan_ips() -> list[str]:
    """本机非 loopback IPv4，供局域网分享；不写死某一台机器的私网地址。"""
    found: list[str] = []

    def _add(ip: str) -> None:
        if not ip or ip.startswith("127.") or ip.startswith("169.254."):
            return
        # 198.18.0.0/15 多为 VPN/代理虚拟网段，不宜当作可分享局域网
        parts = ip.split(".")
        if len(parts) == 4 and parts[0] == "198" and parts[1] in ("18", "19"):
            return
        if ip not in found:
            found.append(ip)

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.2)
        s.connect(("1.1.1.1", 80))
        _add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            _add(info[4][0])
    except OSError:
        pass
    return found


def _lan_urls() -> list[str]:
    return [f"http://{ip}:{PORT}/" for ip in _lan_ips()]

CONFIRMED = {}
REVIEW = {}
SOP = {}  # match_id -> {sop_step, sop_status}
COOP_RUNTIME = []


def load_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def seed_sop():
    """从 sop_log.jsonl 恢复最新 SOP 状态（末条覆盖）。"""
    if SOP or not os.path.isfile(SOP_PATH):
        return
    try:
        with open(SOP_PATH, "r", encoding="utf-8") as log:
            for line in log:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                mid = row.get("match_id")
                if not mid:
                    continue
                SOP[mid] = {
                    "sop_step": int(row.get("sop_step", 0)),
                    "sop_status": row.get("sop_status") or "active",
                }
    except OSError:
        pass


def _sop_defaults(match_id: str, rule: dict | None = None) -> dict:
    """无 runtime 时：已确认≈已发送；专员驳回≈终态未通过；其余待发送。"""
    conf = CONFIRMED.get(match_id)
    if conf and conf.get("action") == "reject":
        return {"sop_step": 4, "sop_status": "rejected"}
    if conf and conf.get("action") == "confirm":
        return {"sop_step": 1, "sop_status": "active"}
    return {"sop_step": 0, "sop_status": "active"}


def get_sop_state(match_id: str, rule: dict | None = None) -> dict:
    if match_id in SOP:
        st = SOP[match_id]
        return {
            "sop_step": int(st.get("sop_step", 0)),
            "sop_status": st.get("sop_status") or "active",
        }
    return _sop_defaults(match_id, rule)


def sop_payload(match_id: str, rule: dict | None = None) -> dict:
    """返回 sop_steps[] + current，供 policy_match / 画像侧展示。"""
    st = get_sop_state(match_id, rule)
    step = max(0, min(4, int(st["sop_step"])))
    status = st["sop_status"]
    steps = []
    for i, meta in enumerate(SOP_STEPS):
        label = meta["label"]
        if status == "rejected" and i == 4:
            node = "rejected"
            label = "未通过"
        elif status == "passed":
            node = "done"
        elif status == "rejected":
            node = "done" if i < step else ("pending" if i < 4 else "rejected")
        elif i < step:
            node = "done"
        elif i == step:
            node = "current"
        else:
            node = "pending"
        steps.append(
            {
                "id": meta["id"],
                "label": label,
                "index": i,
                "state": node,
            }
        )
    primary = None
    if status == "active":
        primary = SOP_PRIMARY[step]
    return {
        "sop_step": step,
        "sop_status": status,
        "current": step,
        "sop_steps": steps,
        "primary_action": primary,
        "can_back": status == "active" and step > 0,
        "can_reject": status == "active" and step < 4,
    }


def _companies_by_id(data):
    return {c["id"]: c for c in data["companies"]}


def _radar_by_id(data):
    return {r["id"]: r for r in data["radar"]}


def seed_coop():
    if COOP_RUNTIME:
        return
    DATA = load_data()
    for row in DATA.get("coop_seed", []):
        COOP_RUNTIME.append(dict(row))


def _stage_path(company: dict) -> str:
    labels = {"opc": "OPC", "s_3_20": "3–20", "m_20_100": "20–100"}
    order = []
    for ev in company.get("timeline") or []:
        if ev.get("horizon"):
            continue
        stage = ev.get("stage")
        if stage and (not order or order[-1] != stage):
            order.append(stage)
    return " → ".join(labels.get(s, s) for s in order)


def _fits_current(company: dict, radar: dict) -> bool:
    """匹配只看当前 size_band + service_needs。timeline 不读。"""
    if not company:
        return False
    bands = radar.get("size_bands") or []
    if bands and company.get("size_band") not in bands:
        return False
    need_any = radar.get("need_any") or []
    if need_any:
        have = set(company.get("service_needs") or [])
        if not have.intersection(need_any):
            return False
    return True


def _passes_benefit(r: dict, benefit: str | None) -> bool:
    """双益筛选：默认 both = 对园区有帮助 AND 对企业有帮助。
    逻辑来源：policy_pilot 因果链（助企补贴 → 续租 → 托住园区）；
    localhost:3008 不可达时按同一规则落地。
    """
    b = (benefit or "both").strip().lower()
    park = bool(r.get("helps_park"))
    ent = bool(r.get("helps_enterprise"))
    if b in ("", "all"):
        return True
    if b == "both":
        return park and ent
    if b == "park":
        return park
    if b in ("enterprise", "ent"):
        return ent
    return True


CHANNEL_ALIASES = {
    "政府政策": "政府政策",
    "gov": "政府政策",
    "政府": "政府政策",
    "公开活动": "公开活动",
    "活动": "公开活动",
    "event": "公开活动",
}


def _normalize_channel(value: str | None) -> str | None:
    if not value:
        return None
    return CHANNEL_ALIASES.get(value.strip(), value.strip())


def _radar_channel(r: dict) -> str:
    if r.get("channel"):
        return _normalize_channel(r["channel"]) or "政府政策"
    track = r.get("track") or ""
    if "公开活动" in track:
        return "公开活动"
    return "政府政策"


def _is_coop_radar(r: dict) -> bool:
    """合作线索已迁出政策雷达，统一不出现在 /api/policy_radar。"""
    if r.get("archived_from_radar"):
        return True
    ch = (r.get("channel") or "") + (r.get("track") or "")
    return "合作线索" in ch or ch.startswith("已迁出")


def _parse_iso_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    s = str(value).strip()[:10]
    try:
        return date.fromisoformat(s)
    except ValueError:
        return None


def _window_urgency(r: dict, today: date | None = None) -> dict:
    """由 window_end（或 event_end）派生 days_left / urgency。紧急<7天 / 临近<15天；过期单独标记。"""
    today = today or date.today()
    end = _parse_iso_date(r.get("window_end")) or _parse_iso_date(r.get("event_end"))
    if end is None:
        return {"days_left": None, "urgency": "ok"}
    days = (end - today).days
    if days < 0:
        urgency = "expired"
    elif days < 7:
        urgency = "urgent"
    elif days < 15:
        urgency = "watch"
    else:
        urgency = "ok"
    return {"days_left": days, "urgency": urgency}


def _fields_all_confirmed(company: dict) -> bool:
    fields = company.get("fields") or {}
    if not fields:
        return True
    return all(bool(f.get("confirmed")) for f in fields.values())


def _has_subsidy_need(company: dict) -> bool:
    needs = company.get("service_needs") or []
    blob = " ".join(str(n) for n in needs)
    return any(k in blob for k in SUBSIDY_NEED_KEYS)


def _timing_for_match(company: dict, urgency: str, days_left) -> dict:
    """时间匹配：优先触达 → 可马上报 → 先补材料。"""
    confirmed = _fields_all_confirmed(company)
    if not confirmed:
        rank_key = "先补材料"
        label = "先补材料再报"
    elif urgency == "urgent" and _has_subsidy_need(company):
        rank_key = "优先触达"
        if days_left is not None and days_left >= 0:
            label = f"优先 · 剩 {days_left} 天"
        else:
            label = "优先触达"
    else:
        rank_key = "可马上报"
        label = "可马上报"
    return {
        "timing_label": label,
        "timing_rank": TIMING_RANK[rank_key],
    }


def policy_radar(
    track: str | None = None,
    benefit: str | None = "both",
    channel: str | None = None,
    include_expired: bool = False,
):
    DATA = load_data()
    # 合并 Agent 日更公开活动缓存（失败不影响主列表）
    try:
        from public_events import merge_cached_events_into_radar

        DATA = merge_cached_events_into_radar(DATA)
    except Exception:
        pass
    items = []
    skipped_expired = 0
    want_channel = _normalize_channel(channel)
    for r in DATA["radar"]:
        # 合作线索不再进入雷达（见「媒体热点」页）
        if _is_coop_radar(r):
            continue
        # 兼容旧 track 精确过滤；新 UI 用 channel
        if track and r.get("track") != track:
            continue
        if want_channel and _radar_channel(r) != want_channel:
            continue
        if not _passes_benefit(r, benefit):
            continue
        win = _window_urgency(r)
        # 过时 / 显式 stale 默认不进列表
        if (win["urgency"] == "expired" or r.get("stale") is True) and not include_expired:
            skipped_expired += 1
            continue
        cmap = _companies_by_id(DATA)
        pending = r.get("auth_status") == "pending" or any(
            m["radar_id"] == r["id"]
            and m["state"] == "待核验"
            and _fits_current(cmap.get(m["company_id"]), r)
            for m in DATA["match_rules"]
        )
        src = r.get("source") or {}
        source_url = r.get("source_url") or (
            src.get("url") if src.get("verified") else None
        )
        # 匹配企业数：company_ids 与 match_rules 可合并去重
        match_ids = {
            cid for cid in (r.get("company_ids") or []) if cid in cmap
        }
        for m in DATA.get("match_rules") or []:
            if m.get("radar_id") != r.get("id"):
                continue
            cid = m.get("company_id")
            if cid in cmap and _fits_current(cmap.get(cid), r):
                match_ids.add(cid)
        related_codes = [cmap[cid]["code"] for cid in match_ids if cid in cmap]
        items.append(
            {
                **r,
                "channel": _radar_channel(r),
                "source_url": source_url,
                "days_left": win["days_left"],
                "urgency": win["urgency"],
                "pending_review_hint": "待核验/待授权优先处理" if pending else None,
                "related_codes": related_codes,
                "match_count": len(match_ids),
            }
        )
    items.sort(
        key=lambda x: (
            URGENCY_RANK.get(x.get("urgency"), 9),
            x.get("days_left") if x.get("days_left") is not None else 10**9,
            0 if x.get("pending_review_hint") else 1,
            x["id"],
        )
    )
    logic = DATA.get("benefit_logic", {})
    return {
        "meta": DATA["meta"],
        "queue_focus": "待核验 / 漏提醒优先，不看匹配条数冲榜",
        "benefit_filter": benefit or "both",
        "channel_filter": want_channel or "",
        "include_expired": bool(include_expired),
        "skipped_expired": skipped_expired,
        "benefit_logic": logic,
        "items": items,
    }


def policy_body(radar_id: str):
    DATA = load_data()
    r = _radar_by_id(DATA).get(radar_id)
    if not r:
        return None, 404
    rel = r.get("body_path") or f"policies/{radar_id}.md"
    path = os.path.normpath(os.path.join(ROOT, rel))
    if not path.startswith(ROOT) or not os.path.isfile(path):
        return {"ok": False, "error": "正文文件不存在"}, 404
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    src = r.get("source") or {}
    return {
        "ok": True,
        "id": radar_id,
        "title": r.get("title"),
        "body_path": rel,
        "format": "markdown",
        "source_url": r.get("source_url") or src.get("url"),
        "text": text,
    }, 200


def policy_match_for(radar_id: str, benefit: str | None = "both"):
    DATA = load_data()
    radar = _radar_by_id(DATA).get(radar_id)
    if not radar:
        return None
    win = _window_urgency(radar)
    radar_enriched = {**radar, **win}
    if not _passes_benefit(radar, benefit):
        return {
            "meta": DATA["meta"],
            "radar_id": radar_id,
            "radar": radar_enriched,
            "urgency": win["urgency"],
            "days_left": win["days_left"],
            "items": [],
            "note": "当前受益筛选下不展示",
        }
    cmap = _companies_by_id(DATA)
    rows = []
    for m in DATA["match_rules"]:
        if m["radar_id"] != radar_id:
            continue
        c = cmap.get(m["company_id"], {})
        if not _fits_current(c, radar):
            continue
        conf = CONFIRMED.get(m["id"])
        draft = conf.get("draft") if conf and conf.get("action") == "confirm" else None
        timing = _timing_for_match(c, win["urgency"], win["days_left"])
        sop = sop_payload(m["id"], m)
        if not draft and sop["sop_step"] >= 1:
            draft = (CONFIRMED.get(m["id"]) or {}).get("draft")
        rows.append(
            {
                "id": m["id"],
                "state": m["state"],
                "review": review_status(m, conf),
                "label": _label_for(m, conf),
                "citation": m["citation"],
                "gap": m.get("gap"),
                "company_id": m["company_id"],
                "company_code": c.get("code"),
                "display_name": c.get("display_name") or c.get("alias") or c.get("code"),
                "alias": c.get("alias") or c.get("display_name") or c.get("code"),
                "logo": c.get("logo") or "",
                "direction": c.get("direction"),
                "scene": c.get("scene") or c.get("direction") or "",
                "size_band": c.get("size_band"),
                "headcount_range": c.get("headcount_range") or "",
                "draft": draft,
                "timing_label": timing["timing_label"],
                "timing_rank": timing["timing_rank"],
                "urgency": win["urgency"],
                "days_left": win["days_left"],
                "sop_step": sop["sop_step"],
                "sop_status": sop["sop_status"],
                "current": sop["current"],
                "sop_steps": sop["sop_steps"],
                "primary_action": sop["primary_action"],
                "can_back": sop["can_back"],
                "can_reject": sop["can_reject"],
            }
        )
    rows.sort(
        key=lambda x: (
            x.get("timing_rank", 9),
            x["company_code"] or "",
        )
    )
    return {
        "meta": DATA["meta"],
        "radar_id": radar_id,
        "radar_title": radar.get("title"),
        "radar": radar_enriched,
        "urgency": win["urgency"],
        "days_left": win["days_left"],
        "items": rows,
    }



def _parse_subsidy_demo_wan(text: str) -> float:
    """从补贴文案抽取演示用「万元」量级；无法解析则 0。标注 demo，非政府库。"""
    if not text:
        return 0.0
    s = str(text)
    # 取文中出现的数字区间上限或单值，单位按「万」粗算
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*万", s)
    if nums:
        return max(float(x) for x in nums)
    # 千万元级
    nums = re.findall(r"(\d+(?:\.\d+)?)\s*千万", s)
    if nums:
        return max(float(x) for x in nums) * 1000
    return 0.0


def dashboard():
    """首页看板聚合：可算则算；成效数字标 demo。"""
    DATA = load_data()
    try:
        from public_events import merge_cached_events_into_radar
        DATA = merge_cached_events_into_radar(DATA)
    except Exception:
        pass

    companies = DATA.get("companies") or []
    radar_raw = [r for r in (DATA.get("radar") or []) if not _is_coop_radar(r)]
    match_rules = DATA.get("match_rules") or []
    cmap = _companies_by_id(DATA)

    active_policies = 0
    public_events = 0
    urgent_items = []
    subsidy_wan = 0.0
    for r in radar_raw:
        win = _window_urgency(r)
        if win["urgency"] == "expired" or r.get("stale") is True:
            continue
        ch = _radar_channel(r)
        if ch == "公开活动":
            public_events += 1
        else:
            active_policies += 1
        subsidy_wan += _parse_subsidy_demo_wan(r.get("subsidy_detail") or "")
        if win["urgency"] in ("urgent", "watch") and win["days_left"] is not None:
            urgent_items.append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "days_left": win["days_left"],
                    "urgency": win["urgency"],
                    "doc_no": r.get("doc_no") or "",
                    "channel": ch,
                }
            )
    urgent_items.sort(
        key=lambda x: (
            URGENCY_RANK.get(x["urgency"], 9),
            x["days_left"] if x["days_left"] is not None else 10**9,
        )
    )

    matching = 0
    for m in match_rules:
        c = cmap.get(m.get("company_id"))
        r = _radar_by_id(DATA).get(m.get("radar_id"), {})
        if c and r and _fits_current(c, r) and m.get("state") in ("符合", "待核验"):
            matching += 1

    # SOP 漏斗：触达(>=1) / 接受(>=2) / 通过(passed)
    funnel = {"sent": 0, "accepted": 0, "passed": 0}
    seen = set()
    for m in match_rules:
        mid = m.get("id")
        if not mid or mid in seen:
            continue
        seen.add(mid)
        st = get_sop_state(mid, m)
        step = int(st.get("sop_step", 0))
        status = st.get("sop_status") or "active"
        if status == "passed" or step >= 5:
            funnel["passed"] += 1
            funnel["accepted"] += 1
            funnel["sent"] += 1
        elif step >= 2:
            funnel["accepted"] += 1
            funnel["sent"] += 1
        elif step >= 1 or (CONFIRMED.get(mid) or {}).get("action") == "confirm":
            funnel["sent"] += 1

    # 梯度培育：有匹配进行中的企业数（演示口径）
    cultivated = len(
        {
            m.get("company_id")
            for m in match_rules
            if m.get("company_id") in cmap and m.get("state") in ("符合", "待核验")
        }
    )

    return {
        "meta": DATA.get("meta") or {},
        "demo": True,
        "demo_note": "管委会成效为脱敏演示口径，非实时政府库",
        "overview": {
            "companies": len(companies),
            "active_policies": active_policies,
            "public_events": public_events,
            "matching": matching,
            "sop_passed": funnel["passed"],
        },
        "committee": {
            "demo": True,
            "subsidy_wan": round(subsidy_wan, 1),
            "subsidy_label": "累计撬动扶持（万元·样例汇总）",
            "cultivated": cultivated,
            "cultivated_label": "梯度培育入库（家·演示）",
            "urgent_count": len([u for u in urgent_items if u["urgency"] == "urgent"]),
            "urgent_label": "窗口紧急件数",
        },
        "deadlines": urgent_items[:5],
        "funnel": funnel,
        "funnel_labels": {"sent": "本季触达", "accepted": "企业接受", "passed": "已通过"},
    }


def company_profile(company_id: str):
    DATA = load_data()
    c = _companies_by_id(DATA).get(company_id)
    if not c:
        return None
    radar = _radar_by_id(DATA)
    sop_brief = []
    for m in DATA["match_rules"]:
        if m["company_id"] != company_id:
            continue
        r = radar.get(m["radar_id"], {})
        if not _fits_current(c, r):
            continue
        sop = sop_payload(m["id"], m)
        sop_brief.append(
            {
                "match_id": m["id"],
                "radar_id": m["radar_id"],
                "title": r.get("title"),
                "sop_step": sop["sop_step"],
                "sop_status": sop["sop_status"],
                "current": sop["current"],
                "sop_steps": sop["sop_steps"],
            }
        )
    return {"meta": DATA["meta"], "company": c, "sop": sop_brief}


def _label_for(m, conf):
    label = "初筛"
    if conf and conf.get("action") == "confirm" and m["state"] == "符合":
        label = "专员已确认"
    elif conf and conf.get("action") == "reject":
        label = "专员已驳回"
    elif conf and conf.get("action") == "escalate":
        label = "已升级主管"
    return label


def review_status(m, conf):
    """待检验：字段/出处未核完。待审核：已送审或符合项待专员拍板。已审核：已确认或已驳回。"""
    if conf and conf.get("action") in ("confirm", "reject"):
        return "已审核"
    queued = REVIEW.get(m["id"])
    if queued == "待审核":
        return "待审核"
    if m["state"] == "待核验":
        return "待检验"
    if m["state"] in ("符合", "排除"):
        return "待审核"
    return "待检验"


def policy_match(company_id: str):
    DATA = load_data()
    c = _companies_by_id(DATA).get(company_id)
    if not c:
        return None
    radar = _radar_by_id(DATA)
    matches = []
    for m in DATA["match_rules"]:
        if m["company_id"] != company_id:
            continue
        r = radar.get(m["radar_id"], {})
        if not _fits_current(c, r):
            continue
        conf = CONFIRMED.get(m["id"])
        draft = conf.get("draft") if conf and conf.get("action") == "confirm" else None
        sop = sop_payload(m["id"], m)
        if not draft:
            draft = (CONFIRMED.get(m["id"]) or {}).get("draft")
        matches.append(
            {
                "id": m["id"],
                "state": m["state"],
                "citation": m["citation"],
                "label": _label_for(m, conf),
                "review": review_status(m, conf),
                "gap": m.get("gap"),
                "radar": {
                    "id": r.get("id"),
                    "track": r.get("track"),
                    "title": r.get("title"),
                    "version": r.get("version"),
                    "auth_status": r.get("auth_status"),
                    "disclaimer": r.get("disclaimer"),
                    "helps_park": bool(r.get("helps_park")),
                    "helps_enterprise": bool(r.get("helps_enterprise")),
                    "dual_benefit": bool(r.get("helps_park") and r.get("helps_enterprise")),
                    "park_help": r.get("park_help"),
                    "enterprise_help": r.get("enterprise_help"),
                    "source": r.get("source"),
                    "source_also": r.get("source_also"),
                    "doc_no": r.get("doc_no") or "",
                },
                "draft": draft,
                "confirm": conf,
                "sop_step": sop["sop_step"],
                "sop_status": sop["sop_status"],
                "current": sop["current"],
                "sop_steps": sop["sop_steps"],
                "primary_action": sop["primary_action"],
                "can_back": sop["can_back"],
                "can_reject": sop["can_reject"],
            }
        )
    return {
        "meta": DATA["meta"],
        "company": {
            "id": c["id"],
            "code": c["code"],
            "display_name": c.get("display_name") or c.get("alias") or c["code"],
            "alias": c.get("alias") or c.get("display_name") or c["code"],
            "logo": c.get("logo") or "",
            "direction": c["direction"],
            "size_band": c.get("size_band"),
            "headcount_range": c.get("headcount_range"),
            "funding_stage": c.get("funding_stage"),
            "service_needs": c.get("service_needs"),
            "headcount_bands": c["headcount_bands"],
            "fields": c.get("fields"),
        },
        "match_key": ["size_band", "service_needs"],
        "matches": matches,
    }


def list_companies(size_band: str | None = None):
    DATA = load_data()
    rows = []
    for c in DATA["companies"]:
        if size_band and c.get("size_band") != size_band:
            continue
        rows.append(
            {
                "id": c["id"],
                "code": c["code"],
                "display_name": c.get("display_name") or c.get("alias") or c["code"],
                "alias": c.get("alias") or c.get("display_name") or c["code"],
                "logo": c.get("logo") or "",
                "direction": c["direction"],
                "size_band": c.get("size_band"),
                "headcount_range": c["headcount_range"],
                "funding_stage": c["funding_stage"],
                "service_needs": c["service_needs"],
                "stage_path": _stage_path(c),
                "address": c.get("address") or "",
            }
        )
    return {"meta": DATA["meta"], "companies": rows}


def match_board(state: str | None = None, benefit: str | None = "both", review: str | None = None):
    DATA = load_data()
    cmap = _companies_by_id(DATA)
    radar = _radar_by_id(DATA)
    rows = []
    stats = {"符合": 0, "排除": 0, "待核验": 0, "待检验": 0, "待审核": 0, "已审核": 0, "已确认": 0, "双益": 0}
    for m in DATA["match_rules"]:
        c = cmap.get(m["company_id"], {})
        r = radar.get(m["radar_id"], {})
        if not _fits_current(c, r):
            continue
        if not _passes_benefit(r, benefit):
            continue
        conf = CONFIRMED.get(m["id"])
        label = _label_for(m, conf)
        rev = review_status(m, conf)
        if m["state"] in stats:
            stats[m["state"]] += 1
        if rev in stats:
            stats[rev] += 1
        if label == "专员已确认":
            stats["已确认"] += 1
        dual = bool(r.get("helps_park") and r.get("helps_enterprise"))
        if dual:
            stats["双益"] += 1
        if state and m["state"] != state:
            continue
        if review and rev != review:
            continue
        draft = conf.get("draft") if conf and conf.get("action") == "confirm" else None
        sop = sop_payload(m["id"], m)
        if not draft:
            draft = (CONFIRMED.get(m["id"]) or {}).get("draft")
        rows.append(
            {
                "id": m["id"],
                "state": m["state"],
                "review": rev,
                "label": label,
                "citation": m["citation"],
                "gap": m.get("gap"),
                "company_id": m["company_id"],
                "company_code": c.get("code"),
                "display_name": c.get("display_name") or c.get("alias") or c.get("code"),
                "alias": c.get("alias") or c.get("display_name") or c.get("code"),
                "logo": c.get("logo") or "",
                "direction": c.get("direction"),
                "size_band": c.get("size_band"),
                "radar_title": r.get("title"),
                "radar_track": r.get("track"),
                "auth_status": r.get("auth_status"),
                "version": r.get("version"),
                "helps_park": bool(r.get("helps_park")),
                "helps_enterprise": bool(r.get("helps_enterprise")),
                "dual_benefit": dual,
                "park_help": r.get("park_help"),
                "enterprise_help": r.get("enterprise_help"),
                "source": r.get("source"),
                "source_also": r.get("source_also"),
                "doc_no": r.get("doc_no") or "",
                "draft": draft,
                "sop_step": sop["sop_step"],
                "sop_status": sop["sop_status"],
                "current": sop["current"],
                "sop_steps": sop["sop_steps"],
                "primary_action": sop["primary_action"],
            }
        )
    order = {"待检验": 0, "待审核": 1, "已审核": 2}
    rows.sort(key=lambda x: (order.get(x["review"], 9), x["company_code"] or ""))
    return {
        "meta": DATA["meta"],
        "stats": stats,
        "benefit_filter": benefit or "both",
        "benefit_logic": DATA.get("benefit_logic", {}),
        "items": rows,
    }


def _match_hint_for_need(data, company_id: str | None, need_type: str, summary: str):
    """简单联动：按企业当前需求词或需求文案命中雷达 need_any。"""
    cmap = _companies_by_id(data)
    company = cmap.get(company_id or "")
    needs = set((company or {}).get("service_needs") or [])
    blob = f"{need_type}{summary}"
    matched_radar = []
    for r in data["radar"]:
        keys = set(r.get("need_any") or [])
        hit = bool(needs.intersection(keys)) or any(k and k in blob for k in keys)
        if hit and _passes_benefit(r, "both"):
            matched_radar.append(r["id"])
    matched_companies = []
    if company_id:
        matched_companies = [company_id]
    else:
        for r in data["radar"]:
            if r["id"] not in matched_radar:
                continue
            for cid in r.get("company_ids") or []:
                c = cmap.get(cid)
                if c and _fits_current(c, r) and cid not in matched_companies:
                    matched_companies.append(cid)
    return matched_radar[:5], matched_companies[:5]


def list_coop(from_side: str | None = None):
    seed_coop()
    DATA = load_data()
    cmap = _companies_by_id(DATA)
    rmap = _radar_by_id(DATA)
    items = []
    for row in reversed(COOP_RUNTIME):
        side = row.get("from") or "company"
        if from_side and side != from_side:
            continue
        c = cmap.get(row.get("company_id") or "", {})
        radar_ids = row.get("matched_radar_ids") or []
        company_ids = row.get("matched_company_ids") or (
            [row["company_id"]] if row.get("company_id") else []
        )
        items.append(
            {
                **row,
                "from": side,
                "company_code": c.get("code"),
                "display_name": c.get("display_name") or c.get("alias") or c.get("code"),
                "alias": c.get("alias") or c.get("display_name") or c.get("code"),
                "logo": c.get("logo") or "",
                "direction": c.get("direction"),
                "size_band": c.get("size_band"),
                "matched_radars": [
                    {"id": rid, "title": (rmap.get(rid) or {}).get("title")}
                    for rid in radar_ids
                    if rid in rmap
                ],
                "matched_companies": [
                    {
                        "id": cid,
                        "code": (cmap.get(cid) or {}).get("code"),
                        "direction": (cmap.get(cid) or {}).get("direction"),
                    }
                    for cid in company_ids
                    if cid in cmap
                ],
            }
        )
    return {
        "meta": DATA["meta"],
        "rule": "需求默认待授权；禁止显示为已匹配成功；须企业双向确认；系统不代发",
        "from_filter": from_side or "",
        "items": items,
    }


def create_coop(body: dict):
    seed_coop()
    DATA = load_data()
    side = (body.get("from") or "park").strip()
    if side not in ("park", "company"):
        return {"ok": False, "error": "from 须为 park 或 company"}, 400
    company_id = body.get("company_id") or None
    need_type = (body.get("need_type") or "").strip()
    summary = (body.get("summary") or "").strip()
    operator = body.get("operator") or DATA["meta"]["operator_default"]
    if side == "company" and (
        not company_id or company_id not in _companies_by_id(DATA)
    ):
        return {"ok": False, "error": "企业提出时请选择脱敏企业"}, 400
    if company_id and company_id not in _companies_by_id(DATA):
        return {"ok": False, "error": "脱敏企业不存在"}, 400
    if not need_type or not summary:
        return {"ok": False, "error": "请填写需求类型与说明"}, 400
    op_label = next(
        (o["label"] for o in DATA["operators"] if o["id"] == operator), operator
    )
    matched_radar_ids, matched_company_ids = _match_hint_for_need(
        DATA, company_id, need_type, summary
    )
    if company_id and company_id not in matched_company_ids:
        matched_company_ids = [company_id] + [
            x for x in matched_company_ids if x != company_id
        ]
    entry = {
        "id": f"coop_{uuid.uuid4().hex[:8]}",
        "from": side,
        "company_id": company_id,
        "need_type": need_type,
        "summary": summary,
        "auth_status": "pending",
        "operator": operator,
        "operator_label": op_label,
        "matched_radar_ids": matched_radar_ids,
        "matched_company_ids": matched_company_ids[:5],
        "at": datetime.now(timezone.utc).isoformat(),
    }
    COOP_RUNTIME.append(entry)
    with open(COOP_PATH, "a", encoding="utf-8") as log:
        log.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return {"ok": True, "entry": entry}, 200


def do_confirm(body: dict):
    DATA = load_data()
    company_id = body.get("company_id")
    match_id = body.get("match_id")
    action = body.get("action")
    operator = body.get("operator") or DATA["meta"]["operator_default"]
    if action not in ("confirm", "reject", "escalate"):
        return {"ok": False, "error": "invalid action"}, 400
    rule = next((m for m in DATA["match_rules"] if m["id"] == match_id), None)
    if not rule or rule["company_id"] != company_id:
        return {"ok": False, "error": "match not found"}, 404
    op_label = next(
        (o["label"] for o in DATA["operators"] if o["id"] == operator), operator
    )
    at = datetime.now(timezone.utc).isoformat()
    draft = None
    if action == "confirm":
        if rule["state"] != "符合":
            return {
                "ok": False,
                "error": "仅「符合」可确认放行；待核验请先补字段或升级",
            }, 400
        if rule.get("draft_template"):
            draft = rule["draft_template"].replace(
                "{operator}", f"{op_label}/{operator}"
            )
    entry = {
        "at": at,
        "company_id": company_id,
        "match_id": match_id,
        "action": action,
        "operator": operator,
        "operator_label": op_label,
        "draft": draft,
    }
    CONFIRMED[match_id] = entry
    with open(LOG_PATH, "a", encoding="utf-8") as log:
        log.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return {"ok": True, "entry": entry, "draft": draft}, 200


def do_review(body: dict):
    DATA = load_data()
    company_id = body.get("company_id")
    match_id = body.get("match_id")
    action = body.get("action")
    rule = next((m for m in DATA["match_rules"] if m["id"] == match_id), None)
    if not rule or rule["company_id"] != company_id:
        return {"ok": False, "error": "match not found"}, 404
    conf = CONFIRMED.get(match_id)
    current = review_status(rule, conf)
    if action == "submit":
        if current != "待检验":
            return {"ok": False, "error": "仅待检验可送审"}, 400
        REVIEW[match_id] = "待审核"
        return {"ok": True, "review": "待审核"}, 200
    if action == "return":
        if current != "待审核":
            return {"ok": False, "error": "仅待审核可退回检验"}, 400
        REVIEW.pop(match_id, None)
        return {"ok": True, "review": "待检验"}, 200
    return {"ok": False, "error": "invalid action"}, 400


def _append_sop_log(entry: dict):
    with open(SOP_PATH, "a", encoding="utf-8") as log:
        log.write(json.dumps(entry, ensure_ascii=False) + "\n")


def do_sop(body: dict):
    """推进政策办理 SOP。action: next|accept|reject|reset
    发送 = 可选落草稿（不代发微信）+ 推进到已发送。
    """
    DATA = load_data()
    match_id = body.get("match_id")
    action = body.get("action")
    company_id = body.get("company_id")
    operator = body.get("operator") or DATA["meta"]["operator_default"]
    if action not in ("next", "accept", "reject", "reset"):
        return {"ok": False, "error": "invalid action"}, 400
    rule = next((m for m in DATA["match_rules"] if m["id"] == match_id), None)
    if not rule:
        return {"ok": False, "error": "match not found"}, 404
    if company_id and rule["company_id"] != company_id:
        return {"ok": False, "error": "match not found"}, 404
    company_id = rule["company_id"]
    st = get_sop_state(match_id, rule)
    step = int(st["sop_step"])
    status = st["sop_status"]
    draft = None
    op_label = next(
        (o["label"] for o in DATA["operators"] if o["id"] == operator), operator
    )
    at = datetime.now(timezone.utc).isoformat()

    if action == "reject":
        if status != "active":
            return {"ok": False, "error": "终态不可再驳回"}, 400
        status = "rejected"
        # 终态旁路：停在当前步，末节点展示「未通过」
    elif action == "reset":
        if status == "rejected":
            status = "active"
        elif status == "passed":
            status = "active"
            step = max(0, step - 1) if step >= 4 else step
            if step >= 4:
                step = 3
        elif step <= 0:
            return {"ok": False, "error": "已在第一步，无法退回"}, 400
        else:
            step -= 1
    elif action in ("next", "accept"):
        if status != "active":
            return {"ok": False, "error": "终态不可推进"}, 400
        if action == "accept" and step != 1:
            return {"ok": False, "error": "仅「企业接受」步可用 accept"}, 400
        if step == 0:
            # 发送：出草稿（若有模板）并记已发送；系统不代发微信
            if rule.get("draft_template"):
                draft = rule["draft_template"].replace(
                    "{operator}", f"{op_label}/{operator}"
                )
            conf_entry = {
                "at": at,
                "company_id": company_id,
                "match_id": match_id,
                "action": "confirm",
                "operator": operator,
                "operator_label": op_label,
                "draft": draft,
                "via": "sop_send",
            }
            CONFIRMED[match_id] = conf_entry
            with open(LOG_PATH, "a", encoding="utf-8") as log:
                log.write(json.dumps(conf_entry, ensure_ascii=False) + "\n")
            # 兼容旧 review：发送后离开「待检验」
            if REVIEW.get(match_id) != "待审核":
                REVIEW[match_id] = "待审核"
            step = 1
        elif step >= 4:
            status = "passed"
            step = 4
        else:
            step += 1
    else:
        return {"ok": False, "error": "invalid action"}, 400

    SOP[match_id] = {"sop_step": step, "sop_status": status}
    entry = {
        "at": at,
        "match_id": match_id,
        "company_id": company_id,
        "action": action,
        "sop_step": step,
        "sop_status": status,
        "operator": operator,
    }
    _append_sop_log(entry)
    payload = sop_payload(match_id, rule)
    out = {"ok": True, "entry": entry, **payload}
    if draft is not None:
        out["draft"] = draft
    elif CONFIRMED.get(match_id, {}).get("draft"):
        out["draft"] = CONFIRMED[match_id]["draft"]
    return out, 200


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[ops-console] {args[0]}")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, code: int, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _file(self, path: str, content_type: str):
        with open(path, "rb") as f:
            raw = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self._cors()
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path in ("/", "/index.html"):
            return self._file(
                os.path.join(ROOT, "index.html"), "text/html; charset=utf-8"
            )
        if path in ("/invoke", "/initialize"):
            return self._json(200, {"status": "ok"})
        if path in ("/skills.md",):
            return self._file(
                os.path.join(ROOT, "skills.md"), "text/markdown; charset=utf-8"
            )
        if path in ("/POLICY_COLLECTION_SOP.md", "/sop.md"):
            return self._file(
                os.path.join(ROOT, "POLICY_COLLECTION_SOP.md"), "text/markdown; charset=utf-8"
            )
        if path.startswith("/logos/") and path.count("/") == 2:
            name = path.rsplit("/", 1)[-1]
            if name.endswith(".svg") and ".." not in name and "/" not in name:
                logo_path = os.path.join(ROOT, "logos", name)
                if os.path.isfile(logo_path):
                    return self._file(logo_path, "image/svg+xml")
        if path == "/api/dashboard":
            self._json(200, dashboard())
            return
        if path == "/api/health":
            return self._json(
                200,
                {
                    "ok": True,
                    "host": HOST,
                    "port": PORT,
                    "lan_urls": _lan_urls(),
                    "name": "云谷企服运营台",
                    "product": "云谷企服运营台",
                },
            )
        if path == "/api/policy_radar":
            inc = str(qs.get("include_expired", ["0"])[0]).lower() in (
                "1",
                "true",
                "yes",
            )
            return self._json(
                200,
                policy_radar(
                    qs.get("track", [None])[0],
                    qs.get("benefit", ["both"])[0],
                    qs.get("channel", [None])[0],
                    include_expired=inc,
                ),
            )
        if path == "/api/public_events_refresh":
            return self._json(200, fetch_public_events())
        if path == "/api/policy_body":
            rid = qs.get("id", [None])[0]
            if not rid:
                return self._json(400, {"error": "id required"})
            payload, code = policy_body(rid)
            return self._json(code, payload)
        if path == "/api/policy_match_for":
            rid = qs.get("radar_id", [None])[0]
            if not rid:
                return self._json(400, {"error": "radar_id required"})
            out = policy_match_for(rid, qs.get("benefit", ["both"])[0])
            if out is None:
                return self._json(404, {"error": "radar not found"})
            return self._json(200, out)
        if path == "/api/company_profile":
            cid = qs.get("company_id", [None])[0]
            out = company_profile(cid) if cid else None
            return self._json(200, out) if out else self._json(404, {"error": "not found"})
        if path == "/api/policy_match":
            cid = qs.get("company_id", [None])[0]
            out = policy_match(cid) if cid else None
            return self._json(200, out) if out else self._json(404, {"error": "not found"})
        if path == "/api/companies":
            return self._json(200, list_companies(qs.get("size_band", [None])[0]))
        if path == "/api/match_board":
            return self._json(
                200,
                match_board(
                    qs.get("state", [None])[0],
                    qs.get("benefit", ["both"])[0],
                    qs.get("review", [None])[0],
                ),
            )
        if path == "/api/coop_requests":
            return self._json(200, list_coop(qs.get("from", [None])[0]))
        if path in ("/api/media_hotspots", "/api/media_hot"):
            # 主契约：GET /api/media_hotspots?q=&source=&since=&days=&refresh=
            # 兼容旧：/api/media_hot?topic=&media=
            if path == "/api/media_hotspots" or "q" in qs or "source" in qs or "since" in qs or "days" in qs:
                days_raw = qs.get("days", [None])[0]
                days_i = None
                if days_raw not in (None, ""):
                    try:
                        days_i = int(days_raw)
                    except ValueError:
                        days_i = None
                refresh = str(qs.get("refresh", [""])[0]).lower() in ("1", "true", "yes")
                return self._json(
                    200,
                    media_hotspots(
                        qs.get("q", [None])[0],
                        qs.get("source", ["all"])[0],
                        since=qs.get("since", [None])[0],
                        days=days_i,
                        refresh=refresh,
                    ),
                )
            return self._json(
                200,
                media_hot(
                    qs.get("topic", ["all"])[0],
                    qs.get("media", ["all"])[0],
                ),
            )
        self._json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/invoke", "/initialize"):
            return self._json(200, {"status": "ok"})
        length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(length) or b"{}")
        if parsed.path == "/api/confirm":
            payload, code = do_confirm(body)
            return self._json(code, payload)
        if parsed.path == "/api/review":
            payload, code = do_review(body)
            return self._json(code, payload)
        if parsed.path == "/api/sop":
            payload, code = do_sop(body)
            return self._json(code, payload)
        if parsed.path == "/api/coop_request":
            payload, code = create_coop(body)
            return self._json(code, payload)
        self._json(404, {"error": "not found"})


def main():
    seed_coop()
    seed_sop()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"云谷企服运营台 监听 {HOST}:{PORT}")
    print(f"  本机  http://127.0.0.1:{PORT}/")
    lan = _lan_urls()
    if lan:
        for url in lan:
            print(f"  局域网 {url}")
    else:
        print("  局域网（未探测到 IP）请用「本机局域网 IP:端口」访问")
    server.serve_forever()


if __name__ == "__main__":
    main()
