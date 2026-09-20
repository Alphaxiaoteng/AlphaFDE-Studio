---
title: AICUT 短视频 AI 智能素材打靶工作台
emoji: 🎬
colorFrom: red
colorTo: orange
sdk: gradio
sdk_version: 6.17.3
app_file: app.py
pinned: false
license: apache-2.0
short_description: 美妆/电商口播短视频 AI Agent 智能素材打靶 · 剪映 5.9 草稿导出工作台
---

# AICUT · 电商口播短视频 AI 智能素材打靶与剪辑工作台

> 🚀 **美妆/电商口播短视频 AI Agent 智能素材打靶 · 剪映 5.9 草稿导出工作台**  
> 🌐 **创空间在线体验**: [https://www.modelscope.cn/studios/cp1024/AlphaFDE-Studio](https://www.modelscope.cn/studios/cp1024/AlphaFDE-Studio)

---

## 📖 项目简介 (Overview)

**AICUT** 是一款面向电商与美妆带货团队的 **AI 原生智能剪辑工作台**。

项目针对短视频爆款二创中“人工找素材繁琐”、“台词与画面脱节”、“剪映草稿拼装耗时”等行业痛点，通过自研的 **Agent Harness 语义匹配引擎**，自动解析口播台词逐字稿，从海量媒体库中秒级智能检索并精确打靶匹配最佳空镜、动作特写与对比镜头，并一键导出标准剪映工程草稿与视频渲染。

---

## 🌟 核心功能 (Key Features)

1. **⚡ 台词逐字稿 AI 智能打靶 (Agent Harness)**：
   - 输入口播文案，Agent 自动进行多模态语义分词与动作/产品实体抽取；
   - 自动匹配景别循环（特写、中景、细节、效果对比）与多标签素材。
2. **🎞️ 专业级多轨道视频时间轴 (Remotion / Web Timeline)**：
   - 包含主视频轨、画中画画轨、字轨、音效轨与 BGM 音乐轨；
   - 实时无缝音视频预览，毫秒级拖拽修剪与卡点对齐。
3. **💄 美妆与电商跑量模板库**：
   - 内置千川跑量爆款模板（Q夏天p31_4镜、普通女性镜像对比、火锅店/掰断膏体场景切片）；
   - 支持一键换肤与台词动态重组。
4. **📦 剪映 5.9 草稿与标准工程导出**：
   - 100% 物理兼容剪映 draft_content.json 标准格式，支持无损移交剪映桌面端二次精修。

---

## 🚀 本地运行 (Local Development)

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
python app.py
```

访问 `http://localhost:7860` 即可开始使用。

---

## 📄 开源许可证 (License)

本项目遵循 [Apache-2.0 License](https://www.apache.org/licenses/LICENSE-2.0) 开源协议。
