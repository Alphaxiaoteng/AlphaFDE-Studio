"""公开活动日更：拉取公开 RSS/列表，写入缓存并合并进雷达 channel=公开活动。

失败诚实降级，不编造条目。密钥不入库。
写入条目必须带 published_at / window_*（或 event_*）时间字段。
"""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(ROOT, "public_events_cache.json")

# 公开源（无密钥）；核不到就降级
FEEDS = [
    {
        "id": "hn_yunqi",
        "name": "HN · Yunqi/Hangzhou AI",
        "url": "https://hnrss.org/newest?q=Hangzhou+AI+OR+Yunqi",
    },
    {
        "id": "hn_zhipu",
        "name": "HN · Zhipu/GLM",
        "url": "https://hnrss.org/newest?q=Zhipu+OR+GLM",
    },
    {
        "id": "people_tech",
        "name": "人民网 · 科技",
        "url": "https://www.people.com.cn/rss/finance.xml",
    },
]

KW_RE = re.compile(
    r"杭州|云栖|智谱|GLM|展会|补贴|AI|人工智能|大模型|黑客松|路演|沙龙|开放日|创业营|Coding",
    re.I,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _http_get(url: str, timeout: float = 12.0) -> bytes:
    req = Request(
        url,
        headers={
            "User-Agent": "OpsConsolePublicEvents/1.0 (+local-demo)",
            "Accept": "*/*",
        },
    )
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _parse_pub_date(raw: str) -> date | None:
    s = (raw or "").strip()
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).date()
    except (TypeError, ValueError, IndexError, OverflowError):
        pass
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


def _item_from_rss(title: str, link: str, pub_raw: str, feed_meta: dict) -> dict:
    pub_d = _parse_pub_date(pub_raw) or date.today()
    # RSS 多为资讯：published_at=发稿日；活动可见窗取发稿日起 45 天（非编造未来假活动日）
    win_end = pub_d + timedelta(days=45)
    pub_iso = pub_d.isoformat()
    end_iso = win_end.isoformat()
    rid = f"evt_agent_{abs(hash(link)) & 0xFFFFFFFF:x}"
    return {
        "id": rid,
        "channel": "公开活动",
        "track": "公开活动/媒体聚合",
        "title": title[:160],
        "version": "公开活动样例 · Agent 日更",
        "window": f"资讯可见窗 {pub_iso} ~ {end_iso}",
        "window_kind": "rolling",
        "window_start": pub_iso,
        "window_end": end_iso,
        "event_start": pub_iso,
        "event_end": end_iso,
        "published_at": pub_iso,
        "published_raw": (pub_raw or "").strip() or None,
        "value_one_liner": "公开活动/媒体解读聚合样例（非政府红头）",
        "citation": (
            f"来源：{feed_meta['name']} · 公开 RSS 标题聚合；"
            f"发稿日 {pub_iso}。日程以官网为准。非政府公文。"
        ),
        "source_url": link,
        "source": {
            "name": feed_meta["name"],
            "url": link,
            "verified": True,
            "note": "agent_daily",
            "published_at": pub_iso,
        },
        "helps_park": True,
        "helps_enterprise": True,
        "dual_benefit": True,
        "company_ids": [],
        "agent_daily": True,
        "provider": "agent_daily",
        "scope": "city",
    }


def _parse_rss(xml_bytes: bytes, feed_meta: dict) -> list[dict]:
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    channel = root.find("channel")
    entries = channel.findall("item") if channel is not None else []
    for ent in entries[:40]:
        title = unescape((ent.findtext("title") or "").strip())
        link = (ent.findtext("link") or "").strip()
        if not title or not link:
            continue
        if not KW_RE.search(title):
            continue
        pub = (ent.findtext("pubDate") or "").strip()
        if not pub:
            for child in ent:
                tag = child.tag.rsplit("}", 1)[-1]
                if tag in ("pubDate", "published", "updated", "date") and (child.text or "").strip():
                    pub = child.text.strip()
                    break
        items.append(_item_from_rss(title, link, pub, feed_meta))
    return items


def fetch_public_events() -> dict[str, Any]:
    """拉取并写缓存。返回 {ok, items, sources, fetched_at, notice}。"""
    sources: list[dict] = []
    pool: list[dict] = []
    for feed in FEEDS:
        st = {
            "id": feed["id"],
            "name": feed["name"],
            "ok": False,
            "detail": "",
            "count": 0,
        }
        try:
            raw = _http_get(feed["url"])
            got = _parse_rss(raw, feed)
            pool.extend(got)
            st["ok"] = bool(got)
            st["count"] = len(got)
            st["detail"] = f"{len(got)} 条命中关键词" if got else "无关键词命中"
        except (HTTPError, URLError, TimeoutError, OSError) as e:
            st["detail"] = f"拉取失败：{type(e).__name__}"
        sources.append(st)

    seen: set[str] = set()
    uniq: list[dict] = []
    for it in pool:
        u = it.get("source_url") or it["id"]
        if u in seen:
            continue
        seen.add(u)
        uniq.append(it)

    notice = None
    if not uniq:
        notice = "公开源暂无可用条目或网络不可达；未编造活动。"

    out = {
        "ok": True,
        "fetched_at": _now_iso(),
        "sources": sources,
        "items": uniq[:40],
        "count": len(uniq[:40]),
        "notice": notice,
        "note": "Agent 日更公开活动缓存；含 published_at / window_* / event_*；非政府公文。",
    }
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
    except OSError:
        out["notice"] = (out.get("notice") or "") + " · 写缓存失败"
    return out


def load_cached_events() -> list[dict]:
    if not os.path.isfile(CACHE_PATH):
        return []
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return list(data.get("items") or [])
    except (OSError, json.JSONDecodeError):
        return []


def merge_cached_events_into_radar(data: dict) -> dict:
    """把缓存公开活动合并进 radar 副本（不改写 data.json）。"""
    cached = load_cached_events()
    if not cached:
        return data
    radar = list(data.get("radar") or [])
    existing = {r.get("id") for r in radar}
    # 也按 URL 去重
    urls = {
        (r.get("source_url") or (r.get("source") or {}).get("url") or "")
        for r in radar
    }
    added = 0
    for it in cached:
        rid = it.get("id")
        url = it.get("source_url") or ""
        if rid in existing or (url and url in urls):
            continue
        row = dict(it)
        row["channel"] = "公开活动"
        # 兜底时间字段
        if not row.get("window_end") and row.get("event_end"):
            row["window_end"] = row["event_end"]
        if not row.get("window_start") and row.get("event_start"):
            row["window_start"] = row["event_start"]
        row.setdefault("source", {"name": "agent_daily", "verified": True, "note": "agent_daily"})
        if isinstance(row["source"], dict):
            row["source"]["note"] = "agent_daily"
        radar.append(row)
        existing.add(rid)
        if url:
            urls.add(url)
        added += 1
    if not added:
        return data
    out = dict(data)
    out["radar"] = radar
    return out
