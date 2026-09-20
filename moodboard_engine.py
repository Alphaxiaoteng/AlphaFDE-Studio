# -*- coding: utf-8 -*-
"""
AI Moodboard 情绪板生成与视觉提示词编译引擎
"""
import os
import json
from moodboard_data import TREND_STYLES, HOT_TREND_DATA

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
DASHSCOPE_BASE_URL = os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
MODEL_NAME = os.getenv("FDE_MODEL_NAME", "qwen2.5-72b-instruct")

def render_palette_html(palette: list) -> str:
    """
    渲染潘通流行色卡与 Hex 色板组件
    """
    blocks = []
    for c in palette:
        blocks.append(f"""
        <div style="flex: 1; min-width: 110px; margin: 4px; padding: 10px; border-radius: 8px; background: #ffffff; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div style="height: 52px; border-radius: 6px; background-color: {c['hex']}; margin-bottom: 8px; border: 1px solid rgba(0,0,0,0.1);"></div>
            <div style="font-weight: 700; font-size: 13px; color: #1e293b; margin-bottom: 2px;">{c['name']}</div>
            <div style="font-family: monospace; font-size: 12px; color: #64748b;">{c['hex']}</div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">{c.get('pantone', '')}</div>
        </div>
        """)
    return f"""
    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; margin: 12px 0;">
        {''.join(blocks)}
    </div>
    """

def get_style_info(style_name: str):
    """
    获取指定风格的详细情绪板信息
    """
    data = TREND_STYLES.get(style_name, list(TREND_STYLES.values())[0])
    image_path = data["moodboard_image"]
    palette_html = render_palette_html(data["palette"])
    
    # 格式化描述与分析报告
    report = []
    report.append(f"### 🎯 【{data['title']}】行业视觉企划雷达")
    report.append(f"- **对标品牌阵列**: `{' / '.join(data['benchmark_brands'])}`")
    report.append(f"- **社媒热度指数**: `{data['hot_index']}`")
    report.append(f"- **核心设计理念**: {data['description']}")
    report.append(f"\n#### 🏷️ 核心视觉标签与设计语义：")
    report.append(f"`{'` `'.join(data['keywords'])}`")
    report.append(f"\n#### 🧵 推荐核心面料与工艺清单：")
    for f in data["fabrics"]:
        report.append(f"- **{f}**")
    
    return image_path, palette_html, "\n".join(report), data["prompt_template"]["zh"], data["prompt_template"]["en"]

def compile_commercial_prompt(style_name: str, ethnicity: str, lighting: str, lens: str, extra_elements: str, user_api_key: str = "") -> tuple:
    """
    生成商业摄影与商品视觉提示词 (中英文)
    """
    key = user_api_key.strip() or DASHSCOPE_API_KEY
    data = TREND_STYLES.get(style_name, list(TREND_STYLES.values())[0])
    
    # 如果有 key，走 Qwen2.5 深度扩写
    if key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=key, base_url=DASHSCOPE_BASE_URL)
            prompt = f"""你是一名顶尖的快时尚商业时装摄影总监与 AI 生图提示词专家。
请根据以下设计方案参数，为【{style_name}】编译一套工业级 Midjourney / SDXL / 即梦 AI 商业摄影提示词：
- 目标风格基底: {data['title']}
- 对标品牌: {', '.join(data['benchmark_brands'])}
- 模特设置: {ethnicity}
- 灯光氛围: {lighting}
- 镜头景深: {lens}
- 补充定制视觉元素: {extra_elements or '无'}

请严格输出两部分（纯文本或标准 Markdown）：
1. 英文工业级提示词 (English Prompt)：包含主体着装细节、材质光泽、环境光影、相机与胶片质感（如 8k, editorial, Hasselblad, realistic fabric texture 等）；
2. 中文详细视觉企划分镜脚本 (Chinese Breakdown)：用于企划案汇报与设计团队评审。
"""
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": "你是一名顶尖的时装商业摄影与 AI 视觉工业管线首席工程师。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1500
            )
            content = completion.choices[0].message.content
            return content, "✅ 由开源主力旗舰 Qwen2.5 深度扩写完成"
        except Exception as e:
            print(f"[Warn] Qwen API call failed: {e}, fallback to template.")

    # 离线高质量渲染
    zh = f"""### 🎬 【{style_name}】商业摄影视觉分镜脚本
- **模特构图**: {ethnicity}，自然舒展的商业时装身姿，突出面料垂坠感与版型剪裁；
- **光影氛围**: {lighting}，注重阴影过渡与衣服面料微反光；
- **机位参数**: {lens}，景深虚化适度，锁死服装细节与车线质感；
- **定制元素**: {extra_elements or '保留经典品牌印记，无额外杂质'}；
- **企划落地建议**: 推荐用于 2026 秋冬新品订货会主视觉、天猫商详页首图与小红书爆款封面。
"""
    en = f"Commercial fashion photography for {data['benchmark_brands'][0]} style collection. {ethnicity} model styled in signature {style_name}. {lighting}, captured with {lens}. High-end editorial magazine photoshoot, photorealistic fabric texture, natural skin tones, masterpiece, 8k resolution, cinematic atmosphere. {extra_elements}"
    
    return f"{zh}\n\n---\n### 🌐 Midjourney / Flux / 即梦 AI 英文提示词：\n```text\n{en}\n```", "✅ 离线高保真提示词编译完成"
