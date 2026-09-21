#!/usr/bin/env python3
"""日更公开活动：写入 public_events_cache.json。

用法：
  python3 scripts/fetch_public_events.py
  # 或 API：curl 'http://127.0.0.1:8766/api/public_events_refresh'
"""
from __future__ import annotations

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

from public_events import fetch_public_events  # noqa: E402


def main() -> int:
    out = fetch_public_events()
    print(json.dumps({
        "ok": out.get("ok"),
        "count": out.get("count"),
        "notice": out.get("notice"),
        "sources": [
            {"id": s["id"], "ok": s["ok"], "count": s["count"], "detail": s["detail"]}
            for s in (out.get("sources") or [])
        ],
        "fetched_at": out.get("fetched_at"),
    }, ensure_ascii=False, indent=2))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
