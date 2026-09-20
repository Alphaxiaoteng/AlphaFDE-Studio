---
title: AI Trend Moodboard 图像趋势雷达与灵感情绪板
emoji: 🎨
colorFrom: indigo
colorTo: purple
sdk: gradio
sdk_version: 6.17.3
app_file: app.py
pinned: false
license: apache-2.0
short_description: 面向快时尚服饰与电商视觉企划的图像趋势雷达与 AI 灵感情绪板工坊
---

# AI Trend Moodboard · 时尚图像趋势雷达与灵感情绪板工坊

> 🌟 **基于魔搭社区开源模型生态打造的快时尚服饰视觉企划与图像趋势雷达**  
> 🎯 **核心种子品牌**：Teenie Weenie 及快时尚竞品（Ralph Lauren, Loro Piana, Arc'teryx, Uma Wang）  
> 🌐 **创空间在线体验**: [https://www.modelscope.cn/studios/cp1024/AlphaFDE-Studio](https://www.modelscope.cn/studios/cp1024/AlphaFDE-Studio)

---

## 📖 项目简介 (Overview)

**AI Trend Moodboard** 是一款面向中国快时尚成人服饰品牌与电商视觉设计师的**市场情报与视觉灵感企划工作台**。

项目将公开社媒（小红书、Instagram、TikTok）时尚趋势与电商大盘真实样本，提炼整理为结构化的**爆款趋势词**、**高保真 3×3 灵感情绪板 (Moodboard)**、**潘通流行色谱**，并一键编译为工业级 **Midjourney / SDXL / Flux / 即梦 AI 商业生图提示词**，彻底解决服装企划中“趋势捕捉慢”、“情绪板拼凑耗时”与“从灵感到落地成图脱节”的行业核心痛点。

---

## 🌟 四大核心功能 (Features)

### 1. 🎨 2026 秋冬核心风格灵感情绪板 (Moodboard Canvas)
- 覆盖四大主力服饰风格流派：
  - **美式复古学院风 (Ivy League / Preppy)**：重磅绞花毛衣、复古菱格纹、牛尾灯芯绒、经典小熊刺绣；
  - **Quiet Luxury 静奢老钱风 (Minimalist Elegance)**：双面羊绒、低饱和燕麦色、无结构大衣、高支真丝；
  - **Gorpcore 山系机能风 (Urban Outdoor)**：三层压胶防水硬壳、战术多袋工装、模块化扣具；
  - **新中式禅意国风 (Modern Neo-Chinese)**：非遗香云纱、纯手工盘扣、水墨晕染改良通勤西装。
- **潘通色卡自动提取**：毫秒级生成 5 大核心主色与辅助色 Hex 与 Pantone 色号，支持设计直接取色。

### 2. 📊 社媒图像趋势雷达 (Image Trend Radar)
- 实时聚合小红书爆款穿搭话题、流行色讨论度与面料工艺热搜；
- 趋势词热度指数与互动量增长走势全景图谱。

### 3. 🪄 商业视觉生图与 Prompt 工业管线 (Commercial Image Gen)
- 连通情绪板到商业生图的最后一公里；
- 支持自定义模特人种、摄影光影氛围（自然暖光、极简柔光棚拍、复古胶片颗粒）、镜头与构图（85mm 人像定焦、50mm 标准定焦）；
- 结合魔搭开源旗舰 **Qwen2.5 (通义千问)** 输出工业级中英文生图提示词与分镜脚本。

### 4. 🏬 品牌竞品视觉分析 (Brand Intelligence)
- 针对 Teenie Weenie 及行业标杆竞品的货盘视觉法则拆解、经典 IP 演进与季度企划建议。

---

## 📐 架构设计 (Architecture)

```text
       [小红书 / Instagram / 公开电商趋势数据]
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 01. 社媒图像趋势雷达与爆款标签聚类                         │
│ - 关键词热度指数过滤与互动量排名                           │
│ - 视觉风格流行度分类 (美式学院 / 静奢 / 山系机能 / 新中式)  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 02. AI 灵感情绪板生成台与潘通色彩提取                      │
│ - 3×3 高清视觉情绪板布局与面料织物企划                      │
│ - 核心主色与辅助色 Hex / Pantone 自动对齐                   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 03. 商业级 AI 摄影生图提示词编译 (基于 Qwen2.5)             │
│ - 模特、镜头景深、光影氛围与服装质感工业级参数控制          │
│ - 一键对接 Midjourney v6 / SDXL / Flux / 即梦 AI 生图管线   │
└─────────────────────────────────────────────────────────────┘
```

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
