---
title: 云谷企服雷达智能匹配系统 · AlphaFDE
emoji: 📡
colorFrom: blue
colorTo: cyan
sdk: docker
app_port: 7860
pinned: false
---

# 云谷企服雷达智能匹配系统 · AlphaFDE Studio

<div align="center">

<img src="screenshots/AlphaFDE_logo.jpg" alt="AlphaFDE Logo" width="160" style="border-radius: 12px; margin-bottom: 12px;" />

**面向科技园区与孵化器的 AI 政策申报与企业服务管家**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![ModelScope Studio](https://img.shields.io/badge/ModelScope-AlphaFDE--Studio-624AFF)](https://modelscope.cn/studios/cp1024/AlphaFDE-Studio)
[![License](https://img.shields.io/badge/License-Apache--2.0-green.svg)](LICENSE)

[🌐 在线演示 (直连)](https://cp1024-alphafde-studio.ms.show/) · [🚀 魔搭创空间](https://modelscope.cn/studios/cp1024/AlphaFDE-Studio) · [🤖 Agent Skills](https://cp1024-alphafde-studio.ms.show/skills.md)

</div>

---

## 📌 系统定位与核心价值

在 **3 人企服编制** 现实下，传统园区面临“政策零散翻不全、企业条件对不上、申报时限常错过、进度分散难留痕”四大痛点。

**云谷企服雷达智能匹配系统** 将政策辅导与企业服务重构为一条高可靠流水线：
$$\text{企服雷达初筛} \longrightarrow \text{三态判定（符合/排除/待核验）} \longrightarrow \text{专员放行} \longrightarrow \text{微信草稿触达} \longrightarrow \text{SOP 留痕}$$

* **真实底账与出处**：立足在园企业底账，100% 绑定官方公文与权威通知出处（Citation），绝不凭空编造。
* **双向精准匹配**：既支持「为企业体检找政策」，也支持在申报截止临近时「反向锁定适企优先触达」。
* **专员人机闭环**：坚守合规底线，系统不代发微信、不代窗口申报，专员复核后一键生成得体触达话术。

---

## 🖼️ 系统全景截图

### 1. 运营看板总览
实时汇总在园企业底账、现行有效政策、待核验匹配项及临近截止警报。
![看板总览](screenshots/01_看板总览.png)

### 2. 6 大通道企服雷达
覆盖「政府政策、公开活动、平台规则、阿里服务、园区服务、机构服务」，倒计时自动预警（红·紧急 ≤14天 / 黄·关注 ≤45天 / 绿·充裕）。
![服务雷达](screenshots/02_服务雷达.png)

### 3. 企业运营与全景底账
收录 OPC 一人公司、小微成长企业与规上研发企业画像，展示多源确认状态与材料缺口（Gap）。
![企业运营](screenshots/03_企业运营.png)

### 4. 企业详情与 5 步 SOP 推进
标准化办理闭环（发送 → 企业接受 → 申请提交 → 办理中 → 已通过），动作实时审计落盘。
![企业详情与匹配](screenshots/06_企业详情与匹配.png)

### 5. 政策详情与权威出处
精准条款拆解、申报材料清单与官方红头文件核验依据。
![政策详情](screenshots/07_政策详情.png)

### 6. 企业自主服务门户
面向入驻企业开放的自查门户，清晰掌握专属权益、匹配政策与活动日历。
![企业端](screenshots/05_企业端.png)

### 7. Agent Skills 智能体接入
原生提供标准化 OpenAPI 与 7 套即插即用提问模板（T1–T7），供各大主流 AI Agent 零门槛挂载。
![Skills接入](screenshots/04_Skills接入.png)

---

## 🏗️ 极致轻量架构：纯前端无后端 + 本地 SQLite 引擎

系统原生支持 **完全无服务器（Zero-Backend / Serverless）** 运行，彻底告别后台服务运维负担：

* **浏览器内嵌轻量 SQLite（WASM / `alpha_db.js`）**：
  - 双击 `index.html` 或部署到 GitHub Pages / 任意静态托管即可秒开，**完全无需运行 Python 或任何后台常驻进程**。
  - 结构化关系型数据表（`policies`、`companies`、`matches`、`sop_logs`、`confirm_logs`）。
  - 专员全流程操作（推进 SOP、确认留痕、提醒标记）自动通过 `LocalStorage / IndexedDB` 本地实时落盘，刷新页面状态不丢失。
  - 界面左下角提供 **「📥 导出 SQLite」**（直接下载标准 `.db` 数据库）与 **「🔄 重置底账」** 控制面板。
* **极简静态开放数据（Agent 友好）**：
  - 预打包单文件关系型数据库 `alphafde.db`（约 300KB）与 `static_db.json`，外部 AI Agent（Claude Code / Qwen / DeepSeek）可直接通过 URL 或本地文件极速解析。
* **可选 Python 服务基座 (`server.py`)**：
  - 针对需要局域网跨机器共享（同 Wi-Fi 浏览器打开）、自动化定时抓取或部署至 ModelScope 容器创空间的场景，保留标准库 0 外部依赖的轻量服务作为补充。

---

## ⚡ 快速使用与部署

### 方式一：纯前端离线静态秒开（推荐 · 零后端）
无需安装任何 Python 依赖与后台进程：
```bash
# 浏览器直接双击打开 index.html，或用任意静态工具托管：
python3 -m http.server 8080
# 浏览器访问：http://127.0.0.1:8080
```
*(也可直接推送到 GitHub Pages 免费自动化公开访问)*

### 方式二：Docker 容器一键部署
```bash
docker compose up -d --build
# 服务监听端口 8766 (或 7860)
```

### 方式三：向任意 AI Agent 挂载本技能
```bash
# 复制以下指令喂给 Claude Code / Qwen / DeepSeek / Trae / Cursor：
curl -fsSL -A "Mozilla/5.0" https://cp1024-alphafde-studio.ms.show/skills.md
```

---

## 🛡️ 安全与合规红线

- ❌ **严禁读取私人通讯**：不越权扫描私人微信聊天，仅处理公开政策与企业授权登记底账。
- ❌ **严禁静默代发微信**：系统仅生成触达建议草稿，必须由园区专员人机确认（Human-in-the-loop）后发送。
- ❌ **严禁代做窗口申报**：系统定位于辅导与穿透，不替代政府法定申领系统，不做“包过”虚假承诺。
- ✅ **真实权威核验**：每条入库政策与活动必须有可靠发文凭据，过期条目自动下架隐藏。

---

## 📄 开源与商业支持

本项目遵循 [Apache-2.0 License](LICENSE) 开源。  
如需企业私有化部署、高阶政策抓取流水线与定制企服协同对接，欢迎联系云谷企服技术小组。
