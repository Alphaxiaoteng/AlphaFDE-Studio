#!/usr/bin/env python3
"""云谷企服雷达智能匹配系统 · 本地 API。端口 8766。"""
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
from urllib.parse import parse_qs, unquote, urlparse

# urgency 排序：紧急在前
URGENCY_RANK = {"urgent": 0, "watch": 1, "ok": 2, "expired": 3}
TIMING_RANK = {"优先触达": 0, "可马上报": 1, "先补材料": 2}
SUBSIDY_NEED_KEYS = ("补贴", "申报", "奖补", "资助", "加计", "房租", "算力", "税收")

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data.json")
LOG_PATH = os.path.join(ROOT, "confirm_log.jsonl")
COOP_PATH = os.path.join(ROOT, "coop_requests.jsonl")
SOP_PATH = os.path.join(ROOT, "sop_log.jsonl")
REMIND_PATH = os.path.join(ROOT, "remind_log.jsonl")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "7860"))

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


def save_data(data: dict) -> None:
    """原子性较弱的演示落盘：整文件覆写 data.json，供 load_data 热读。"""
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


RADAR_CHANNELS = (
    "政府政策",
    "公开活动",
    "平台规则活动",
    "园区服务",
    "阿里服务",
    "机构服务",
)


# 看板演示种子：多阶段覆盖（非真实业绩）。元组 (match_id, step, status[, reject_reason])。
# 多数进行中；少数 rejected + 少数待补充（靠 match_rules.gap）。末条覆盖；未列出默认待发送。
DEMO_SOP_SEED = (
    # 已发送·待企业接受
    ("m_opc_hz_2", 1, "active"),
    ("m_s1_tax", 1, "active"),
    ("m_m1_compute", 1, "active"),
    ("m_m1_model", 1, "active"),
    ("m_m1_rent", 1, "active"),
    ("m_opc1_token", 1, "active"),
    ("m_opc1_hightech", 1, "active"),
    # 已接受 / 申请提交
    ("m_opc_hz_1", 2, "active"),
    ("m_m1_chuying", 2, "active"),
    ("m_s1_consume", 2, "active"),
    # 办理中
    ("m_m1_hightech", 3, "active"),
    ("m_opc1_opc_action", 3, "active"),
    ("m_m1_reloan", 3, "active"),
    # 已通过
    ("m_opc1_glm_coding", 4, "passed"),
    ("m_opc1_clinic", 4, "passed"),
    ("m_m1_yunqi", 4, "passed"),
    # 已终止（跨企业，少数）
    ("m_opc_tax_1", 3, "rejected", "未建独立研发辅助账，加计扣除汇算清缴驳回"),
    ("m_opc_rent_2", 2, "rejected", "共享工位无独立租赁面积，房租补贴不予受理"),
    ("m_m1_software", 3, "rejected", "缺 CNAS 第三方测评报告，首版次软件认定终止"),
)


def _seed_row(row) -> tuple:
    """兼容 (id, step, status) 与 (id, step, status, reason)。"""
    mid = row[0]
    step = int(row[1])
    status = row[2]
    reason = row[3] if len(row) > 3 else None
    return mid, step, status, reason


def seed_sop():
    """从 sop_log.jsonl 恢复最新 SOP 状态（末条覆盖）；缺演示覆盖时补 DEMO_SOP_SEED。"""
    if SOP:
        return
    if os.path.isfile(SOP_PATH):
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
                    entry = {
                        "sop_step": int(row.get("sop_step", 0)),
                        "sop_status": row.get("sop_status") or "active",
                    }
                    reason = row.get("reject_reason") or row.get("fail_reason")
                    if reason:
                        entry["reject_reason"] = reason
                    SOP[mid] = entry
        except OSError:
            pass
    # 演示种子：仅填尚未出现在日志中的 match_id，不覆盖运行时推进
    for row in DEMO_SOP_SEED:
        mid, step, status, reason = _seed_row(row)
        if mid not in SOP:
            entry = {"sop_step": int(step), "sop_status": status}
            if reason and status == "rejected":
                entry["reject_reason"] = reason
            SOP[mid] = entry


def _sop_defaults(match_id: str, rule: dict | None = None) -> dict:
    """无 runtime 时：已确认≈已发送；专员驳回≈终态未通过；其余待发送。"""
    conf = CONFIRMED.get(match_id)
    if conf and conf.get("action") == "reject":
        reason = conf.get("reject_reason") or conf.get("fail_reason") or ""
        out = {"sop_step": 4, "sop_status": "rejected"}
        if reason:
            out["reject_reason"] = reason
        return out
    if conf and conf.get("action") == "confirm":
        return {"sop_step": 1, "sop_status": "active"}
    return {"sop_step": 0, "sop_status": "active"}


def get_sop_state(match_id: str, rule: dict | None = None) -> dict:
    if match_id in SOP:
        st = SOP[match_id]
        out = {
            "sop_step": int(st.get("sop_step", 0)),
            "sop_status": st.get("sop_status") or "active",
        }
        reason = st.get("reject_reason") or st.get("fail_reason")
        if reason:
            out["reject_reason"] = reason
        elif out["sop_status"] == "rejected" and rule:
            rr = rule.get("reject_reason") or rule.get("fail_reason")
            if rr:
                out["reject_reason"] = rr
        return out
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
    reason = ""
    if status == "rejected":
        reason = (
            st.get("reject_reason")
            or (rule or {}).get("reject_reason")
            or (rule or {}).get("fail_reason")
            or ""
        )
    return {
        "sop_step": step,
        "sop_status": status,
        "current": step,
        "sop_steps": steps,
        "primary_action": primary,
        "can_back": status == "active" and step > 0,
        "can_reject": status == "active" and step < 4,
        "reject_reason": reason,
        "fail_reason": reason,
    }


def _conflict_pair_set(data: dict) -> set:
    pairs: set = set()
    for pair in data.get("conflict_pairs") or []:
        if isinstance(pair, (list, tuple)) and len(pair) >= 2:
            pairs.add(frozenset((pair[0], pair[1])))
    return pairs


def _annotate_match_conflicts(matches: list, data: dict, rules_by_id: dict | None = None) -> None:
    """同企业互斥政策对 → match.conflict + conflicts[{radar_id,title}]。就地标注。"""
    if not matches:
        return
    pairs = _conflict_pair_set(data)
    rules_by_id = rules_by_id or {m["id"]: m for m in (data.get("match_rules") or [])}
    by_rid: dict = {}
    for m in matches:
        rid = ((m.get("radar") or {}).get("id")) or ""
        if rid:
            by_rid.setdefault(rid, []).append(m)
    for m in matches:
        rid = ((m.get("radar") or {}).get("id")) or ""
        titles = []
        seen = set()
        rule = rules_by_id.get(m.get("id") or "") or {}
        extra = list(rule.get("conflicts_with") or [])
        for other_rid, others in by_rid.items():
            if not rid or other_rid == rid:
                continue
            linked = frozenset((rid, other_rid)) in pairs or other_rid in extra
            if not linked:
                continue
            for o in others:
                t = ((o.get("radar") or {}).get("title")) or other_rid
                if other_rid in seen:
                    continue
                seen.add(other_rid)
                titles.append({"radar_id": other_rid, "title": t})
        m["conflicts"] = titles
        m["conflict"] = bool(titles)
        gap = str(m.get("gap") or "")
        # gap「互斥」兜底：无显式对时也打冲突标
        if "互斥" in gap and not titles:
            m["conflict"] = True
            m["conflicts"] = [{"radar_id": "", "title": "同企互斥政策路径"}]


def _radar_card_fields(r: dict) -> dict:
    """匹配卡 / 弹窗共用的雷达收益字段。"""
    return {
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
        "value_one_liner": r.get("value_one_liner") or "",
        "benefit_one_liner": r.get("benefit_one_liner") or "",
        "subsidy_detail": r.get("subsidy_detail") or "",
        "amount_label": r.get("amount_label") or "",
        "amount_wan": r.get("amount_wan"),
        "hard_criteria": list(r.get("hard_criteria") or []),
        "window_end": (r.get("window_end") or r.get("event_end") or "")[:10],
        "source": r.get("source"),
        "source_also": r.get("source_also"),
        "doc_no": r.get("doc_no") or "",
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
    """双益筛选：默认 all = 不过滤；both = 对园区有帮助 AND 对企业有帮助。
    逻辑来源：policy_pilot 因果链（助企补贴 → 续租 → 托住园区）；
    localhost:3008 不可达时按同一规则落地。
    """
    b = (benefit or "all").strip().lower()
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
    "平台规则活动": "平台规则活动",
    "平台规则": "平台规则活动",
    "平台": "平台规则活动",
    "platform": "平台规则活动",
    "园区服务": "园区服务",
    "园区": "园区服务",
    "park": "园区服务",
    "阿里服务": "阿里服务",
    "阿里云与生态服务": "阿里服务",
    "阿里": "阿里服务",
    "ali": "阿里服务",
    "aliyun": "阿里服务",
    "机构服务": "机构服务",
    "机构": "机构服务",
    "partner": "机构服务",
    "institution": "机构服务",
}


def _normalize_channel(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if v.lower() in ("all", "全部", "*"):
        return None
    return CHANNEL_ALIASES.get(v, v)


def _radar_channel(r: dict) -> str:
    if r.get("channel"):
        return _normalize_channel(r["channel"]) or "政府政策"
    track = r.get("track") or ""
    if "平台规则" in track:
        return "平台规则活动"
    if "公开活动" in track:
        return "公开活动"
    if "园区服务" in track:
        return "园区服务"
    if "阿里服务" in track or "阿里云" in track:
        return "阿里服务"
    if "机构服务" in track:
        return "机构服务"
    return "政府政策"


def _is_coop_radar(r: dict) -> bool:
    """合作线索已迁出服务雷达，统一不出现在 /api/policy_radar。"""
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


def _radar_match_company_ids(data: dict, r: dict, cmap: dict | None = None) -> list:
    """雷达匹配企业 id 列表：company_ids ∪ 通过 _fits_current 的 match_rules（保序去重）。

    与卡片 match_count、/api/policy_match_for 共用，避免「数 6 家、弹窗 1 家」。
    company_ids 侧不二次过滤（与历史 count 口径一致）；match_rules 仍走 _fits_current。
    """
    cmap = cmap if cmap is not None else _companies_by_id(data)
    ordered: list = []
    seen: set = set()
    for cid in r.get("company_ids") or []:
        if cid in cmap and cid not in seen:
            seen.add(cid)
            ordered.append(cid)
    rid = r.get("id")
    for m in data.get("match_rules") or []:
        if m.get("radar_id") != rid:
            continue
        cid = m.get("company_id")
        if not cid or cid in seen or cid not in cmap:
            continue
        if _fits_current(cmap.get(cid), r):
            seen.add(cid)
            ordered.append(cid)
    return ordered


def _radar_match_count(data: dict, r: dict, cmap: dict | None = None) -> int:
    """雷达条目匹配企业数：与 policy_match_for 同源。"""
    return len(_radar_match_company_ids(data, r, cmap))


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
    benefit: str | None = "all",
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
        "benefit_filter": benefit or "all",
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


def policy_match_for(radar_id: str, benefit: str | None = "all"):
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
    rules_by_cid = {}
    for m in DATA["match_rules"]:
        if m.get("radar_id") != radar_id:
            continue
        cid = m.get("company_id")
        if cid and cid not in rules_by_cid:
            rules_by_cid[cid] = m

    rows = []
    for cid in _radar_match_company_ids(DATA, radar, cmap):
        c = cmap.get(cid) or {}
        m = rules_by_cid.get(cid)
        if m is None:
            # company_ids 有、match_rules 无：合成初筛行，保证弹窗 logo 与卡片数一致
            m = {
                "id": f"auto_{radar_id}_{cid}",
                "company_id": cid,
                "radar_id": radar_id,
                "state": "符合",
                "citation": radar.get("citation")
                or radar.get("enterprise_help")
                or radar.get("value_one_liner")
                or "",
                "gap": None,
            }
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
                "citation": m.get("citation") or "",
                "gap": m.get("gap"),
                "company_id": cid,
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
    radar_map = _radar_by_id(DATA)

    active_policies = 0
    public_events = 0
    deadline_items = []
    upcoming_events = []
    subsidy_wan = 0.0
    for r in radar_raw:
        win = _window_urgency(r)
        if win["urgency"] == "expired" or r.get("stale") is True:
            continue
        ch = _radar_channel(r)
        if ch == "公开活动":
            public_events += 1
        elif ch == "政府政策":
            active_policies += 1
        # 平台规则活动：演示口径，不计入政府政策/公开活动统计
        subsidy_wan += _parse_subsidy_demo_wan(r.get("subsidy_detail") or "")
        match_n = _radar_match_count(DATA, r, cmap)
        if win["urgency"] in ("urgent", "watch") and win["days_left"] is not None:
            deadline_items.append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "days_left": win["days_left"],
                    "urgency": win["urgency"],
                    "doc_no": r.get("doc_no") or "",
                    "channel": ch,
                    "match_count": match_n,
                }
            )
        if ch == "公开活动" and win["days_left"] is not None and win["days_left"] >= 0:
            upcoming_events.append(
                {
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "days_left": win["days_left"],
                    "urgency": win["urgency"],
                    "event_start": (r.get("event_start") or r.get("window_start") or "")[:10],
                    "event_end": (r.get("event_end") or r.get("window_end") or "")[:10],
                    "doc_no": r.get("doc_no") or "",
                    "match_count": match_n,
                }
            )
    deadline_items.sort(
        key=lambda x: (
            URGENCY_RANK.get(x["urgency"], 9),
            x["days_left"] if x["days_left"] is not None else 10**9,
        )
    )
    upcoming_events.sort(
        key=lambda x: (
            x["days_left"] if x["days_left"] is not None else 10**9,
            x.get("event_start") or "",
        )
    )
    deadlines_urgent = [x for x in deadline_items if x["urgency"] == "urgent"]
    deadlines_watch = [x for x in deadline_items if x["urgency"] == "watch"]

    matching = 0
    for m in match_rules:
        c = cmap.get(m.get("company_id"))
        r = radar_map.get(m.get("radar_id"), {})
        if c and r and _fits_current(c, r) and m.get("state") in ("符合", "待核验"):
            matching += 1

    # SOP：五步分布 + 兼容旧漏斗；本周待办从状态聚合
    sop_progress = {"send": 0, "accept": 0, "apply": 0, "processing": 0, "passed": 0}
    funnel = {"sent": 0, "accepted": 0, "passed": 0}
    todos = {"pending_send": 0, "pending_accept": 0}
    seen = set()
    for m in match_rules:
        mid = m.get("id")
        if not mid or mid in seen:
            continue
        seen.add(mid)
        c = cmap.get(m.get("company_id"))
        r = radar_map.get(m.get("radar_id"), {})
        if not (c and r and _fits_current(c, r)):
            continue
        if m.get("state") not in ("符合", "待核验"):
            continue
        st = get_sop_state(mid, m)
        step = int(st.get("sop_step", 0))
        status = st.get("sop_status") or "active"
        if status == "rejected":
            continue
        if status == "passed" or step >= 5:
            sop_progress["passed"] += 1
            funnel["passed"] += 1
            funnel["accepted"] += 1
            funnel["sent"] += 1
        else:
            keys = ("send", "accept", "apply", "processing", "passed")
            idx = max(0, min(4, step))
            sop_progress[keys[idx]] += 1
            if step >= 2:
                funnel["accepted"] += 1
                funnel["sent"] += 1
            elif step >= 1 or (CONFIRMED.get(mid) or {}).get("action") == "confirm":
                funnel["sent"] += 1
            if step <= 0:
                todos["pending_send"] += 1
            elif step == 1:
                todos["pending_accept"] += 1

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
            "matching": matching,
            "matching_label": "匹配进行中（条）",
            "touched": funnel["sent"],
            "touched_label": "本季触达（条·演示）",
            "accepted": funnel["accepted"],
            "accepted_label": "企业接受（条·演示）",
            "passed": funnel["passed"],
            "passed_label": "SOP 已通过（条）",
        },
        # 死线/活动列表仍计算，首页不再渲染；供其他端兼容
        "deadlines": deadline_items,
        "deadlines_urgent": deadlines_urgent,
        "deadlines_watch": deadlines_watch,
        "upcoming_events": upcoming_events,
        "todos": todos,
        "todo_labels": {
            "pending_send": "待发送匹配",
            "pending_accept": "待企业接受",
        },
        "sop_progress": sop_progress,
        "sop_progress_labels": {
            "send": "发送",
            "accept": "接受",
            "apply": "申请",
            "processing": "办理",
            "passed": "通过",
        },
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
                "reject_reason": sop.get("reject_reason") or m.get("reject_reason") or "",
                "fail_reason": sop.get("fail_reason") or m.get("fail_reason") or m.get("reject_reason") or "",
                "radar": _radar_card_fields(r),
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
    _annotate_match_conflicts(matches, DATA)
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
            "headcount_bands": c.get("headcount_bands") or {"rd": 0, "biz": 0, "other": 0},
            "fields": c.get("fields"),
            "address": c.get("address") or "",
            "contact_lead": c.get("contact_lead") or "",
            "phone": c.get("phone") or c.get("contact_phone") or "",
            "contact_phone": c.get("contact_phone") or c.get("phone") or "",
        },
        "match_key": ["size_band", "service_needs"],
        "conflict_pairs": DATA.get("conflict_pairs") or [],
        "matches": matches,
    }


# 企业端「匹配的服务」渠道：三服务优先，平台规则活动可选归入并分组展示
CORP_SERVICE_CHANNELS = ("园区服务", "阿里服务", "机构服务", "平台规则活动")
CORP_SERVICE_CHANNEL_SET = frozenset(CORP_SERVICE_CHANNELS)


def _corp_service_source_label(r: dict) -> str:
    src = r.get("source")
    if isinstance(src, dict) and src.get("name"):
        return str(src["name"])
    for key in ("agency", "doc_no", "platform", "official_source"):
        val = r.get(key)
        if val:
            return str(val)
    return ""


def _enrich_corp_radar_fields(rad: dict | None, r: dict, ch: str) -> dict:
    """企业端拆分时补齐 radar 展示字段（channel / 权益句 / 窗口）。"""
    out = rad if isinstance(rad, dict) else _radar_card_fields(r)
    out["channel"] = ch
    out["value_one_liner"] = r.get("value_one_liner") or out.get("value_one_liner") or ""
    out["benefit_one_liner"] = r.get("benefit_one_liner") or out.get("benefit_one_liner") or ""
    out["subsidy_detail"] = r.get("subsidy_detail") or out.get("subsidy_detail") or ""
    out["amount_label"] = r.get("amount_label") or out.get("amount_label") or ""
    out["hard_criteria"] = list(r.get("hard_criteria") or out.get("hard_criteria") or [])
    out["window_end"] = (r.get("window_end") or r.get("event_end") or out.get("window_end") or "")[:10]
    out["event_start"] = (r.get("event_start") or r.get("window_start") or "")[:10]
    out["event_end"] = (r.get("event_end") or r.get("window_end") or "")[:10]
    win = _window_urgency(r)
    out["days_left"] = win.get("days_left")
    if not out.get("id"):
        out["id"] = r.get("id")
    if not out.get("title"):
        out["title"] = r.get("title")
    return out


def _corp_service_row(m: dict | None, r: dict, ch: str, rad: dict | None = None) -> dict:
    """企业端服务卡统一结构（match 或 radar.company_ids 补齐均可）。"""
    rad = _enrich_corp_radar_fields(rad, r, ch)
    rid = r.get("id") or rad.get("id") or ""
    mid = (m or {}).get("id")
    return {
        "id": mid or f"svc_{rid}",
        "match_id": mid,
        "radar_id": rid,
        "title": r.get("title") or rad.get("title") or "",
        "channel": ch,
        "source_label": _corp_service_source_label(r),
        "value_one_liner": (
            r.get("value_one_liner")
            or r.get("benefit_one_liner")
            or r.get("enterprise_help")
            or (m or {}).get("citation")
            or ""
        ),
        "citation": (m or {}).get("citation") or r.get("citation") or "",
        "group": "平台规则" if ch == "平台规则活动" else "服务",
        "radar": rad,
    }


def corp_home(company_id: str):
    """企业端首页：匹配政策 + 匹配大会 + 匹配的服务 + 地址/联系人。"""
    out = policy_match(company_id)
    if not out:
        return None
    DATA = load_data()
    raw = _companies_by_id(DATA).get(company_id) or {}
    co = out.setdefault("company", {})
    co["address"] = co.get("address") or raw.get("address") or ""
    co["contact_lead"] = co.get("contact_lead") or raw.get("contact_lead") or ""
    co["phone"] = co.get("phone") or raw.get("phone") or raw.get("contact_phone") or ""
    co["contact_phone"] = (
        co.get("contact_phone") or raw.get("contact_phone") or raw.get("phone") or ""
    )
    co["headcount_range"] = co.get("headcount_range") or raw.get("headcount_range") or ""

    radar = _radar_by_id(DATA)
    policies = []
    events = []
    services = []
    seen_service_rids: set[str] = set()
    for m in out.get("matches") or []:
        rid = ((m.get("radar") or {}).get("id")) or ""
        r = radar.get(rid) or {}
        ch = _radar_channel(r)
        rad = _enrich_corp_radar_fields(m.get("radar"), r, ch)
        m["radar"] = rad
        if ch == "公开活动":
            events.append(
                {
                    "id": m.get("id"),
                    "match_id": m.get("id"),
                    "radar_id": rid,
                    "title": r.get("title") or rad.get("title") or "",
                    "event_start": (r.get("event_start") or r.get("window_start") or "")[:10],
                    "event_end": (r.get("event_end") or r.get("window_end") or "")[:10],
                    "value_one_liner": (
                        r.get("value_one_liner")
                        or r.get("enterprise_help")
                        or m.get("citation")
                        or ""
                    ),
                    "citation": m.get("citation") or "",
                    "channel": "公开活动",
                    "radar": rad,
                }
            )
        elif ch in CORP_SERVICE_CHANNEL_SET:
            services.append(_corp_service_row(m, r, ch, rad))
            if rid:
                seen_service_rids.add(rid)
        else:
            policies.append(m)

    # 补齐：雷达 company_ids 已挂本企、但尚未写 match_rules 的服务类条目
    company = raw or co
    for r in DATA.get("radar") or []:
        ch = _radar_channel(r)
        if ch not in CORP_SERVICE_CHANNEL_SET:
            continue
        rid = r.get("id") or ""
        if not rid or rid in seen_service_rids:
            continue
        if company_id not in (r.get("company_ids") or []):
            continue
        if not _fits_current(company, r):
            continue
        services.append(_corp_service_row(None, r, ch, None))
        seen_service_rids.add(rid)

    rank = {ch: i for i, ch in enumerate(CORP_SERVICE_CHANNELS)}
    services.sort(key=lambda s: (rank.get(s.get("channel") or "", 99), s.get("title") or ""))

    out["matches"] = policies
    out["events"] = events
    out["services"] = services
    return out


# 产业方向短标签：与 data.json companies[].direction_tag / industry 对齐
DIRECTION_TAGS: dict[str, str] = {
    "smart_tools": "智能工具",
    "digital_content": "数字内容",
    "ecommerce": "电商运营",
    "hardtech": "硬科创孵化",
    "industrial_vision": "工业视觉",
    "logistics": "仓配物流",
}

_DIRECTION_HINTS: tuple[tuple[str, str], ...] = (
    ("数字内容", "digital_content"),
    ("电商", "ecommerce"),
    ("硬科创", "hardtech"),
    ("孵化", "hardtech"),
    ("工业视觉", "industrial_vision"),
    ("视觉", "industrial_vision"),
    ("仓配", "logistics"),
    ("物流", "logistics"),
    ("供应链", "logistics"),
    ("智能工具", "smart_tools"),
    ("OPC", "smart_tools"),
    ("一人公司", "smart_tools"),
)


def _direction_tag(company: dict) -> str:
    tag = (company.get("direction_tag") or "").strip()
    if tag:
        return tag
    text = str(company.get("direction") or "")
    for hint, slug in _DIRECTION_HINTS:
        if hint in text:
            return slug
    return ""


def _industry_label(company: dict) -> str:
    label = (company.get("industry") or "").strip()
    if label:
        return label
    return DIRECTION_TAGS.get(_direction_tag(company), "")


def list_companies(size_band: str | None = None, direction: str | None = None):
    DATA = load_data()
    cmap = _companies_by_id(DATA)
    radar = _radar_by_id(DATA)
    # 与 /api/policy_match「当前可匹配」同源：现行有效 match_rules + _fits_current
    match_counts: dict[str, int] = {}
    for m in DATA.get("match_rules") or []:
        cid = m.get("company_id")
        if not cid or cid not in cmap:
            continue
        r = radar.get(m.get("radar_id"), {})
        if not _fits_current(cmap.get(cid), r):
            continue
        match_counts[cid] = match_counts.get(cid, 0) + 1
    rows = []
    for c in DATA["companies"]:
        if size_band and c.get("size_band") != size_band:
            continue
        tag = _direction_tag(c)
        if direction and tag != direction:
            continue
        rows.append(
            {
                "id": c["id"],
                "code": c["code"],
                "display_name": c.get("display_name") or c.get("alias") or c["code"],
                "alias": c.get("alias") or c.get("display_name") or c["code"],
                "logo": c.get("logo") or "",
                "direction": c["direction"],
                "direction_tag": tag,
                "industry": _industry_label(c),
                "size_band": c.get("size_band"),
                "headcount_range": c["headcount_range"],
                "funding_stage": c["funding_stage"],
                "service_needs": c["service_needs"],
                "stage_path": _stage_path(c),
                "address": c.get("address") or "",
                "contact_lead": c.get("contact_lead") or "",
                "phone": c.get("phone") or c.get("contact_phone") or "",
                "contact_phone": c.get("contact_phone") or c.get("phone") or "",
                "match_count": match_counts.get(c["id"], 0),
            }
        )
    return {"meta": DATA["meta"], "companies": rows, "direction_tags": DIRECTION_TAGS}


def match_board(state: str | None = None, benefit: str | None = "all", review: str | None = None):
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
        "benefit_filter": benefit or "all",
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


def do_remind(body: dict):
    """演示通道：记录短信/电话提醒意图，不承诺真发到公网用户。"""
    DATA = load_data()
    company_id = (body.get("company_id") or "").strip()
    channel = (body.get("channel") or "").strip().lower()
    operator = body.get("operator") or DATA.get("meta", {}).get("operator_default", "OP-01")
    note = (body.get("note") or "").strip()
    if channel not in ("sms", "call"):
        return {"ok": False, "error": "channel 须为 sms 或 call"}, 400
    cmap = _companies_by_id(DATA)
    if not company_id or company_id not in cmap:
        return {"ok": False, "error": "脱敏企业不存在"}, 404
    c = cmap[company_id]
    phone = c.get("phone") or c.get("contact_phone") or ""
    contact_phone = c.get("contact_phone") or c.get("phone") or ""
    op_label = next(
        (o["label"] for o in DATA.get("operators", []) if o["id"] == operator), operator
    )
    channel_label = "短信" if channel == "sms" else "电话"
    entry = {
        "id": f"remind_{uuid.uuid4().hex[:8]}",
        "at": datetime.now(timezone.utc).isoformat(),
        "company_id": company_id,
        "channel": channel,
        "channel_label": channel_label,
        "operator": operator,
        "operator_label": op_label,
        "phone": phone,
        "contact_phone": contact_phone,
        "note": note,
        "demo": True,
        "transport": "演示通道",
        "message": f"已发起{channel_label}提醒（演示通道 · 不发公网）",
    }
    # 无真实运营商密钥时仅落盘；若日后配置短信/语音 API，在此薄封装调用。
    with open(REMIND_PATH, "a", encoding="utf-8") as log:
        log.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return {"ok": True, "entry": entry, "demo": True, "transport": "演示通道"}, 200


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


def do_attract_handover(body: dict):
    DATA = load_data()
    company_name = body.get("name") or "意向企业"
    direction = body.get("direction") or "人工智能/智能体研发"
    size_band = body.get("size_band") or "s_3_20"
    headcount = body.get("headcount") or 10
    area = body.get("area") or 120
    operator = body.get("operator") or DATA.get("meta", {}).get("operator_default", "OP-01")
    op_label = next((o["label"] for o in DATA.get("operators", []) if o["id"] == operator), operator)
    at = datetime.now(timezone.utc).isoformat()
    cid = f"corp_attr_{int(datetime.now().timestamp())}"
    
    tag = _direction_tag({"direction": direction})
    new_company = {
        "id": cid,
        "code": company_name,
        "direction": direction,
        "direction_tag": tag or "smart_tools",
        "industry": DIRECTION_TAGS.get(tag or "smart_tools", "智能工具"),
        "size_band": size_band,
        "headcount_range": f"{headcount}人",
        "funding_stage": "招商签约 / 入驻初期",
        "service_needs": ["政策申报辅导", "算力补贴对接", "工商/场地合规"],
        "display_name": company_name,
        "alias": company_name,
        "address": f"云谷中心 · 招商入驻专属工位（{area}㎡）",
        "contact_lead": f"招商专员 {op_label} 签约交接",
        "phone": f"135****{(abs(hash(cid)) % 10000):04d}",
        "contact_phone": f"1350013{(abs(hash(cid)) % 10000):04d}",
        "attraction_memos": [
            {
                "item": "招商测算红利备忘与交接",
                "role": f"{op_label}（留痕）",
                "note": f"首年降本测算交接归档，意向面积{area}㎡，招商政策承诺已冻结"
            }
        ],
        "evidence": [
            {"key": "招商入驻意向协议", "status": "verified", "label": "已签署"},
            {"key": "2026政策红利测算单", "status": "verified", "label": "已出具"},
            {"key": "工商设立/工位备案", "status": "pending", "label": "办理中"}
        ]
    }
    
    DATA["companies"].append(new_company)
    save_data(DATA)

    entry = {
        "at": at,
        "kind": "attract_handover",
        "company_id": cid,
        "company_name": company_name,
        "operator": operator,
        "operator_label": op_label,
        "note": f"招商签约成功，移交企服团队履约"
    }
    with open(LOG_PATH, "a", encoding="utf-8") as log:
        log.write(json.dumps(entry, ensure_ascii=False) + "\n")
        
    return {"ok": True, "company_id": cid, "message": "签约交接成功，已归档至企服运营名册"}, 200


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
    reason = ""
    op_label = next(
        (o["label"] for o in DATA["operators"] if o["id"] == operator), operator
    )
    at = datetime.now(timezone.utc).isoformat()

    if action == "reject":
        if status != "active":
            return {"ok": False, "error": "终态不可再驳回"}, 400
        status = "rejected"
        reason = (
            (body.get("reject_reason") or body.get("fail_reason") or "").strip()
            or (rule.get("reject_reason") or rule.get("fail_reason") or "").strip()
            or "专员驳回（未填原因）"
        )
        # 终态旁路：停在当前步，末节点展示「未通过」
    elif action == "reset":
        reason = ""
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
        reason = st.get("reject_reason") or ""
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

    sop_entry = {"sop_step": step, "sop_status": status}
    if status == "rejected" and reason:
        sop_entry["reject_reason"] = reason
    SOP[match_id] = sop_entry
    entry = {
        "at": at,
        "match_id": match_id,
        "company_id": company_id,
        "action": action,
        "sop_step": step,
        "sop_status": status,
        "operator": operator,
    }
    if status == "rejected" and reason:
        entry["reject_reason"] = reason
        entry["fail_reason"] = reason
    _append_sop_log(entry)
    payload = sop_payload(match_id, rule)
    out = {"ok": True, "entry": entry, **payload}
    if draft is not None:
        out["draft"] = draft
    elif CONFIRMED.get(match_id, {}).get("draft"):
        out["draft"] = CONFIRMED[match_id]["draft"]
    return out, 200


def create_radar(body: dict):
    """运营端新增一条企服雷达（任意渠道），写入 data.json。"""
    DATA = load_data()
    title = str(body.get("title") or "").strip()
    if not title:
        return {"ok": False, "error": "title required"}, 400
    channel = _normalize_channel(body.get("channel")) or "政府政策"
    if channel not in RADAR_CHANNELS:
        return {"ok": False, "error": f"channel must be one of {list(RADAR_CHANNELS)}"}, 400

    cmap = _companies_by_id(DATA)
    raw_ids = body.get("company_ids") or []
    if isinstance(raw_ids, str):
        raw_ids = [x.strip() for x in raw_ids.split(",") if x.strip()]
    company_ids = [cid for cid in raw_ids if cid in cmap]

    platform = str(body.get("platform") or "").strip() or None
    window = str(body.get("window") or "").strip() or "演示窗口 · 进行中"
    amount_label = str(body.get("amount_label") or "").strip() or "—"
    one_liner = str(body.get("value_one_liner") or body.get("one_liner") or "").strip()
    if not one_liner:
        one_liner = f"{title}（演示录入）"

    rid = str(body.get("id") or "").strip()
    if not rid:
        rid = f"rad_demo_{uuid.uuid4().hex[:10]}"
    if any(r.get("id") == rid for r in DATA.get("radar") or []):
        return {"ok": False, "error": "id already exists"}, 409

    track_prefix = {
        "政府政策": "演示/政府政策",
        "公开活动": "公开活动/演示",
        "平台规则活动": "平台规则/演示",
        "园区服务": "园区服务/演示",
        "阿里服务": "阿里服务/演示",
        "机构服务": "机构服务/演示",
    }.get(channel, "演示")

    item = {
        "id": rid,
        "lifecycle_status": "active",
        "track": track_prefix,
        "title": title,
        "version": "演示录入",
        "window": window,
        "doc_no": "",
        "agency": str(body.get("agency") or "云谷企服（演示）").strip(),
        "value_one_liner": one_liner,
        "citation": f"演示条目 · {title}",
        "hard_criteria": ["演示口径 · 不构成正式申报依据"],
        "subsidy_detail": amount_label,
        "company_ids": company_ids,
        "helps_park": True,
        "helps_enterprise": True,
        "park_help": "演示：园区可据此触达",
        "enterprise_help": "演示：企业可据此了解",
        "dual_benefit": True,
        "channel": channel,
        "amount_label": amount_label,
    }
    if platform:
        item["platform"] = platform
    win_end = str(body.get("window_end") or "").strip()
    if win_end:
        item["window_end"] = win_end[:10]

    DATA.setdefault("radar", []).append(item)

    # 可选：为勾选企业写初筛 match_rules，避免仅有 company_ids 时匹配弹窗空
    created_matches = []
    if body.get("create_matches", True) and company_ids:
        rules = DATA.setdefault("match_rules", [])
        for cid in company_ids:
            mid = f"m_demo_{rid[-8:]}_{cid[-6:]}"
            if any(m.get("id") == mid for m in rules):
                continue
            rules.append(
                {
                    "id": mid,
                    "company_id": cid,
                    "radar_id": rid,
                    "state": "符合",
                    "citation": f"演示匹配 · {title}",
                    "gap": None,
                    "draft_template": "（演示）您好，对照「{title}」，贵司初筛为符合。—{{operator}}".replace(
                        "{title}", title
                    ),
                }
            )
            created_matches.append(mid)

    save_data(DATA)
    return {
        "ok": True,
        "item": item,
        "match_ids": created_matches,
        "message": "已新增雷达条目（演示）",
    }, 200


def delete_radar(radar_id: str | None, cleanup_matches: bool = True):
    """删除一条雷达；默认一并清理关联 match_rules，避免悬空引用。"""
    if not radar_id:
        return {"ok": False, "error": "id required"}, 400
    DATA = load_data()
    radar_list = DATA.get("radar") or []
    before = len(radar_list)
    DATA["radar"] = [r for r in radar_list if r.get("id") != radar_id]
    if len(DATA["radar"]) == before:
        return {"ok": False, "error": "radar not found"}, 404

    removed_matches = 0
    if cleanup_matches:
        rules = DATA.get("match_rules") or []
        kept = [m for m in rules if m.get("radar_id") != radar_id]
        removed_matches = len(rules) - len(kept)
        DATA["match_rules"] = kept

    save_data(DATA)
    return {
        "ok": True,
        "id": radar_id,
        "removed_matches": removed_matches,
        "message": "已删除雷达条目",
    }, 200


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[ops-console] {args[0]}")

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
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

    def do_HEAD(self):
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/html; charset=utf-8")
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
        if path in ("/CLI_DOCKER_SOP.md", "/docker-sop.md", "/cli-sop.md"):
            return self._file(
                os.path.join(ROOT, "CLI_DOCKER_SOP.md"), "text/markdown; charset=utf-8"
            )
        if path in ("/README.md", "/readme.md"):
            return self._file(
                os.path.join(ROOT, "README.md"), "text/markdown; charset=utf-8"
            )
        if path in ("/LICENSE", "/license"):
            return self._file(
                os.path.join(ROOT, "LICENSE"), "text/plain; charset=utf-8"
            )

        decoded_path = unquote(path)
        if (decoded_path.startswith("/logos/") or decoded_path.startswith("/screenshots/")) and ".." not in decoded_path:
            top_dir = "logos" if decoded_path.startswith("/logos/") else "screenshots"
            prefix = f"/{top_dir}/"
            rel = decoded_path[len(prefix) :]
            if rel and all(p and p not in (".", "..") for p in rel.split("/")):
                asset_path = os.path.join(ROOT, top_dir, *rel.split("/"))
                if os.path.isfile(asset_path):
                    lower = asset_path.lower()
                    if lower.endswith(".svg"):
                        ctype = "image/svg+xml"
                    elif lower.endswith(".png"):
                        ctype = "image/png"
                    elif lower.endswith((".jpg", ".jpeg")):
                        ctype = "image/jpeg"
                    elif lower.endswith(".webp"):
                        ctype = "image/webp"
                    elif lower.endswith(".ico"):
                        ctype = "image/x-icon"
                    else:
                        ctype = "application/octet-stream"
                    return self._file(asset_path, ctype)
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
                    "name": "云谷企服雷达智能匹配系统",
                    "product": "云谷企服雷达智能匹配系统",
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
                    qs.get("benefit", ["all"])[0],
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
            out = policy_match_for(rid, qs.get("benefit", ["all"])[0])
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
        if path == "/api/corp_home":
            cid = qs.get("company_id", [None])[0]
            out = corp_home(cid) if cid else None
            return self._json(200, out) if out else self._json(404, {"error": "not found"})
        if path == "/api/companies":
            return self._json(
                200,
                list_companies(
                    qs.get("size_band", [None])[0],
                    qs.get("direction", [None])[0],
                ),
            )
        if path == "/api/match_board":
            return self._json(
                200,
                match_board(
                    qs.get("state", [None])[0],
                    qs.get("benefit", ["all"])[0],
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
        if parsed.path == "/api/attract/handover":
            payload, code = do_attract_handover(body)
            return self._json(code, payload)
        if parsed.path == "/api/coop_request":
            payload, code = create_coop(body)
            return self._json(code, payload)
        if parsed.path == "/api/remind":
            payload, code = do_remind(body)
            return self._json(code, payload)
        if parsed.path == "/api/radar":
            payload, code = create_radar(body)
            return self._json(code, payload)
        if parsed.path == "/api/radar/delete":
            rid = body.get("id") or parse_qs(parsed.query).get("id", [None])[0]
            cleanup = body.get("cleanup_matches", True)
            if isinstance(cleanup, str):
                cleanup = cleanup.lower() not in ("0", "false", "no")
            payload, code = delete_radar(rid, cleanup_matches=bool(cleanup))
            return self._json(code, payload)
        self._json(404, {"error": "not found"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        if parsed.path == "/api/radar":
            rid = qs.get("id", [None])[0]
            cleanup_raw = str(qs.get("cleanup_matches", ["1"])[0]).lower()
            cleanup = cleanup_raw not in ("0", "false", "no")
            payload, code = delete_radar(rid, cleanup_matches=cleanup)
            return self._json(code, payload)
        self._json(404, {"error": "not found"})


def main():
    seed_coop()
    seed_sop()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"云谷企服雷达智能匹配系统 监听 {HOST}:{PORT}")
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
