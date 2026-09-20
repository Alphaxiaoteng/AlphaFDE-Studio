# -*- coding: utf-8 -*-
"""
AlphaFDE Studio 本地自动化验证脚本
"""
import os
for _v in ["NO_PROXY", "no_proxy"]:
    if _v in os.environ:
        os.environ[_v] = ",".join([_p.strip() for _p in os.environ[_v].split(",") if "::" not in _p])

import urllib.request

import time
import threading
import sys
from pipelines import (
    run_data_governance_pipeline,
    run_competitor_radar_pipeline,
    calculate_fde_quote,
    generate_full_proposal
)
from app import export_audit_trail, client_agent_chat, demo

def test_pipelines():
    print("🧪 1. 测试 FDE 核心方案生成器...")
    prop = generate_full_proposal("赛道 01：具身智能数据工厂 (Embodied Data Factory)", "需要 LeRobot 格式转换")
    assert "具身智能数据工厂" in prop, "方案生成失败"
    assert "系统现场工程架构拓扑" in prop, "缺少拓扑图"
    print("  ✅ 方案生成器验证通过")

    print("🧪 2. 测试数据治理清洗流水线...")
    gov = run_data_governance_pipeline(5000, "具身机械臂 60Hz 遥操作采集流 (RGB-D + 触觉)")
    assert "治理成效指标" in gov, "流水线输出异常"
    print("  ✅ 数据治理流水线验证通过")

    print("🧪 3. 测试大盘竞品痛点雷达...")
    radar = run_competitor_radar_pipeline("具身机器人异地采集", "开源标注工具")
    assert "核心差评与业务阻碍聚类分布" in radar, "竞品雷达输出异常"
    print("  ✅ 竞品痛点雷达验证通过")

    print("🧪 4. 测试商业报价计算器...")
    quote = calculate_fde_quote(14, 2, True, True, 100)
    assert "商业报价单" in quote and "¥" in quote, "报价计算异常"
    print("  ✅ 报价计算器验证通过")

    print("🧪 5. 测试甲方 Agent 对话与证据链导出...")
    history = []
    for h, _ in client_agent_chat("请问时钟对齐误差是多少？", history, ""):
        history = h
    assert len(history) == 2, "对话记录长度不符合预期"
    assert "甲方 Agent 洞察评分" in history[1]["content"], "缺少评分"
    trail = export_audit_trail(history)
    assert "问询留痕与需求洞察证据链" in trail, "证据链导出异常"
    print("  ✅ 甲方 Agent 模拟与证据链导出验证通过")

def test_web_server():
    print("🧪 6. 启动 Gradio 服务并测试 HTTP 200 响应...")
    
    server_port = 7860
    # 在后台线程启动 Gradio
    threading.Thread(target=lambda: demo.launch(server_name="127.0.0.1", server_port=server_port, prevent_thread_lock=True), daemon=True).start()
    
    # 轮询探测 HTTP 服务响应
    connected = False
    for i in range(15):
        time.sleep(1)
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{server_port}/")
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    connected = True
                    print(f"  ✅ 成功探测到 Gradio 服务监听端口 {server_port}，HTTP 响应码: {resp.status}")
                    break
        except Exception as e:
            # 等待服务完全就绪
            pass
            
    assert connected, f"无法在端口 {server_port} 探测到 HTTP 200 响应"
    demo.close()
    print("  ✅ Gradio 服务生命周期测试闭环完成")

if __name__ == "__main__":
    test_pipelines()
    test_web_server()
    print("\n🎉 ALL TESTS PASSED! AlphaFDE 创空间应用全模块自检 100% 通过！")
