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

## 🏗️ 架构与稳定实现

* **前端（Frontend）**：原生现代化响应式 SPA (`index.html`)，零繁琐 Node 打包依赖，毫秒级即开即用，完美适配 PC 大屏与移动端。
* **后端（Backend）**：基于 Python 标准库构建轻量高并发服务 (`server.py`)，自带 RESTful API 路由、状态机持久化与平滑降级容灾。
* **Agent 规范（Skills）**：规范化 `skills.md` 接口契约，内置 T1（SOP推进）、T2（政策匹配）、T3（规则推送）、T4（活动报名）、T5（冲突裁决）、T6（复盘重开）、T7（快速接入）指令库。

---

## ⚡ 快速开始

### 方式一：本地极速启动（0 额外依赖）
```bash
# 需要 Python 3.10+
python3 server.py

# 访问本地运营台：http://127.0.0.1:8766
```

### 方式二：Docker 一键部署
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
