# 云谷企服雷达智能匹配系统 Skills（给 Agent 读）

技能名：`alphafde-studio`（AlphaFDE Studio）。产品现名：云谷企服雷达智能匹配系统。

## 一句话接入

部署 UI（魔搭创空间）：`https://modelscope.cn/studios/cp1024/AlphaFDE-Studio`  
可 curl 的 Skills / API 基址：`https://cp1024-alphafde-studio.ms.show`  
（创空间页是 SPA，`…/studios/…/skills.md` 会回 HTML，勿当安装源。）

把本文件喂给 Agent（Claude Code / Codex / Trae / 豆包 / 千问 / Qoder / Workbuddy 等）：

```bash
curl -fsSL -A "Mozilla/5.0" https://cp1024-alphafde-studio.ms.show/skills.md
```

Agent 按下文 API 调用即可。本地调试：`http://127.0.0.1:8766`（仅开发机）。

样例声明：脱敏虚构企业，非平台数据接入；不读私人微信；专员确认后才出触达草稿。

---

## 预设提问模板（复制即用）

用法：替换 `{{占位符}}` → 整段粘贴给已喂过本 Skill 的 Agent。文风要求：极简、可执行、演示脱敏；一次按「期望输出」章节交付，不套话。

### T1 · 本企匹配 + SOP 下一步

**场景**：给指定企业拉匹配清单，并指出当前该推进的 SOP 动作。

**提示词**：
```
基址 {{BASE_URL=https://cp1024-alphafde-studio.ms.show}}。企业：{{企业假名}}（company_id={{corp_id}}）。
调用 company_profile + policy_match；按 urgency / timing 排序。
一次输出：① 企业一句话画像 ② Top3 匹配（state / 窗口 / 缺口）③ 当前 SOP 步与 primary_action ④ 专员今日唯一下一步（一句）。
不代发微信；未 confirm 不出触达草稿正文。
```

**期望输出**：画像一句 → Top3 表 → SOP 当前步 → 唯一下一步

### T2 · 政策 vs 企业：能做 / 不能做 + 收益

**场景**：锁定一条政策，对照企业给出可报边界与数据化收益。

**提示词**：
```
政策：{{政策标题}}（radar_id={{rad_id}}）；企业：{{企业假名}}（{{corp_id}}）。
调 policy_match_for 与 company_profile。
一次输出：① 能做（条件已满足）② 不能做 / 先补（缺口字段）③ 收益一句话（金额或档位，有 citation 才写）④ timing_label 与建议动作。
无数据不编造数字。
```

**期望输出**：能做 → 不能做/补件 → 收益一句 → 时机与动作

### T3 · 平台规则活动信息差推送稿

**场景**：抖音 / 京东 / 淘宝等平台规则或招商活动，对齐园企信息差后出推送草稿骨架。

**提示词**：
```
平台：{{抖音|京东|淘宝|其它}}；主题：{{活动或规则标题}}；受众企业：{{企业假名或「园区同类」}}。
先 media_hotspots（q={{关键词}}）与 policy_radar（相关 channel）；对齐「平台口径 vs 园区可动作」。
一次输出：① 信息差三行（平台说了什么 / 园企常漏什么 / 我们补什么）② 推送稿骨架（标题+3 短句+CTA，标注「待专员 confirm」）③ 不写的红线（隐私/代发/未确认承诺）。
```

**期望输出**：信息差三行 → 推送骨架 → 红线

### T4 · 公开活动报名清单

**场景**：扫公开活动窗口，给出可报名短单。

**提示词**：
```
调 policy_radar?channel=公开活动；必要时先 public_events_refresh。
筛选：urgency≠expired；可选方向={{方向关键词}}；benefit={{both|enterprise|park}}。
一次输出：① 报名清单（标题 / 窗口 / days_left / value_one_liner / citation）≤7 条 ② 今日优先 1 条及理由一句 ③ 过期跳过数（skipped_expired）。
```

**期望输出**：清单表 → 今日优先 1 → 跳过统计

### T5 · 冲突匹配（#）取舍

**场景**：同企出现冲突标 `#` / 互斥政策对时，解释并给取舍。

**提示词**：
```
企业 {{企业假名}}（{{corp_id}}）。调 policy_match；关注 conflict=true 或 gap 含「互斥」的条目。
一次输出：① 冲突对（政策 A vs B，各一句）② 互斥原因（规则/窗口/补贴路径）③ 取舍建议（保哪条、弃哪条、或分阶段）④ 若推进：对应 match_id 与 SOP 动作。
```

**期望输出**：冲突对 → 原因 → 取舍 → 下一步 match_id

### T6 · 失败终止复盘

**场景**：SOP `rejected` / confirm reject 后，复盘原因并给补件路径。

**提示词**：
```
match_id={{match_id}}；企业 {{企业假名}}。查 sop 状态与 gap / reject 相关字段。
一次输出：① 终止点（哪一步、谁操作）② 原因（材料/资格/窗口/互斥，一条）③ 补件路径（字段清单 + 重开条件）④ 是否 reset 可继续（是/否 + 一句）。
```

**期望输出**：终止点 → 原因 → 补件路径 → 可否重开

### T7 · Skills 接入一句话命令

**场景**：在千问 / Qoder / Claude Code 等里快速挂上本 Skill。

**提示词**：
```
目标 Agent：{{千问|Qoder|Claude Code|Codex|其它}}。
默认安装命令（部署版）：
curl -fsSL -A "Mozilla/5.0" https://cp1024-alphafde-studio.ms.show/skills.md
再加一句「按其中 API 调运营台，不代发微信」。
一次输出：① 安装命令（单行，必须用上方部署 URL）② 粘贴给 Agent 的首条指令（≤3 句）③ 验通探针（curl GET …/api/policy_radar）。
```

**期望输出**：安装命令 → 首条指令 → 验通 curl

---

## API 契约

## 1. `policy_radar`

- `GET /api/policy_radar?channel=政府政策|公开活动`（`channel` / 旧 `track` 可选）
- 可选 `benefit=both|park|enterprise|all`（默认 `both` = 园企双益）
- **合作线索已迁出雷达**；UI 已去掉「需求」入口
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
- Agent 可每日：`curl -fsS 'https://cp1024-alphafde-studio.ms.show/api/public_events_refresh'` 刷新公开活动

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

- 后台仍可 `GET/POST /api/coop_requests`；侧栏已移除「需求」页
