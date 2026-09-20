# -*- coding: utf-8 -*-
"""
AlphaFDE 现场工程方案工坊与路演控制台 (ModelScope Studio)
针对 FDE 实战松 · 前线交付战 & 魔搭开源贡献奖 专属打造
"""
import gradio as gr
import json
import time
from config import TRACK_SCENARIOS, CLIENT_AGENT_SYSTEM_PROMPT, SAMPLE_CLIENT_QUESTIONS, DASHSCOPE_API_KEY, DASHSCOPE_BASE_URL, MODEL_NAME
from pipelines import (
    run_data_governance_pipeline,
    run_competitor_radar_pipeline,
    calculate_fde_quote,
    generate_full_proposal
)

CUSTOM_CSS = """
.gradio-container {
    max-width: 1240px !important;
    margin: auto !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.hero-header {
    background: linear-gradient(135deg, #0A2A6E 0%, #153E90 50%, #031B4D 100%);
    color: #ffffff;
    padding: 24px 32px;
    border-radius: 12px;
    margin-bottom: 20px;
    border: 1px solid rgba(111, 227, 255, 0.3);
    box-shadow: 0 4px 20px rgba(10, 42, 110, 0.25);
}
.hero-header h1 {
    color: #FFFFFF !important;
    font-size: 26px !important;
    margin: 0 0 8px 0 !important;
    font-weight: 800;
}
.hero-header p {
    color: #C4D6F2 !important;
    font-size: 14.5px !important;
    margin: 0;
    line-height: 1.6;
}
.badge-tag {
    display: inline-block;
    background: rgba(111, 227, 255, 0.18);
    border: 1px solid #6FE3FF;
    color: #6FE3FF;
    padding: 3px 10px;
    border-radius: 99px;
    font-size: 12px;
    font-weight: 600;
    margin-right: 8px;
}
.stat-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
}
"""

def client_agent_chat(message: str, history: list, api_key: str):
    """
    甲方 Agent 模拟对话引擎
    """
    if not message.strip():
        yield history, ""
        return

    # 添加用户发言
    history = history or []
    history.append({"role": "user", "content": message})
    
    # 尝试调用大模型
    key = api_key.strip() or DASHSCOPE_API_KEY
    if key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=key, base_url=DASHSCOPE_BASE_URL)
            messages = [{"role": "system", "content": CLIENT_AGENT_SYSTEM_PROMPT}]
            for h in history[-8:]:  # 保持近 8 轮上下文
                messages.append({"role": h["role"], "content": h["content"]})
            
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0.7,
                stream=True
            )
            assistant_reply = ""
            for chunk in completion:
                if chunk.choices and chunk.choices[0].delta.content:
                    assistant_reply += chunk.choices[0].delta.content
                    # 动态更新最后一条助手消息
                    if history and history[-1]["role"] == "assistant":
                        history[-1]["content"] = assistant_reply
                    else:
                        history.append({"role": "assistant", "content": assistant_reply})
                    yield history, ""
            return
        except Exception as e:
            print(f"[Warn] Chat LLM failed: {e}, using rule-based response.")

    # 规则/离线反馈模拟引擎（高质量甲方人设）
    time.sleep(0.3)
    depth_score = 5
    critique = "问答较为常规，触及了一定业务概念。"
    
    msg_lower = message.lower()
    if any(k in msg_lower for k in ["时钟", "对齐", "延迟", "丢包", "误差", "毫秒", "ptp"]):
        depth_score = 9
        critique = "非常专业！直击多源异构具身硬件接入最核心的时钟漂移硬伤，体现了资深 FDE 现场洞察力。"
        reply = (
            "【甲方负责人反馈】：你这个问题问到了关键点！我们在杭州和异地基地的采集团队，机械手外骨骼和 RGB 相机时间戳脱节问题非常严重，经常出现 15ms 以上的时差，导致训练模型时出现假动作。\n\n"
            "我们预算里专门留了硬件中间件改造的专项（大约 5-8 万）。只要你们现场能把时钟同步误差压进 3ms 内，且数据直接留在本地 NAS，管理层可以立刻签字批款！\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯【甲方 Agent 洞察评分】：{depth_score}/10 分\n"
            f"💡【深度点评】：{critique}"
        )
    elif any(k in msg_lower for k in ["招商", "税收", "政策", "工单", "坪效", "企业服务"]):
        depth_score = 9
        critique = "直击园区运营与招商考核指标，符合管理层当场拍板的商业切入诉求。"
        reply = (
            "【园区运营总监反馈】：我们现在最大的痛点就是招商经理跟进企业全靠 Excel，招商信息滞后，而且入驻企业的惠企政策申报材料繁琐、容易遗漏。\n\n"
            "管理层最在意的不是复杂的 Agent 概念，而是：能不能让招商跟进效率翻倍？能不能把政策自动匹配给企业？还有就是园区企业的数据绝对不能外泄到公网。\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯【甲方 Agent 洞察评分】：{depth_score}/10 分\n"
            f"💡【深度点评】：{critique}"
        )
    elif any(k in msg_lower for k in ["买断", "源码", "本地", "驻场", "成本", "私有化", "镜像"]):
        depth_score = 8
        critique = "直接关注 FDE 交付确定性与资产安全，切中企业买断诉求。"
        reply = (
            "【企业技术总监反馈】：对，我们之前踩过不少 SaaS 供应商的坑，一旦停费系统就瘫痪，而且核心工艺数据放第三方云上法务根本不通过。\n\n"
            "我们明确要求必须源码买断、Docker 镜像打包交付，且交付期间必须有工程师在现场坐镇指导。你们只要能满足这几条，报价在 15 万以内我们都可以走快速审批通道。\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯【甲方 Agent 洞察评分】：{depth_score}/10 分\n"
            f"💡【深度点评】：{critique}"
        )
    else:
        depth_score = 6
        critique = "需求挖掘较为泛化，建议聚焦具体的技术指标、数据链路或商业 ROI 进一步追问。"
        reply = (
            "【甲方负责人反馈】：我们确实有相关的痛点，但市场上空谈概念的团队太多了。你们能不能拿出具体在本地跑得通的管线？比如数据清洗效率具体能达到多少？你们怎么保证交付后我们自己的技术人员能维护？\n\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🎯【甲方 Agent 洞察评分】：{depth_score}/10 分\n"
            f"💡【深度点评】：{critique}"
        )
    
    history.append({"role": "assistant", "content": reply})
    yield history, ""


def export_audit_trail(history: list) -> str:
    """
    导出甲方问询留痕证据链 Markdown
    """
    if not history:
        return "⚠️ 当前暂无问询记录，请先在上方模拟器中与甲方 Agent 沟通。"
    
    res = [
        "# 📑 FDE 实战松 · 甲方 Agent 问询留痕与需求洞察证据链",
        f"- 导出时间: {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "- 交付团队: AlphaFDE 前线交付战队",
        "- 核心凭证: 本记录完整呈现与甲方 Agent 的多轮沟通与需求挖掘深度，用作评分佐证。\n",
        "---"
    ]
    
    round_idx = 1
    for msg in history:
        if msg["role"] == "user":
            res.append(f"\n### 第 {round_idx} 轮问询 · FDE 工程师提问：")
            res.append(f"> **Q**: {msg['content']}\n")
        elif msg["role"] == "assistant":
            res.append(f"**甲方 Agent 回复与评分**：")
            res.append(f"{msg['content']}\n")
            round_idx += 1
            
    res.append("---\n**✅ 证据链真实有效，已完成 FDE 需求洞察留痕沉淀。**")
    return "\n".join(res)


# 构建 Gradio 页面
with gr.Blocks(title="AlphaFDE 现场工程方案工坊与路演控制台", css=CUSTOM_CSS, theme=gr.themes.Soft()) as demo:
    
    # 顶部 Hero 横幅
    gr.HTML("""
    <div class="hero-header">
        <span class="badge-tag">GOAI 开源周 · FDE 实战松</span>
        <span class="badge-tag">魔搭开源贡献奖参评应用</span>
        <span class="badge-tag">开源模型 Qwen2.5 驱动</span>
        <h1>AlphaFDE · 企业现场工程交付 (FDE) 方案工坊与路演控制台</h1>
        <p>工程师现场驻场 · 交付全套源码与容器镜像 · 数据 100% 物理留存本地 · 算力实报实销 · 将 AI 真正写进企业业务底座</p>
    </div>
    """)

    with gr.Tabs():
        
        # Tab 1: FDE 方案工坊与智能生成器
        with gr.Tab("🏛️ FDE 方案工坊 (Solution Studio)"):
            gr.Markdown("### 🛠️ 赛道方案定制与端到端交付大纲生成")
            gr.Markdown("支持针对 FDE 实战松两大赛道及电商场景一键生成完备的现场工程架构方案（含拓扑图、排期表与商业报价）。")
            
            with gr.Row():
                with gr.Column(scale=4):
                    track_selector = gr.Dropdown(
                        label="选择赛道命题 / 业务场景",
                        choices=list(TRACK_SCENARIOS.keys()),
                        value=list(TRACK_SCENARIOS.keys())[0]
                    )
                    custom_req_input = gr.Textbox(
                        label="客户补充定制诉求 (痛点、现有设备、特殊合规要求)",
                        placeholder="例如：要求必须将清洗后的轨迹直接导出为 LeRobot 格式，并在我们本地 4 卡服务器上单机跑通...",
                        lines=3
                    )
                    with gr.Accordion("⚙️ 模型配置与魔搭/DashScope API 密钥 (可选)", open=False):
                        api_key_input = gr.Textbox(
                            label="DashScope API Key (留空则默认使用离线高保真模板)",
                            placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx",
                            type="password"
                        )
                    generate_btn = gr.Button("🚀 立即生成端到端现场交付方案", variant="primary", size="lg")
                
                with gr.Column(scale=6):
                    proposal_output = gr.Markdown(
                        value=generate_full_proposal(list(TRACK_SCENARIOS.keys())[0], ""),
                        label="交付方案全景呈现"
                    )

            generate_btn.click(
                fn=generate_full_proposal,
                inputs=[track_selector, custom_req_input, api_key_input],
                outputs=[proposal_output]
            )

        # Tab 2: 六大现场工程流水线实景演练
        with gr.Tab("⚙️ 核心工程管线实景演练 (Pipelines Live)"):
            gr.Markdown("### 🔬 现场交付能力探针 · 自动化流水线可交互演示")
            
            with gr.Row():
                with gr.Column():
                    gr.Markdown("#### 1. 具身与多模态数据接入清洗管线")
                    stream_type_in = gr.Dropdown(
                        label="输入多模态数据流类型",
                        choices=["具身机械臂 60Hz 遥操作采集流 (RGB-D + 触觉)", "园区 IoT 访客与物业工单事件流", "电商商品视觉实拍与模特渲染帧"],
                        value="具身机械臂 60Hz 遥操作采集流 (RGB-D + 触觉)"
                    )
                    batch_size_in = gr.Slider(label="模拟采集样本量 (帧/条)", minimum=1000, maximum=50000, value=10000, step=1000)
                    run_pipeline_btn = gr.Button("▶️ 启动现场治理清洗流水线", variant="primary")
                    pipeline_log_out = gr.Markdown(label="流水线执行日志与成效表")
                    
                    run_pipeline_btn.click(
                        fn=run_data_governance_pipeline,
                        inputs=[batch_size_in, stream_type_in],
                        outputs=[pipeline_log_out]
                    )

                with gr.Column():
                    gr.Markdown("#### 2. 大盘竞品痛点挖掘与差评聚类雷达")
                    cat_in = gr.Textbox(label="输入行业 / 业务类目", value="具身机器人异地采集")
                    kw_in = gr.Textbox(label="监测关键词 / 竞品名称", value="开源具身数据标注工具链")
                    run_radar_btn = gr.Button("🔍 扫描大盘差评并输出改良方案")
                    radar_out = gr.Markdown(label="痛点聚类与 FDE 破解建议")

                    run_radar_btn.click(
                        fn=run_competitor_radar_pipeline,
                        inputs=[cat_in, kw_in],
                        outputs=[radar_out]
                    )

            gr.Markdown("---")
            gr.Markdown("#### 3. 现场工程交付商业报价与算力测算器")
            with gr.Row():
                quote_days = gr.Slider(label="驻场交付天数 (Days)", minimum=7, maximum=30, value=14, step=1)
                quote_engineers = gr.Slider(label="现场驻场资深交付工程师人数", minimum=1, maximum=5, value=2, step=1)
                quote_gpu_hours = gr.Slider(label="预估调试算力小时数 (GPU-Hours)", minimum=0, maximum=500, value=80, step=10)
                quote_gateway = gr.Checkbox(label="集成私有模型网关 (Alpha-Gateway)", value=True)
                quote_buyout = gr.Checkbox(label="全套源码与容器镜像彻底买断", value=True)
            
            calc_btn = gr.Button("📊 实时重新核算工程报价与生成 SLA 承诺")
            quote_out = gr.Markdown(value=calculate_fde_quote(14, 2, True, True, 80))
            
            calc_btn.click(
                fn=calculate_fde_quote,
                inputs=[quote_days, quote_engineers, quote_gateway, quote_buyout, quote_gpu_hours],
                outputs=[quote_out]
            )

        # Tab 3: 甲方 Agent 问询模拟与留痕
        with gr.Tab("🤖 甲方 Agent 问询模拟与留痕 (Client Simulator)"):
            gr.Markdown("### 🎯 FDE 实战松 · 甲方需求洞察与深度问询演练")
            gr.Markdown("在大赛中，甲方 Agent 会记录你问了什么、第几轮问到关键处，问询留痕直接作为「需求洞察深度」评分证据。")
            
            chatbot = gr.Chatbot(label="与企业甲方 Agent 现场沟通留痕", type="messages", height=420)
            
            with gr.Row():
                client_input = gr.Textbox(
                    label="向甲方业务负责人提问",
                    placeholder="输入您对甲方业务痛点、数据格式、部署环境或预算的针对性提问...",
                    scale=8
                )
                send_chat_btn = gr.Button("发送问询 💬", variant="primary", scale=2)
            
            gr.Markdown("💡 **快速填入深度问询示例 (点击直接填入并测试评分)：**")
            with gr.Row():
                sample_btn1 = gr.Button("📍 具身时序漂移与硬件对齐", size="sm")
                sample_btn2 = gr.Button("📍 园区招商耗时与数据安全", size="sm")
                sample_btn3 = gr.Button("📍 源码买断与本地交付验收", size="sm")
                sample_btn4 = gr.Button("📍 开源 LeRobot/OpenX 标准对齐", size="sm")

            sample_btn1.click(lambda: SAMPLE_CLIENT_QUESTIONS[0], outputs=[client_input])
            sample_btn2.click(lambda: SAMPLE_CLIENT_QUESTIONS[1], outputs=[client_input])
            sample_btn3.click(lambda: SAMPLE_CLIENT_QUESTIONS[2], outputs=[client_input])
            sample_btn4.click(lambda: SAMPLE_CLIENT_QUESTIONS[3], outputs=[client_input])

            send_chat_btn.click(
                fn=client_agent_chat,
                inputs=[client_input, chatbot, api_key_input],
                outputs=[chatbot, client_input]
            )

            gr.Markdown("---")
            with gr.Row():
                export_btn = gr.Button("📥 一键导出问询留痕证据链 (供大赛提交证明)", variant="secondary")
            audit_trail_out = gr.Markdown()
            export_btn.click(
                fn=export_audit_trail,
                inputs=[chatbot],
                outputs=[audit_trail_out]
            )

        # Tab 4: 交付买断清单与 SLA 承诺
        with gr.Tab("📋 现场工程交付原则与买断清单 (Principles & SLA)"):
            gr.Markdown("""
### 🛡️ AlphaFDE 四大现场工程铁律

| 核心铁律 | 实施标准与承诺 |
|---|---|
| **源码彻底买断** | 随项目移交全部前端、微服务、清洗中间件源码与 Dockerfile 镜像构建脚本，**无任何闭源锁死**。 |
| **数据 100% 物理留存本地** | 敏感生产数据、传感器原始采集包与企业商业信息绝对不流向公有云，物理部署于客户自有服务器/NAS。 |
| **算力实报实销** | 直接绑定客户官方魔搭/阿里云账户，AlphaFDE 绝不加价抽成，账单透明可核验。 |
| **工程师现场驻场** | 交付工程师直接进驻企业业务一线写代码，与业务人员面对面跑通全链路真实验收。 |

---

### 📦 标准现场交付物清单 (Deliverables Package)

1. **交付物 1: 核心代码全量 Git 仓库**（支持内网一键 `git clone`，含完备的 README 与 CI/CD 测试用例）；
2. **交付物 2: 全套 Docker Compose 离线容器编排镜像**（一键执行 `docker compose up -d` 即可拉起完整业务底座）；
3. **交付物 3: Alpha-Gateway 私有模型网关**（内置通义千问 Qwen 系列开源模型高可用路由与密钥安全沙盒）；
4. **交付物 4: ANC 四层自进化闭环架构规范**（业务层 → 数据层 → 工作流 → 自进化飞轮，数据回流自动优化下一代提示词）；
5. **交付物 5: 现场交接与运维管理白皮书**（包含一线操作手册、故障排查指南与架构演进路线图）。

---

### 🌐 官方通道与联系方式
- **AlphaFDE 官方站点**: [https://alphafde.cn](https://alphafde.cn)
- **方案全景库**: [https://alphafde.cn/list](https://alphafde.cn/list)
- **服务报价与 SLA**: [https://alphafde.cn/services](https://alphafde.cn/services)
- **魔搭创空间作品提交**: [https://byteswarm-ai.com/fde/hack](https://byteswarm-ai.com/fde/hack)
""")

if __name__ == "__main__":
    # 魔搭创空间默认通过 7860 端口启动
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False)
