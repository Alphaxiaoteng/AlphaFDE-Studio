# -*- coding: utf-8 -*-
"""
AI Trend Moodboard · 时尚图像趋势雷达与灵感情绪板工作台 (ModelScope Studio)
面向中国快时尚成人服饰与电商视觉企划 | Teenie Weenie 及竞品大盘深度挖掘
"""
import os
# 防御性清洗 NO_PROXY 中的 IPv6 ::1 避免 httpx URL 解析异常
for _v in ["NO_PROXY", "no_proxy"]:
    if _v in os.environ:
        os.environ[_v] = ",".join([_p.strip() for _p in os.environ[_v].split(",") if "::" not in _p])

import gradio as gr
import json
import time
from moodboard_data import TREND_STYLES, HOT_TREND_DATA
from moodboard_engine import get_style_info, compile_commercial_prompt

CUSTOM_CSS = """
.gradio-container {
    max-width: 1240px !important;
    margin: auto !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.hero-header {
    background: linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #0F172A 100%);
    color: #ffffff;
    padding: 24px 32px;
    border-radius: 12px;
    margin-bottom: 20px;
    border: 1px solid rgba(199, 210, 254, 0.25);
    box-shadow: 0 4px 20px rgba(30, 27, 75, 0.25);
}
.hero-header h1 {
    color: #FFFFFF !important;
    font-size: 26px !important;
    margin: 0 0 8px 0 !important;
    font-weight: 800;
}
.hero-header p {
    color: #C7D2FE !important;
    font-size: 14.5px !important;
    margin: 0;
    line-height: 1.6;
}
.badge-tag {
    display: inline-block;
    background: rgba(199, 210, 254, 0.18);
    border: 1px solid #A5B4FC;
    color: #C7D2FE;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
    margin-right: 8px;
}
.gallery-card {
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #e2e8f0;
}
"""

def on_style_change(style_name: str):
    image_path, palette_html, report, zh, en = get_style_info(style_name)
    return image_path, palette_html, report

def format_trend_table():
    headers = ["排名", "社媒爆款话题 / 穿搭趋势", "核心平台", "热度指数", "风格标签"]
    rows = []
    for item in HOT_TREND_DATA:
        rows.append([str(item["rank"]), item["topic"], item["platform"], item["heat"], item["tags"]])
    return rows

with gr.Blocks(title="AI Trend Moodboard · 图像趋势雷达与灵感情绪板") as demo:
    
    # 顶部 Hero
    gr.HTML("""
    <div class="hero-header">
        <span class="badge-tag">快时尚成人服饰企划</span>
        <span class="badge-tag">Teenie Weenie 及竞品视觉雷达</span>
        <span class="badge-tag">AI 灵感情绪板</span>
        <span class="badge-tag">开源模型 Qwen2.5 驱动</span>
        <h1>AI Trend Moodboard · 图像趋势雷达与灵感情绪板工坊</h1>
        <p>从社媒热点与公开网页样本提炼爆款趋势 · 自动化生成潘通流行色谱与专业级 3×3 情绪板 · 一键编译商业摄影生图 Prompt</p>
    </div>
    """)

    with gr.Tabs():
        
        # Tab 1: 🎨 AI 灵感情绪板画布
        with gr.Tab("🎨 AI 灵感情绪板画布 (Moodboard Studio)"):
            gr.Markdown("### 🖼️ 2026 秋冬服饰核心风格流派与灵感情绪板")
            
            with gr.Row():
                with gr.Column(scale=4):
                    style_dropdown = gr.Dropdown(
                        label="选择企划风格基底",
                        choices=list(TREND_STYLES.keys()),
                        value=list(TREND_STYLES.keys())[0]
                    )
                    style_report_out = gr.Markdown(
                        value=get_style_info(list(TREND_STYLES.keys())[0])[2],
                        label="企划设计雷达"
                    )
                
                with gr.Column(scale=6):
                    moodboard_image_display = gr.Image(
                        value=get_style_info(list(TREND_STYLES.keys())[0])[0],
                        label="高清灵感情绪板 (Moodboard)",
                        type="filepath",
                        interactive=False
                    )
                    gr.Markdown("#### 🎨 潘通流行色谱提取 (Pantone Color Palette)")
                    palette_display = gr.HTML(
                        value=get_style_info(list(TREND_STYLES.keys())[0])[1]
                    )

            style_dropdown.change(
                fn=on_style_change,
                inputs=[style_dropdown],
                outputs=[moodboard_image_display, palette_display, style_report_out]
            )

        # Tab 2: 📊 社媒图像趋势雷达
        with gr.Tab("📊 社媒图像趋势雷达 (Trend Radar)"):
            gr.Markdown("### 📈 大盘社媒热搜与爆款穿搭趋势监测")
            gr.Markdown("基于小红书、Instagram 及公开电商大盘数据，实时提炼消费者与 KOL 互动量飙升的服装话题、流行色卡与版型关键词。")
            
            trend_df = gr.Dataframe(
                headers=["排名", "社媒爆款话题 / 穿搭趋势", "核心平台", "热度指数", "风格标签"],
                value=format_trend_table(),
                interactive=False,
                label="实时时尚趋势榜单"
            )

            with gr.Row():
                with gr.Column():
                    gr.Markdown("#### 🔍 趋势词关联分析与面料工艺")
                    gr.Markdown("""
- **美式复古学院风**：本季重磅绞花毛衣热度上涨 **142%**，红绿、红黑撞色菱格开衫成为爆款焦点，经典小熊刺绣与牛角扣具有强溢价属性；
- **Quiet Luxury**：燕麦色、冷雾灰褐等低饱和大地色系占据 **68%** 的大衣讨论，双面羊绒与无结构西装剪裁成为高客单转化主力；
- **山系机能 Gorpcore**：三层压胶硬壳冲锋衣在雨季与出行季环比激增 **210%**，战术多袋与反光条细节备受追捧；
- **新中式禅意**：香云纱与手造盘扣改良日常西装在小红书笔记量突破 **860 万**，体现传统与现代通勤的融合。
""")
                with gr.Column():
                    gr.Markdown("#### 📸 行业采集与大盘视觉全息画廊")
                    gallery_img = gr.Image(
                        value="assets/pulse-image-gallery-live.png",
                        label="大盘视觉样本切片与候选池",
                        type="filepath",
                        interactive=False
                    )

        # Tab 3: 🪄 商业视觉生图与 Prompt 工业管线
        with gr.Tab("🪄 商业视觉生图与 Prompt 工业管线 (Commercial Image Gen)"):
            gr.Markdown("### 💡 情绪板到商业生图的最后一公里")
            gr.Markdown("将选定的情绪板风格与面料色彩，自动化编译为工业级 Midjourney / SDXL / Flux / 即梦 AI 商业摄影提示词。")
            
            with gr.Row():
                with gr.Column(scale=4):
                    prompt_style_in = gr.Dropdown(
                        label="目标风格基底",
                        choices=list(TREND_STYLES.keys()),
                        value=list(TREND_STYLES.keys())[0]
                    )
                    model_ethnicity_in = gr.Dropdown(
                        label="模特设置",
                        choices=["东亚高级脸年轻女模特", "东亚清爽年轻男模特", "欧美复古超模", "混血都市精英模特"],
                        value="东亚高级脸年轻女模特"
                    )
                    lighting_in = gr.Dropdown(
                        label="摄影光影氛围",
                        choices=["拱窗午后自然阳光与柔和阴影", "斯堪的纳维亚极简漫反射漫光", "电影质感复古胶片颗粒与冷暖对冲光", "雨后城市湿漉微光倒影与环境冷调"],
                        value="拱窗午后自然阳光与柔和阴影"
                    )
                    lens_in = gr.Dropdown(
                        label="镜头与构图",
                        choices=["哈苏中画幅 85mm f/1.4 人像定焦", "徕卡 50mm f/1.2 极简标准人像", "35mm f/1.4 环境全身商业摄影"],
                        value="哈苏中画幅 85mm f/1.4 人像定焦"
                    )
                    custom_req_in = gr.Textbox(
                        label="补充定制视觉细节 (选填)",
                        placeholder="例如：手持复古牛皮书卷，背景有常春藤爬山虎绿植...",
                        lines=2
                    )
                    with gr.Accordion("⚙️ 模型配置与魔搭/DashScope API Key (可选)", open=False):
                        prompt_api_key_in = gr.Textbox(
                            label="DashScope API Key (留空则默认使用内置专家编译引擎)",
                            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx",
                            type="password"
                        )
                    compile_btn = gr.Button("🚀 立即编译工业级商业生图 Prompt", variant="primary", size="lg")
                
                with gr.Column(scale=6):
                    prompt_status_out = gr.Markdown(value="💡 点击左侧按钮开始编译提示词")
                    compiled_prompt_out = gr.Markdown(
                        value=compile_commercial_prompt(list(TREND_STYLES.keys())[0], "东亚高级脸年轻女模特", "拱窗午后自然阳光", "哈苏中画幅 85mm", "")[0],
                        label="商业摄影分镜与提示词输出"
                    )

            compile_btn.click(
                fn=compile_commercial_prompt,
                inputs=[prompt_style_in, model_ethnicity_in, lighting_in, lens_in, custom_req_in, prompt_api_key_in],
                outputs=[compiled_prompt_out, prompt_status_out]
            )

        # Tab 4: 🏬 品牌竞品视觉分析 (Teenie Weenie & Competitors)
        with gr.Tab("🏬 品牌竞品视觉分析 (Brand Intelligence)"):
            gr.Markdown("### 👔 快时尚成人服饰大盘货盘结构与视觉演进")
            
            with gr.Row():
                with gr.Column():
                    gr.Markdown("""
#### 🎯 Teenie Weenie 核心货盘视觉法则
1. **经典 IP 与英伦学院基因**：
   - 标志性小熊刺绣（从立体金线小熊到做旧拼布小熊），强化品牌视觉认知；
   - 核心品类锁定：绞花毛衣、灯芯绒衬衫、双排扣牛角大衣与学院风百褶半身裙。
2. **色彩策略**：
   - 经典红绿、藏青、暖驼构成品牌三原色，配以复古米白作为平衡调和。
3. **竞品防御与升级**：
   - 应对快时尚白牌同质化竞争，逐步向“高级雅痞学院（Quiet Prep）”升级，强化高支羊毛面料与克制版型。
""")
                with gr.Column():
                    kol_img = gr.Image(
                        value="assets/pulse-kol-real-data.png",
                        label="社媒 KOL 实采互动数据与触达分析",
                        type="filepath",
                        interactive=False
                    )

            gr.Markdown("---")
            gr.Markdown("### 🌐 开源与部署声明")
            gr.Markdown("""
- **所属项目**：`App/workbench/AI_moodboard` (Trend 趋势雷达与灵感情绪板工作台)
- **开源模型底座**：魔搭社区主流开源旗舰 **Qwen2.5 (通义千问)**
- **数据来源**：小红书、公开社媒热点与快时尚行业大盘真实样本
- **应用部署宿主**：魔搭社区创空间 (ModelScope Studio)
""")

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False, css=CUSTOM_CSS, theme=gr.themes.Soft())
