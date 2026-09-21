"""媒体信息热点：TikHub / RSS / allnet.hot 聚合（本地 demo）。

密钥只读环境变量 TIKHUB_API_KEY（或 TIKHUB_BASE_URL），其次 ~/.alpha-nexus/tikhub_api_key；
绝不写入 data.json / git / 响应体。
"""
from __future__ import annotations

import json
import os
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(ROOT, "media_hotspots_cache.json")
LEGACY_CACHE = os.path.join(ROOT, "media_hot_cache.json")
CACHE_TTL_SEC = 900  # 15 分钟
DEFAULT_SINCE = "2025-09-01"
ALL_CAP_DAYS = 180

# 默认偏政策 / 园区 / 企服
DEFAULT_KEYWORDS = (
    "政策",
    "AI",
    "人工智能",
    "大模型",
    "算力",
    "AIGC",
    "补贴",
    "培育",
    "园区",
    "企服",
    "OPC",
    "雏鹰",
    "高新",
    "孵化",
    "产业园",
)

# 标题/摘要必须命中其一，否则丢弃（不再用「杭州」单独放行）
POLICY_RE = re.compile(
    "|".join(
        re.escape(k)
        for k in (
            "AI",
            "人工智能",
            "大模型",
            "算力",
            "AIGC",
            "DeepSeek",
            "政策",
            "补贴",
            "奖补",
            "园区",
            "产业园",
            "企服",
            "OPC",
            "孵化",
            "高新",
            "雏鹰",
            "培育",
            "国务院",
            "工信部",
            "发改委",
        )
    ),
    re.I,
)

# 明显无关：公摊 / 遛娃 / 炒茶非遗等
NOISE_RE = re.compile(
    r"公摊|廊道占用|遛娃|逛娃|亲子|炒茶|非遗|文脉华章|太极招式|周末遛|宝宝|带娃",
    re.I,
)
SHOWPLAYER_RE = re.compile(r"showPlayer\s*\(\s*\{.*?\}\s*\)\s*;?", re.I | re.S)
VIDEO_SRC_RE = re.compile(
    r"""(?:src|url)\s*[:=]\s*['"](https?://[^'"]+\.(?:mp4|webm|m3u8)[^'"]*)['"]""",
    re.I,
)

TIKHUB_QUERIES = [
    "杭州 政策 园区",
    "算力 补贴 政策",
    "雏鹰企业 培育",
    "企服 OPC",
]

RSS_FEEDS = [
    {
        "id": "people_politics",
        "name": "人民网 · 时政",
        "url": "https://www.people.com.cn/rss/politics.xml",
    },
    {
        "id": "chinanews_scroll",
        "name": "中新网 · 滚动",
        "url": "https://www.chinanews.com.cn/rss/scroll-news.xml",
    },
    {
        "id": "hnrss_ai_policy",
        "name": "Hacker News · AI policy",
        "url": "https://hnrss.org/newest?q=AI+policy",
    },
]

ALLNET_HOME = "https://allnet.hot/"
ALLNET_API_BASE = "https://api.allnet.hot/api/open/v1"
# 文档：https://allnet.hot/api-docs · 鉴权头 X-API-Key
ALLNET_SOURCE_SEARCH_KW = ("AI", "人工智能", "科技", "政策", "数码", "互联网", "36氪", "机器之心", "知乎")

# 缺密钥或实时源无图时：最多 3 条样例，必须标「样例」
SAMPLE_ITEMS = [
    {
        "id": "sample_policy_img_1",
        "title": "【样例】地方算力券 / 产业政策解读封面占位",
        "source": "样例 · 未配置真实源时",
        "url": "https://www.gov.cn/zhengce/zuixin.htm",
        "topic": "policy",
        "media_type": "image",
        "published_at": "2026-09-20T08:00:00+00:00",
        "thumb": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Chinese_government_emblem.png/320px-Chinese_government_emblem.png",
        "video_url": "",
        "summary": "样例占位图；配置 TIKHUB_API_KEY 或 allnet 成功后会被真实条目替换。",
        "provider": "sample",
        "is_sample": True,
    },
    {
        "id": "sample_park_img_2",
        "title": "【样例】园区 / 企服热点图文占位",
        "source": "样例 · 未配置真实源时",
        "url": "https://qinqing.hangzhou.gov.cn/",
        "topic": "policy",
        "media_type": "image",
        "published_at": "2026-09-19T10:00:00+00:00",
        "thumb": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Hangzhou_West_Lake_4.jpg/320px-Hangzhou_West_Lake_4.jpg",
        "video_url": "",
        "summary": "样例占位图（西湖公开影像），非实时热点。",
        "provider": "sample",
        "is_sample": True,
    },
    {
        "id": "sample_video_3",
        "title": "【样例】政策向短视频形态占位 · 有 TikHub 后显示可播封面",
        "source": "样例 · 视频占位",
        "url": "https://www.douyin.com/search/%E6%9D%AD%E5%B7%9E%20%E6%94%BF%E7%AD%96",
        "topic": "policy",
        "media_type": "video",
        "published_at": "2026-09-18T12:00:00+00:00",
        "thumb": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Hangzhou_Skyline.jpg/320px-Hangzhou_Skyline.jpg",
        "video_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
        "summary": "样例可播短片（MDN CC0）；真实抖音/小红书需 TikHub。",
        "provider": "sample",
        "is_sample": True,
    },
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def resolve_tikhub_key() -> str | None:
    env = (os.environ.get("TIKHUB_API_KEY") or "").strip()
    if env:
        return env
    path = os.path.expanduser("~/.alpha-nexus/tikhub_api_key")
    try:
        if os.path.isfile(path):
            with open(path, "r", encoding="utf-8") as f:
                key = f.read().strip()
            if key:
                return key
    except OSError:
        pass
    return None


def _load_local_dotenv() -> None:
    """读取未入库的 .env（若存在）；不覆盖已有环境变量。"""
    path = os.path.join(ROOT, ".env")
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip("'").strip('"')
                if k and k not in os.environ:
                    os.environ[k] = v
    except OSError:
        pass


_load_local_dotenv()


def resolve_allnet_key() -> str | None:
    key = (os.environ.get("ALLNET_API_KEY") or "").strip()
    return key or None


def resolve_tikhub_base() -> str:
    return (os.environ.get("TIKHUB_BASE_URL") or "https://api.tikhub.dev").rstrip("/")


def _http_get(url: str, timeout: float = 12.0, headers: dict | None = None) -> bytes:
    hdrs = {
        "User-Agent": "OpsConsoleMediaHotspots/1.0 (+local-demo)",
        "Accept": "*/*",
    }
    if headers:
        hdrs.update(headers)
    req = Request(url, headers=hdrs)
    with urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _http_json(
    method: str,
    url: str,
    *,
    headers: dict | None = None,
    body: dict | None = None,
    timeout: float = 28.0,
) -> tuple[int, dict]:
    hdrs = {
        "User-Agent": "OpsConsoleMediaHotspots/1.0 (+local-demo)",
        "Accept": "application/json",
    }
    if headers:
        hdrs.update(headers)
    data = None
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs["Content-Type"] = "application/json"
    req = Request(url, data=data, headers=hdrs, method=method.upper())
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            code = getattr(resp, "status", 200) or 200
            return int(code), json.loads(raw)
    except HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace") if e.fp else ""
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw[:200]}
        # 勿把 token 回显带进 detail
        return int(e.code), payload


def _policy_hit(text: str) -> bool:
    return bool(POLICY_RE.search(text or ""))


def _noise_hit(text: str) -> bool:
    return bool(NOISE_RE.search(text or ""))


def _relevant(title: str, summary: str = "") -> bool:
    blob = f"{title or ''} {summary or ''}"
    if _noise_hit(blob):
        return False
    return _policy_hit(blob)


def _normalize_published_at(raw: str | int | float | None) -> str:
    """统一为可解析 ISO8601；失败返回空串。"""
    if raw is None or raw == "":
        return ""
    if isinstance(raw, (int, float)):
        ts = int(raw)
        if ts > 10_000_000_000:  # ms
            ts //= 1000
        try:
            return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
        except (OverflowError, OSError, ValueError):
            return ""
    s = str(raw).strip()
    if not s:
        return ""
    # already ISO-ish YYYY-MM-DD...
    if re.match(r"^\d{4}-\d{2}-\d{2}", s):
        try:
            if s.endswith("Z"):
                dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
            elif "T" in s:
                dt = datetime.fromisoformat(s)
            else:
                dt = datetime.fromisoformat(s[:10]).replace(tzinfo=timezone.utc)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.isoformat()
        except ValueError:
            pass
    try:
        dt = parsedate_to_datetime(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    except (TypeError, ValueError, IndexError):
        return ""


def _clean_summary(text: str) -> tuple[str, str]:
    """去掉 showPlayer 脚本；若有合法视频 URL 一并抽出。"""
    raw = text or ""
    video = ""
    m = SHOWPLAYER_RE.search(raw)
    if m:
        block = m.group(0)
        vm = VIDEO_SRC_RE.search(block)
        if vm:
            video = vm.group(1)
        raw = SHOWPLAYER_RE.sub(" ", raw)
    # 再清残留 JS 碎片
    raw = re.sub(r"showPlayer\s*\([^)]*\)\s*;?", " ", raw, flags=re.I)
    raw = re.sub(r"<[^>]+>", " ", raw)
    raw = re.sub(r"\s+", " ", raw).strip()
    return raw[:240], video


def _parse_cutoff(since: str | None, days: int | None) -> datetime:
    now = datetime.now(timezone.utc)
    if days is not None and days > 0:
        cap = min(int(days), ALL_CAP_DAYS)
        return now - timedelta(days=cap)
    since_s = (since or DEFAULT_SINCE).strip() or DEFAULT_SINCE
    try:
        dt = datetime.fromisoformat(since_s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return datetime(2025, 9, 1, tzinfo=timezone.utc)


def _published_dt(iso: str) -> datetime | None:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def _cache_key(q: str | None, source: str, since: str | None, days: int | None) -> str:
    return json.dumps(
        {"q": q or "", "source": source, "since": since or "", "days": days},
        ensure_ascii=False,
        sort_keys=True,
    )


def _read_cache_blob() -> dict | None:
    for path in (CACHE_PATH, LEGACY_CACHE):
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
    return None


def _write_cache_blob(payload: dict) -> None:
    try:
        with open(CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except OSError:
        pass


def _load_cache() -> list[dict]:
    blob = _read_cache_blob()
    if not blob:
        return []
    return list(blob.get("items") or [])


def _item(
    *,
    id: str,
    title: str,
    source: str,
    url: str,
    media_type: str,
    published_at: str = "",
    thumb: str = "",
    video_url: str = "",
    summary: str = "",
    provider: str = "",
    is_sample: bool = False,
    topic: str = "policy",
) -> dict:
    return {
        "id": id,
        "title": title,
        "source": source,
        "url": url,
        "topic": topic,
        "media_type": media_type,
        "published_at": published_at or "",
        "thumb": thumb or "",
        "video_url": video_url or "",
        "summary": summary or "",
        "provider": provider or source,
        "is_sample": bool(is_sample),
    }


def _abs_img(src: str, base: str = "https://www.people.com.cn") -> str:
    src = (src or "").strip()
    if not src:
        return ""
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("http"):
        return src
    return urljoin(base + "/", src.lstrip("/"))


def _first_img_in_html(html: str, base: str = "") -> str:
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html or "", re.I)
    if not m:
        return ""
    return _abs_img(m.group(1), base or "https://www.people.com.cn")


def _walk_awemes(obj: Any, out: list[dict], limit: int = 24) -> None:
    if len(out) >= limit or obj is None:
        return
    if isinstance(obj, list):
        for x in obj:
            _walk_awemes(x, out, limit)
        return
    if not isinstance(obj, dict):
        return
    title = obj.get("desc") or obj.get("title") or obj.get("aweme_desc") or ""
    aweme_id = obj.get("aweme_id") or ""
    if title and aweme_id:
        if not _relevant(str(title)):
            return
        video = obj.get("video") if isinstance(obj.get("video"), dict) else {}
        thumb = ""
        video_url = ""
        for k in ("origin_cover", "cover", "dynamic_cover"):
            c = video.get(k) if video else None
            if isinstance(c, dict):
                urls = c.get("url_list") or []
                if urls:
                    thumb = str(urls[0])
                    break
        if video:
            play = video.get("play_addr") or {}
            if isinstance(play, dict):
                urls = play.get("url_list") or []
                if urls:
                    video_url = str(urls[0])
        images = obj.get("images") or []
        media_type = "video"
        if images and not video_url:
            media_type = "image"
            if not thumb and isinstance(images, list) and images:
                first = images[0]
                if isinstance(first, dict):
                    u = (first.get("url_list") or [""])[0]
                    thumb = str(u or "")
        if str(obj.get("aweme_type") or "") in ("68", "150") and not video_url:
            media_type = "image"
        author = ""
        a = obj.get("author") or {}
        if isinstance(a, dict):
            author = a.get("nickname") or ""
        link = f"https://www.douyin.com/video/{aweme_id}"
        create = obj.get("create_time")
        published = _normalize_published_at(create)
        out.append(
            _item(
                id=f"tikhub_dy_{aweme_id}",
                title=str(title).strip()[:200],
                source=f"抖音 · {author}" if author else "抖音（TikHub）",
                url=link,
                media_type=media_type,
                published_at=published,
                thumb=thumb,
                video_url=video_url,
                provider="tikhub",
            )
        )
        return
    for v in obj.values():
        _walk_awemes(v, out, limit)


def _walk_xhs_notes(payload: dict, out: list[dict], limit: int = 16) -> None:
    items = (
        ((payload.get("data") or {}).get("data") or {}).get("items")
        if isinstance(payload.get("data"), dict)
        else None
    )
    if not isinstance(items, list):
        items = (payload.get("data") or {}).get("items") if isinstance(payload.get("data"), dict) else None
    if not isinstance(items, list):
        return
    for row in items:
        if len(out) >= limit:
            break
        if not isinstance(row, dict) or (row.get("model_type") or "note") != "note":
            continue
        note = row.get("note") or row.get("note_card") or {}
        if not isinstance(note, dict):
            continue
        title = (note.get("title") or note.get("display_title") or note.get("desc") or "").strip()
        if not title or not _relevant(title):
            continue
        nid = note.get("id") or note.get("note_id") or ""
        if not nid:
            continue
        xsec = note.get("xsec_token") or ""
        url = f"https://www.xiaohongshu.com/explore/{nid}"
        if xsec:
            url += f"?xsec_token={quote(str(xsec))}&xsec_source=pc_search"
        thumb = ""
        images = note.get("image_list") or note.get("images_list") or []
        if isinstance(images, list) and images:
            first = images[0]
            if isinstance(first, dict):
                thumb = (
                    first.get("url_default")
                    or first.get("url")
                    or ((first.get("info_list") or [{}])[0] or {}).get("url")
                    or ""
                )
        cover = note.get("cover") or {}
        if not thumb and isinstance(cover, dict):
            thumb = cover.get("url_default") or cover.get("url") or ""
        ntype = str(note.get("type") or "")
        media_type = "video" if ntype in ("video", "视频笔记") else "image"
        ts = note.get("timestamp") or note.get("time")
        published = _normalize_published_at(ts)
        user = note.get("user") or {}
        author = user.get("nickname") if isinstance(user, dict) else ""
        out.append(
            _item(
                id=f"tikhub_xhs_{nid}",
                title=title[:200],
                source=f"小红书 · {author}" if author else "小红书（TikHub）",
                url=url,
                media_type=media_type,
                published_at=published,
                thumb=str(thumb or ""),
                provider="tikhub",
            )
        )


def fetch_tikhub(q: str | None = None) -> tuple[list[dict], dict]:
    key = resolve_tikhub_key()
    status = {
        "id": "tikhub",
        "name": "TikHub",
        "configured": bool(key),
        "ok": False,
        "detail": "",
        "count": 0,
    }
    if not key:
        status["detail"] = "未配置 TIKHUB_API_KEY"
        return [], status

    base = resolve_tikhub_base()
    queries = [q.strip()] if (q or "").strip() else list(TIKHUB_QUERIES)
    collected: list[dict] = []
    errors: list[str] = []

    for kw in queries:
        if len(collected) >= 16:
            break
        # 抖音 video_search_v1（与 Nomi 对账笔记一致）
        http_code, payload = _http_json(
            "POST",
            f"{base}/api/v1/douyin/search/fetch_video_search_v1",
            headers={"Authorization": f"Bearer {key}"},
            body={
                "keyword": kw,
                "cursor": 0,
                "sort_type": "2",
                "publish_time": "7",
                "filter_duration": "0",
                "content_type": "0",
                "search_id": "",
                "backtrace": "",
            },
        )
        if http_code in (401, 403):
            errors.append(f"抖音鉴权失败 HTTP {http_code}")
            break
        if http_code == 402:
            errors.append("余额不足 HTTP 402")
            break
        if http_code >= 400:
            errors.append(f"抖音 HTTP {http_code}")
        else:
            before = len(collected)
            _walk_awemes(payload.get("data") or payload, collected, limit=20)
            if len(collected) == before:
                errors.append(f"抖音「{kw}」无政策向条目")

        # 小红书
        xhs_url = (
            f"{base}/api/v1/xiaohongshu/app_v2/search_notes?"
            + urlencode(
                {
                    "keyword": kw,
                    "page": 1,
                    "sort_type": "general",
                    "note_type": "不限",
                    "time_filter": "一周内",
                }
            )
        )
        http_code2, payload2 = _http_json(
            "GET",
            xhs_url,
            headers={"Authorization": f"Bearer {key}"},
        )
        if http_code2 in (401, 402, 403):
            if not any(x.startswith("余额") or "鉴权" in x for x in errors):
                errors.append(f"小红书 HTTP {http_code2}")
            if http_code2 in (401, 402, 403):
                break
        elif http_code2 < 400:
            before = len(collected)
            _walk_xhs_notes(payload2, collected, limit=16)
            if len(collected) == before:
                errors.append(f"小红书「{kw}」无政策向条目")

    seen = set()
    uniq = []
    for it in collected:
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        uniq.append(it)

    status["ok"] = bool(uniq)
    status["count"] = len(uniq)
    if uniq:
        status["detail"] = f"已拉取 {len(uniq)} 条（抖音/小红书）"
    else:
        status["detail"] = "请求失败：" + ("; ".join(errors[:4]) if errors else "无结果")
    return uniq, status


def _parse_rss(xml_bytes: bytes, feed_meta: dict) -> list[dict]:
    items: list[dict] = []
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return []
    channel = root.find("channel")
    entries = channel.findall("item") if channel is not None else []
    base_host = ""
    try:
        base_host = "{uri.scheme}://{uri.netloc}".format(uri=urlparse(feed_meta["url"]))
    except Exception:
        base_host = "https://www.people.com.cn"

    for ent in entries[:30]:
        title = unescape((ent.findtext("title") or "").strip())
        link = (ent.findtext("link") or "").strip()
        desc = unescape(ent.findtext("description") or "")
        pub = _normalize_published_at(ent.findtext("pubDate") or "")
        summary, embedded_video = _clean_summary(desc)
        if not _relevant(title, summary):
            continue
        if not pub:
            continue
        thumb = _first_img_in_html(desc, base_host)
        enc = ent.find("enclosure")
        if enc is not None and (enc.attrib.get("type") or "").startswith("image"):
            thumb = thumb or enc.attrib.get("url") or ""
        video_url = embedded_video
        media_type = "video" if video_url else ("image" if thumb else "link")
        rid = f"rss_{abs(hash(link or title)) & 0xFFFFFFFF:x}"
        items.append(
            _item(
                id=rid,
                title=title[:200],
                source=feed_meta["name"],
                url=link,
                media_type=media_type,
                published_at=pub,
                thumb=thumb,
                video_url=video_url,
                summary=summary,
                provider="rss",
            )
        )
    return items


def fetch_rss(q: str | None = None) -> tuple[list[dict], dict]:
    status = {
        "id": "rss",
        "name": "RSS / 公开源",
        "configured": True,
        "ok": False,
        "detail": "",
        "count": 0,
    }
    all_items: list[dict] = []
    ok_feeds = 0
    q_l = (q or "").strip().lower()
    for feed in RSS_FEEDS:
        try:
            raw = _http_get(feed["url"], timeout=12.0)
            got = _parse_rss(raw, feed)
            if q_l:
                got = [it for it in got if q_l in (it["title"] + it.get("summary", "")).lower()]
            all_items.extend(got)
            if got:
                ok_feeds += 1
        except (HTTPError, URLError, TimeoutError, OSError):
            continue
    seen = set()
    uniq = []
    for it in all_items:
        if it["id"] in seen:
            continue
        seen.add(it["id"])
        uniq.append(it)
    status["ok"] = bool(uniq)
    status["count"] = len(uniq)
    status["detail"] = (
        f"{ok_feeds}/{len(RSS_FEEDS)} 源可用 · {len(uniq)} 条"
        if uniq
        else "公开 RSS 暂无政策向条目或不可达"
    )
    # X：无官方 API，明记降级
    status["x_note"] = "无 X API；未伪造推文。可用公开搜索页自行查看。"
    return uniq, status


def fetch_allnet(q: str | None = None) -> tuple[list[dict], dict]:
    """主数据源：Allnet OpenAPI（X-API-Key）。

    文档路径：
      GET /sources
      GET /sources/search?keyword=
      GET /sources/data?id=&page=
    """
    status = {
        "id": "allnet",
        "name": "Allnet OpenAPI",
        "configured": False,
        "ok": False,
        "detail": "",
        "count": 0,
        "auth": "X-API-Key",
        "base": ALLNET_API_BASE,
    }
    key = resolve_allnet_key()
    if not key:
        status["detail"] = "未配置 ALLNET_API_KEY"
        return [], status
    status["configured"] = True

    headers = {
        "X-API-Key": key,
        "Accept": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        ),
    }

    def api_get(path: str, params: dict | None = None) -> tuple[int, dict]:
        url = ALLNET_API_BASE.rstrip("/") + path
        if params:
            url += "?" + urlencode({k: v for k, v in params.items() if v is not None})
        return _http_json("GET", url, headers=headers, timeout=20.0)

    # 1) 列源 / 搜源
    source_ids: list[tuple[int, str]] = []
    http_code, payload = api_get("/sources", {"page": 1})
    biz = payload.get("code")
    msg = str(payload.get("message") or "")
    if "VIP" in msg or "会员" in msg:
        status["detail"] = f"OpenAPI 需 VIP（HTTP {http_code} · {msg[:80]}）"
        return [], status
    if http_code in (401, 403) or biz in (401, 403):
        status["detail"] = f"鉴权失败（HTTP {http_code} · {msg[:80] or '无效 Key'}）"
        return [], status

    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    for row in data.get("list") or []:
        if isinstance(row, dict) and row.get("id") is not None:
            title = str(row.get("title") or "")
            # 优先保留科技/AI/政策向订阅源；其它源也拉，条目再筛
            source_ids.append((int(row["id"]), title))

    # 关键字搜源补全
    search_kws = []
    if (q or "").strip():
        search_kws.append(q.strip())
    search_kws.extend(ALLNET_SOURCE_SEARCH_KW)
    seen_sid = {sid for sid, _ in source_ids}
    for kw in search_kws[:8]:
        try:
            _, sp = api_get("/sources/search", {"keyword": kw})
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError, TypeError):
            continue
        if "VIP" in str(sp.get("message") or ""):
            status["detail"] = f"OpenAPI 需 VIP：{(sp.get('message') or '')[:80]}"
            return [], status
        sdata = sp.get("data") if isinstance(sp.get("data"), dict) else {}
        for row in sdata.get("list") or []:
            if not isinstance(row, dict) or row.get("id") is None:
                continue
            sid = int(row["id"])
            if sid in seen_sid:
                continue
            seen_sid.add(sid)
            source_ids.append((sid, str(row.get("title") or kw)))

    if not source_ids and biz not in (200, "200", None):
        status["detail"] = f"列源失败 code={biz} {msg[:100]}"
        return [], status

    # 偏好：标题含 AI/科技/政策 的源先拉
    def src_rank(pair: tuple[int, str]) -> int:
        t = pair[1]
        if any(k in t for k in ("AI", "人工智能", "科技", "数码", "互联网", "36氪", "机器")):
            return 0
        if any(k in t for k in ("政策", "政务", "经济", "财经")):
            return 1
        return 2

    source_ids.sort(key=src_rank)
    # 控制调用量：最多 8 个源
    source_ids = source_ids[:8] if source_ids else []

    items: list[dict] = []
    seen: set[str] = set()
    query = (q or "").strip().lower()

    for sid, src_title in source_ids:
        try:
            code, dp = api_get("/sources/data", {"id": sid, "page": 1})
        except (HTTPError, URLError, TimeoutError, OSError, TypeError):
            continue
        if "VIP" in str(dp.get("message") or ""):
            status["detail"] = f"OpenAPI 需 VIP：{(dp.get('message') or '')[:80]}"
            return [], status
        ddata = dp.get("data") if isinstance(dp.get("data"), dict) else {}
        rows = ddata.get("list") or []
        for row in rows:
            if not isinstance(row, dict):
                continue
            title = (row.get("title") or "").strip()
            jump = (row.get("jump_url") or row.get("url") or "").strip()
            if not title:
                continue
            blob = f"{title} {src_title}"
            if not _relevant(title, src_title):
                # 仍允许检索词命中（且非噪声）
                if _noise_hit(blob):
                    continue
                if query and query not in blob.lower():
                    continue
                if not query:
                    continue
            if query and query not in blob.lower() and not _policy_hit(blob):
                continue
            key = jump or title
            if key in seen:
                continue
            seen.add(key)
            thumb = (row.get("image_url") or row.get("cover") or "").strip()
            video = (row.get("video_url") or "").strip()
            media_type = "video" if video else ("image" if thumb else "link")
            topic = "ai" if any(
                k in blob for k in ("AI", "ai", "人工智能", "大模型", "算力", "AIGC")
            ) else "policy"
            pub = _normalize_published_at(row.get("created_at") or row.get("date") or "")
            if not pub:
                continue
            items.append(
                _item(
                    id=f"allnet_{sid}_{abs(hash(key)) & 0xFFFFFFFF:x}",
                    title=title[:200],
                    source=f"Allnet · {src_title}" if src_title else "Allnet OpenAPI",
                    url=jump or f"https://allnet.hot/?q={quote(title[:40])}",
                    media_type=media_type,
                    published_at=pub,
                    thumb=thumb,
                    video_url=video,
                    summary="",
                    provider="allnet",
                    topic=topic,
                )
            )
        if len(items) >= 40:
            break

    status["ok"] = bool(items)
    status["count"] = len(items)
    if items:
        status["detail"] = (
            f"OpenAPI /sources + /sources/data · {len(source_ids)} 源 · "
            f"{len(items)} 条（含图/视频 {sum(1 for i in items if i.get('thumb') or i.get('video_url'))}）"
        )
    elif not status["detail"]:
        status["detail"] = (
            f"OpenAPI 已鉴权但未筛到 AI/政策条目（源 {len(source_ids)} 个）"
            if source_ids
            else "OpenAPI 无可用订阅源"
        )
    return items, status


def media_hotspots(
    q: str | None = None,
    source: str | None = None,
    since: str | None = None,
    days: int | None = None,
    refresh: bool = False,
) -> dict:
    """聚合政策相关媒体热点。

    q: 关键词筛选（空=默认园区/政策词）
    source: tikhub|rss|allnet|sample|all
    since: ISO 日期下限（默认 2025-09-01）
    days: 近 N 天（优先于 since；全部建议 ≤180）
    refresh: 强制绕过缓存
    """
    want_source = (source or "all").strip().lower()
    if want_source in ("", "全部"):
        want_source = "all"
    query = (q or "").strip() or None
    days_i: int | None = None
    if days is not None:
        try:
            days_i = max(1, min(int(days), ALL_CAP_DAYS))
        except (TypeError, ValueError):
            days_i = None
    since_s = (since or "").strip() or None
    if days_i is None and not since_s:
        since_s = DEFAULT_SINCE
    cutoff = _parse_cutoff(since_s, days_i)
    cache_key = _cache_key(query, want_source, since_s, days_i)

    if not refresh:
        blob = _read_cache_blob()
        if blob and blob.get("cache_key") == cache_key:
            fetched = blob.get("fetched_at") or ""
            ft = _published_dt(_normalize_published_at(fetched))
            if ft and (datetime.now(timezone.utc) - ft).total_seconds() < CACHE_TTL_SEC:
                items = list(blob.get("items") or [])
                return {
                    **{k: blob.get(k) for k in (
                        "ok", "q", "source_filter", "default_keywords",
                        "allnet_configured", "allnet_notice",
                        "tikhub_configured", "tikhub_notice", "sources",
                        "used_sample", "note",
                    ) if k in blob},
                    "ok": True,
                    "q": query or "",
                    "source_filter": want_source,
                    "default_keywords": list(DEFAULT_KEYWORDS),
                    "since": since_s or DEFAULT_SINCE,
                    "days": days_i,
                    "cutoff": cutoff.isoformat(),
                    "cached": True,
                    "cache_ttl_sec": CACHE_TTL_SEC,
                    "fetched_at": fetched,
                    "items": items[:60],
                    "note": blob.get("note")
                    or "主源 Allnet OpenAPI；TikHub/RSS 补充；密钥不回显。",
                }

    sources: list[dict] = []
    pool: list[dict] = []

    def take(name: str) -> bool:
        return want_source in ("all", name)

    if take("allnet"):
        items, st = fetch_allnet(query)
        sources.append(st)
        pool.extend(items)
    else:
        sources.append(
            {
                "id": "allnet",
                "name": "Allnet OpenAPI",
                "configured": bool(resolve_allnet_key()),
                "ok": False,
                "detail": "未选此源",
                "count": 0,
            }
        )

    if take("tikhub"):
        items, st = fetch_tikhub(query)
        sources.append(st)
        pool.extend(items)
    else:
        sources.append(
            {
                "id": "tikhub",
                "name": "TikHub",
                "configured": bool(resolve_tikhub_key()),
                "ok": False,
                "detail": "未选此源",
                "count": 0,
            }
        )

    if take("rss"):
        items, st = fetch_rss(query)
        sources.append(st)
        pool.extend(items)
        sources.append(
            {
                "id": "x",
                "name": "X / Twitter",
                "configured": False,
                "ok": False,
                "detail": "无 X API；未伪造。可改用公开搜索页。",
                "count": 0,
            }
        )
    else:
        sources.append(
            {
                "id": "rss",
                "name": "RSS",
                "configured": True,
                "ok": False,
                "detail": "未选此源",
                "count": 0,
            }
        )

    seen: set[str] = set()
    filtered: list[dict] = []
    for it in pool:
        title = it.get("title") or ""
        summary = it.get("summary") or ""
        # 清 showPlayer
        if summary and "showPlayer" in summary:
            cleaned, vid = _clean_summary(summary)
            it["summary"] = cleaned
            if vid and not it.get("video_url"):
                it["video_url"] = vid
                if it.get("media_type") == "link":
                    it["media_type"] = "video"
            summary = it["summary"]
        if not _relevant(title, summary):
            continue
        pub = _normalize_published_at(it.get("published_at"))
        if not pub:
            continue
        it["published_at"] = pub
        pdt = _published_dt(pub)
        if not pdt or pdt < cutoff:
            continue
        if query:
            blob = f"{title}{summary}".lower()
            if query.lower() not in blob and not _policy_hit(title):
                continue
        iid = it.get("id") or it.get("url")
        if iid in seen:
            continue
        seen.add(str(iid))
        filtered.append(it)

    # 新的在前
    filtered.sort(
        key=lambda x: x.get("published_at") or "",
        reverse=True,
    )

    used_sample = False
    with_media = [x for x in filtered if x.get("thumb") or x.get("video_url")]
    if take("sample") or (not with_media and want_source == "all"):
        if not with_media:
            samples = []
            for s in SAMPLE_ITEMS[:3]:
                row = dict(s)
                row["published_at"] = _normalize_published_at(row.get("published_at"))
                pdt = _published_dt(row["published_at"])
                if pdt and pdt >= cutoff and _relevant(row["title"], row.get("summary") or ""):
                    samples.append(row)
            if query:
                samples = [s for s in samples if query.lower() in s["title"].lower()] or samples[:1]
            if samples:
                filtered = samples + filtered
                used_sample = True
                sources.append(
                    {
                        "id": "sample",
                        "name": "样例占位",
                        "configured": True,
                        "ok": True,
                        "detail": f"实时源无图/视频，展示 {len(samples)} 条样例（已标注）",
                        "count": len(samples),
                    }
                )

    if want_source == "sample":
        filtered = []
        for s in SAMPLE_ITEMS[:3]:
            row = dict(s)
            row["published_at"] = _normalize_published_at(row.get("published_at"))
            filtered.append(row)
        used_sample = True

    key_ok = bool(resolve_tikhub_key())
    allnet_ok = bool(resolve_allnet_key())
    tikhub_st = next((s for s in sources if s["id"] == "tikhub"), {})
    allnet_st = next((s for s in sources if s["id"] == "allnet"), {})
    out = {
        "ok": True,
        "q": query or "",
        "source_filter": want_source,
        "default_keywords": list(DEFAULT_KEYWORDS),
        "since": since_s or DEFAULT_SINCE,
        "days": days_i,
        "cutoff": cutoff.isoformat(),
        "cached": False,
        "cache_ttl_sec": CACHE_TTL_SEC,
        "allnet_configured": allnet_ok,
        "allnet_notice": None
        if allnet_st.get("ok")
        else (allnet_st.get("detail") or ("未配置 ALLNET_API_KEY" if not allnet_ok else "Allnet 未返回可用条目")),
        "tikhub_configured": key_ok,
        "tikhub_notice": None
        if (tikhub_st.get("ok"))
        else (tikhub_st.get("detail") or ("未配置 TIKHUB_API_KEY" if not key_ok else "TikHub 未返回可用条目")),
        "sources": sources,
        "used_sample": used_sample,
        "fetched_at": _now_iso(),
        "items": filtered[:60],
        "note": "主源 Allnet OpenAPI（X-API-Key）；TikHub/RSS 补充；默认自 2025-09；密钥不回显。",
    }
    _write_cache_blob({**out, "cache_key": cache_key})
    return out


# 兼容旧名
def media_hot(topic: str | None = None, media: str | None = None) -> dict:
    q = None
    if topic and topic not in ("all", "全部", ""):
        q = "政策" if topic == "policy" else topic
    out = media_hotspots(q=q, source="all")
    if media in ("image", "img", "图文"):
        out["items"] = [i for i in out["items"] if i.get("media_type") != "video"]
    elif media in ("video", "vid", "视频"):
        out["items"] = [i for i in out["items"] if i.get("media_type") == "video"]
    out["topic_filter"] = topic or "all"
    out["media_filter"] = media or "all"
    return out
