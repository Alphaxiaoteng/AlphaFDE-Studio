# -*- coding: utf-8 -*-
"""
FDE 核心工程流水线模拟器与智能计算引擎
"""
import time
import json
from config import TRACK_SCENARIOS, DASHSCOPE_API_KEY, DASHSCOPE_BASE_URL, MODEL_NAME

def run_data_governance_pipeline(batch_size: int, stream_type: str) -> str:
    """
    模拟具身/多模态数据接入、时空对齐与治理清洗管线
    """
    lines = []
    lines.append(f"### 🚀 FDE 现场工程数据接入与治理执行报告")
    lines.append(f"- **输入数据流**: `{stream_type}` | **模拟批次样本量**: `{batch_size} 帧/包`")
    lines.append(f"- **执行时间**: `{time.strftime('%Y-%m-%d %H:%M:%S')}`")
    lines.append(f"\n```text")
    lines.append(f"[Step 01] 正在接入边缘端采集流 (硬件时钟同步校验)...")
    time.sleep(0.05)
    
    if "具身" in stream_type or "机械" in stream_type or "机器人" in stream_type:
        aligned_count = int(batch_size * 0.982)
        pruned_count = batch_size - aligned_count
        lines.append(f"  └─ RGB-D 相机流与触觉外骨骼时间戳对齐完成。对齐成功: {aligned_count} 帧，抖动/丢包丢弃: {pruned_count} 帧 (误差 < 2ms)")
        lines.append(f"[Step 02] Qwen2.5-VL 视觉语义动作合规初筛...")
        lines.append(f"  └─ 过滤无效静止轨迹与机械手穿模动作: 剔除 {int(batch_size * 0.045)} 条异常样本")
        lines.append(f"[Step 03] 本地边缘硬件脱敏保护...")
        lines.append(f"  └─ 检测并高斯模糊敏感人员面部与背景条形码: 覆盖率 100%")
        lines.append(f"[Step 04] 格式标准化转换...")
        lines.append(f"  └─ 成功打包为 OpenX-Embodiment / LeRobot 标准 HDF5 + Parquet 索引文件")
    elif "园区" in stream_type or "工单" in stream_type:
        lines.append(f"  └─ 接入园区 IoT 传感器、访客门禁及物业 CRM 数据包")
        lines.append(f"[Step 02] 文本/日志实体抽取与去噪 (基于 Qwen2.5 语义微调)...")
        lines.append(f"  └─ 聚类提取出有效工单诉求: {int(batch_size * 0.89)} 件，合并重复告警: {int(batch_size * 0.11)} 件")
        lines.append(f"[Step 03] 本地安全沙盒加密隔离...")
        lines.append(f"  └─ 企业税号与敏感财务字段物理掩码，100% 留存本地 NAS 数据库")
    else:
        lines.append(f"  └─ 接入商品多角度渲染样本与实拍底图")
        lines.append(f"[Step 02] 几何边缘轮廓一致性锁定 (ControlNet 特征匹配)...")
        lines.append(f"  └─ 边缘无损保留率: 99.7%，过滤过曝与穿帮异常帧")
        lines.append(f"[Step 03] 批量输出电商详情页与短视频分镜头素材")

    lines.append(f"[Step 05] 资产沉淀归档...")
    lines.append(f"  └─ 写入本地安全私有资产编目，生成校验指纹 SHA-256")
    lines.append(f"```")
    
    lines.append(f"\n#### 📊 治理成效指标：")
    lines.append(f"| 指标项 | 治理前 (传统人工) | FDE 自动化管线 | 改善幅度 |")
    lines.append(f"|---|---|---|---|")
    lines.append(f"| **数据清洗时效** | 48 小时 / 万条 | 4.2 分钟 / 万条 | **提速 680 倍** |")
    lines.append(f"| **时空对齐合格率** | 82.4% (人工抽检) | 99.1% (毫秒级硬对齐) | **提升 16.7%** |")
    lines.append(f"| **数据泄漏风险** | 云端代工暴露不可控 | 100% 本地物理隔绝 | **零风险 (买断自持)** |")
    
    return "\n".join(lines)


def run_competitor_radar_pipeline(category: str, target_keyword: str) -> str:
    """
    模拟竞品痛点挖掘与差评聚类分析雷达
    """
    category = category.strip() or "具身智能机械臂操作"
    target_keyword = target_keyword.strip() or "行业大盘主流产品"

    pain_points = [
        {"point": "长时作业轨迹漂移与时间戳失步", "ratio": "38.2%", "severity": "P0 (阻塞级)", "solution": "FDE 现场部署硬件 PTP 时钟同步芯片 + 本地卡尔曼滤波校准中间件"},
        {"point": "异构硬件传感器接入繁杂、协议不兼容", "ratio": "26.5%", "severity": "P1 (严重)", "solution": "FDE 封装统一 ROS2/ZeroMQ 抽象设备适配层，抹平协议差异"},
        {"point": "清洗人工复核成本极高，边缘极端样本漏检", "ratio": "21.0%", "severity": "P1 (严重)", "solution": "基于 Qwen2.5 驱动的主动学习 (Active Learning) 挖掘难例样本"},
        {"point": "云端代标数据存在核心专有工艺外泄风险", "ratio": "14.3%", "severity": "P0 (合规)", "solution": "交付 100% 源码与本地物理容器镜像，数据物理不出厂"}
    ]
    
    res = []
    res.append(f"### 🎯 【{category}】大盘竞品痛点挖掘与改良建议")
    res.append(f"- **目标扫描关键词**: `{target_keyword}`")
    res.append(f"- **扫描样本总量**: `12,840 条行业买家/一线操作员真实负面反馈`")
    res.append(f"\n#### 1. 核心差评与业务阻碍聚类分布：")
    
    for idx, p in enumerate(pain_points, 1):
        res.append(f"**{idx}. {p['point']}** (占比 `{p['ratio']}` · 级别 `{p['severity']}`)")
        res.append(f"- 💡 **FDE 现场工程破解方案**: {p['solution']}\n")
        
    res.append(f"#### 2. AlphaFDE 现场工程落地转化建议：")
    res.append(f"> 建议立刻切入【{pain_points[0]['point']}】这一第一痛点作为现场交付的 MVP 标杆功能。通过交付专属本地清洗中间件，让客户技术负责人在 48 小时内看到真实数据提升，迅速建立信任并推动全案买断。")

    return "\n".join(res)


def calculate_fde_quote(days: int, engineers: int, has_gateway: bool, has_buyout: bool, gpu_hours: int) -> str:
    """
    现场工程交付报价与成本计算器
    """
    daily_rate = 3000
    labor_cost = days * engineers * daily_rate
    gateway_cost = 15000 if has_gateway else 0
    buyout_fee = 20000 if has_buyout else 0
    gpu_unit_cost = 4.5  # 阿里云/魔搭 GPU 平均折算元/小时
    gpu_cost = int(gpu_hours * gpu_unit_cost)
    total = labor_cost + gateway_cost + buyout_fee + gpu_cost

    return f"""### 📝 AlphaFDE 现场工程商业报价单 (Transparent FDE Quotation)

| 费用构成项目 | 测算基准 | 费用小计 (RMB) | 结算与交付原则 |
|---|---|---|---|
| **现场交付工程人月** | {engineers} 位资深交付工程师 × {days} 天 (¥{daily_rate}/天) | **¥ {labor_cost:,}** | 工程师进驻企业现场写代码，跑通真实业务 |
| **私有化模型网关 (Alpha-Gateway)** | 现场部署适配通义千问/开源模型高可用中转 | **¥ {gateway_cost:,}** | 秒级热备，100% 物理留存本地，带额度审计 |
| **全量源码与镜像买断授权** | 包含全套 Git 源码、Docker 镜像与架构图 | **¥ {buyout_fee:,}** | **源码彻底买断**，无任何隐形抽成或年费捆绑 |
| **弹性 GPU 算力消耗** | 预估 {gpu_hours} 算力小时 (实报实销单价 ¥{gpu_unit_cost}/h) | **¥ {gpu_cost:,}** | **算力实报实销**，直接绑定客户魔搭/云账户 |
| **总计工程投入 (Total)** | **总计 {days} 天交付落地周期** | **¥ {total:,} 元** | **前线交付闭环，终身享有自主升级权** |

> **🤝 交付承诺 (SLA)**：
> 1. **两周上线**：14 天内必须在客户现场完成实机部署与端到端闭环验收；
> 2. **零数据外流**：核心数据一旦离开客户私有内网，退还全部工程费用；
> 3. **伴随式交接**：交付期间包含对客户一线人员的全面技术交接与实操运维培训。
"""


def generate_full_proposal(track_name: str, custom_requirements: str, user_api_key: str = "") -> str:
    """
    生成完整的 FDE 现场工程方案
    支持 Qwen2.5 真实调用与高保真模板智能融合
    """
    key = user_api_key.strip() or DASHSCOPE_API_KEY
    scenario = TRACK_SCENARIOS.get(track_name, list(TRACK_SCENARIOS.values())[0])

    # 如果有 API Key，尝试使用 Qwen2.5 进一步深度扩写定制方案
    if key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=key, base_url=DASHSCOPE_BASE_URL)
            prompt = f"""你是一名具备资深产业经验的 AlphaFDE（现场工程交付）首席架构师。
针对客户选择的赛道方案【{scenario['title']}】，结合客户提出的补充定制诉求：
"{custom_requirements or '标准现场交付，要求代码买断且数据100%本地留存'}"

请遵循 AlphaFDE 准则，为客户输出一份兼具技术高标与商业说服力的现场工程交付方案（Markdown格式）：
1. 方案摘要与核心交付价值；
2. 系统架构拓扑图（使用 ASCII 框线呈现现场端到端数据流）；
3. 关键业务流水线与核心算法（明确强调开源模型 Qwen2.5 / Qwen2.5-VL 的深度融合与模型生态贡献）；
4. 14 天现场工程分阶段实施计划（明确各阶段交付物，体现 FDE 现场驻场编写代码）；
5. 现场交付商业报价与算力实报实销承诺。
"""
            completion = client.chat.completions.create(
                model=MODEL_NAME,
                messages=[
                    {"role": "system", "content": "你是一名顶尖的 AI 原生企业现场工程交付（FDE）首席架构师。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2500
            )
            return completion.choices[0].message.content
        except Exception as e:
            # 出现异常优雅回退到高保真模板
            print(f"[Warn] Qwen API call failed: {e}, fallback to template.")

    # 离线模式：生成详实的高保真方案
    output = []
    output.append(f"# 🏛️ {scenario['title']}")
    output.append(f"\n> **赛道定位**: `{scenario['category']}` | **交付团队**: `AlphaFDE 前线交付战队` | **引擎**: `基于开源 Qwen2.5 驱动`\n")
    output.append(f"### 一、 核心痛点诊断与交付价值")
    output.append(f"- **业务现状**: {scenario['description']}")
    output.append(f"- **核心交付价值**: {scenario['core_value']}")
    if custom_requirements:
        output.append(f"- **客户特别定制诉求**: *{custom_requirements}*")
        output.append(f"  └─ 已纳入本次现场工程定制架构范围，针对性调优边缘过滤与任务路由节点。")

    output.append(f"\n### 二、 系统现场工程架构拓扑 (100% 物理留存本地)")
    output.append(f"```text{scenario['topology']}```")

    output.append(f"\n### 三、 14 天现场交付里程碑排期 (Milestones)")
    output.append(f"| 交付周期 | 现场驻场工程核心任务 | 确定性交付产物 |")
    output.append(f"|---|---|---|")
    for m in scenario['milestones']:
        output.append(f"| **{m['phase']}** | {m['task']} | `{m['deliverable']}` |")

    p = scenario['pricing']
    output.append(f"\n### 四、 商业报价与成本构成 (源码买断 · 算力实报实销)")
    output.append(f"- **现场驻场人天**: {p['engineer_count']} 位资深工程师 × {p['engineering_days']} 天 (¥{p['engineer_rate_per_day']}/人天)")
    output.append(f"- **硬件底座/网关调优**: ¥{p['hardware_setup_cost'] + p['private_gateway_setup']} 元")
    output.append(f"- **整体工程预估**: **{p['total_estimate']}**")
    output.append(f"\n### 五、 魔搭社区开源生态贡献与资产沉淀声明")
    output.append(f"1. **模型开源复用**：方案全面集成魔搭社区主流开源模型 **Qwen2.5 (通义千问)**，发挥多语言与复杂工程指令遵循能力；")
    output.append(f"2. **资产开源沉淀**：交付的标准数据清洗转换流严格遵循开源生态标准，配套数据质检 Prompt 与中间件以开源许可沉淀于魔搭创空间；")
    output.append(f"3. **持续演进计划**：依托 ANC 四层架构，比赛结束后将持续维护该创空间并拓展至更广泛的多模态企业服务场景。")

    return "\n".join(output)
