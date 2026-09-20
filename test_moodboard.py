# -*- coding: utf-8 -*-
"""
AI Moodboard Studio 本地自动化验证脚本
"""
import os
for _v in ["NO_PROXY", "no_proxy"]:
    if _v in os.environ:
        os.environ[_v] = ",".join([_p.strip() for _p in os.environ[_v].split(",") if "::" not in _p])

import urllib.request
import time
import threading
from moodboard_data import TREND_STYLES, HOT_TREND_DATA
from moodboard_engine import get_style_info, compile_commercial_prompt
from app import demo

def test_moodboard_engine():
    print("🧪 1. 测试各风格流派情绪板数据完整性...")
    for style in TREND_STYLES:
        img, palette, report, zh, en = get_style_info(style)
        assert os.path.exists(img), f"图片文件不存在: {img}"
        assert len(palette) > 0, f"色卡渲染为空: {style}"
        assert len(report) > 50, f"分析报告内容过短: {style}"
    print("  ✅ 4 大主力风格情绪板资产与色卡校验 100% 通过")

    print("🧪 2. 测试商业生图 Prompt 编译引擎...")
    prompt_res, status = compile_commercial_prompt(
        "美式复古学院风 (Ivy League / Preppy)",
        "东亚高级脸年轻女模特",
        "拱窗午后自然阳光与柔和阴影",
        "哈苏中画幅 85mm f/1.4 人像定焦",
        "手持复古牛皮书卷"
    )
    assert "商业摄影" in prompt_res or "Commercial" in prompt_res, "Prompt 编译失败"
    print("  ✅ 商业生图 Prompt 编译验证通过")

def test_web_server():
    print("🧪 3. 启动 Gradio 服务并测试 HTTP 200 响应...")
    server_port = 7861
    threading.Thread(target=lambda: demo.launch(server_name="127.0.0.1", server_port=server_port, prevent_thread_lock=True), daemon=True).start()
    
    connected = False
    for i in range(10):
        time.sleep(1)
        try:
            req = urllib.request.Request(f"http://127.0.0.1:{server_port}/")
            with urllib.request.urlopen(req, timeout=3) as resp:
                if resp.status == 200:
                    connected = True
                    print(f"  ✅ 成功探测到 Gradio 服务监听端口 {server_port}，HTTP 响应码: {resp.status}")
                    break
        except Exception:
            pass
            
    assert connected, f"无法在端口 {server_port} 探测到 HTTP 200 响应"
    demo.close()
    print("  ✅ Gradio 服务生命周期测试闭环完成")

if __name__ == "__main__":
    test_moodboard_engine()
    test_web_server()
    print("\n🎉 ALL TESTS PASSED! AI Trend Moodboard 创空间应用自检 100% 通过！")
