# 云谷企服运营台 Skills（给 Agent 读）

## 一句话接入

公网在线基址：`https://cp1024-alphafde-studio.ms.show`  
本地基址：`http://127.0.0.1:8766`（局域网同 Wi-Fi：浏览器打开「本机 IP:8766」）

把本文件喂给 Agent（Claude Code / Codex / Trae / 豆包 / 千问 / Workbuddy 等）：

```bash
# 公网在线直连：
curl -fsSL https://cp1024-alphafde-studio.ms.show/skills.md

# 本地运行：
curl -fsSL http://127.0.0.1:8766/skills.md
```

Agent 按下文 API 调用即可；云谷企服运营台 UI：`https://cp1024-alphafde-studio.ms.show/`（本地：`http://127.0.0.1:8766/`）。

样例声明：脱敏虚构企业，非平台数据接入；不读私人微信；专员确认后才出触达草稿。

## 1. `policy_radar`

- `GET /api/policy_radar?channel=政府政策|公开活动`（`channel` / 旧 `track` 可选）
- 可选 `benefit=both|park|enterprise|all`（默认 `both` = 园企双益）
- **合作线索已迁出雷达**；云谷企服运营台 UI 已去掉「需求」入口
- 出参：`items[]` — `id, track, channel, title, version, window, window_kind, window_start, window_end, value_one_liner, citation, company_ids, auth_status, pending_review_hint, helps_park, helps_enterprise`
- **窗口派生**：每条含 `days_left`（距 `window_end` 的天数，可负）、`urgency`：`urgent`（≤14 天）/ `watch`（≤45 天）/ `ok` / `expired`；列表按 urgency 升序（紧急在前）
- **过时默认隐藏**：`urgency=expired` 或 `stale=true` 的条目默认不进 `items`；出参含 `skipped_expired`。需要历史时加 `include_expired=1`
- **公开活动日更**：`GET /api/public_events_refresh` 或 `python3 scripts/fetch_public_events.py` → 写 `public_events_cache.json`，自动合并进 `channel=公开活动`（`source.note=agent_daily`）；失败诚实降级不编造

## 1b. `media_hotspots`（媒体信息热点）

- `GET /api/media_hotspots?q=&source=&since=&days=&refresh=`（兼容 `/api/media_hot`）
- 默认时间窗 `since=2025-09-01`；UI chip：近7天 / 近30天 / 自2025-09 / 全部(≤180天)
- **主源 Allnet OpenAPI** `https://api.allnet.hot/api/open/v1`，鉴权头 `X-API-Key`，密钥环境变量 `ALLNET_API_KEY`
  - 路径：`GET /sources` · `GET /sources/search?keyword=` · `GET /sources/data?id=`
- 补充：TikHub（`TIKHUB_API_KEY`）/ 公开 RSS；无密钥或 VIP 限制时诚实降级，不假称已连
- 出参含 `allnet_notice` / `tikhub_notice`；**从不回显密钥**
- Agent 可每日：`curl -fsS 'https://cp1024-alphafde-studio.ms.show/api/public_events_refresh'`（本地：`http://127.0.0.1:8766/api/public_events_refresh`）刷新公开活动

## 1c. `policy_match_for`（政策 → 企业）

- `GET /api/policy_match_for?radar_id=rad_hz_chuying&benefit=both`
- 出参顶层带回该政策的 `urgency`、`days_left`（与雷达一致）
- `items[]` 额外含：
  - `timing_label`：短标签，如「优先 · 剩 9 天」「可马上报」「先补材料再报」
  - `timing_rank`：`0` 优先触达 → `1` 可马上报 → `2` 先补材料（列表按此升序）
- 规则：字段均已确认 → 可马上报；`urgent` 且 `service_needs` 含补贴/申报类 → 优先触达；有未确认字段 → 先补材料


## 2. `company_profile`

- `GET /api/company_profile?company_id=corp_opc_1`
- 出参：代号、方向、规模区间、融资阶段、服务需求、`fields`(source+confirmed)、`headcount_bands`
- 另含 `sop[]`：该企业当前可匹配政策的 SOP 摘要（`match_id, title, sop_steps, current, sop_status`）

## 3. `policy_match`

- `GET /api/policy_match?company_id=corp_opc_1`
- 出参：`matches[]` — `id, state(符合|排除|待核验), citation, label, gap, radar, draft(仅已确认/发送后有)`
- 每条含 SOP：`sop_steps[]`（固定 5 步：发送→企业接受→申请提交→办理中→已通过）、`current` / `sop_step`（0–4）、`sop_status`（`active|passed|rejected`）、`primary_action`

## 3b. `sop`（政策办理进度）

- `POST /api/sop` JSON：`{ "match_id", "action": "next|accept|reject|reset", "company_id?", "operator?" }`
- `next`：推进节点；在「发送」步会落触达草稿（若有模板）并记已发送——**系统不代发微信**
- `accept`：仅当前步为「企业接受」时可用
- `reject`：终态旁路「未通过」
- `reset`：退回上一步（终态则重置为可继续）
- 落盘 `sop_log.jsonl`；进程启动从日志恢复。旧 `POST /api/review` 仍可用（待检验≈发送前检验）

## 4. `match_board`

- `GET /api/match_board?state=待核验|符合|排除&benefit=both`
- 出参：`stats` + `items[]`（含 `draft` 若已确认）

## 5. `confirm`（专员留痕）

- `POST /api/confirm` JSON：`{ "company_id", "match_id", "action": "confirm|reject|escalate", "operator": "OP-01" }`
- 仅 `confirm` 且原 state 为「符合」时返回 `draft`；日志写入 `confirm_log.jsonl`

## 6. `coop_requests`（API 保留，UI 无入口）

- 后台仍可 `GET/POST /api/coop_requests`；云谷企服运营台侧栏已移除「需求」页
