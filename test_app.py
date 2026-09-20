# -*- coding: utf-8 -*-
"""
AICUT 创空间全流程测试套件
验证路由、Gradio 协议探针、Agent Harness 打靶与剪映草稿导出
"""
import os
for _k in ["NO_PROXY", "no_proxy"]:
    if _k in os.environ:
        os.environ[_k] = ",".join([_p.strip() for _p in os.environ[_k].split(",") if "::" not in _p])

import json
from fastapi.testclient import TestClient
from app import app, handle_gradio_match, PRESETS

def test_aicut_studio():
    client = TestClient(app)

    print("🧪 1. 测试基础 API 探针与插件列表...")
    r_health = client.get("/api/health")
    assert r_health.status_code == 200, f"Health check failed: {r_health.text}"
    assert r_health.json()["app"] == "aicut"
    print("  ✅ /api/health 验证通过:", r_health.json())

    r_keys = client.get("/api/keys")
    assert r_keys.status_code == 200
    assert "dashscope" in r_keys.json()["keys"]
    print("  ✅ /api/keys 验证通过")

    r_plugins = client.get("/api/plugins")
    assert r_plugins.status_code == 200
    assert len(r_plugins.json()["plugins"]) >= 3
    print("  ✅ /api/plugins 验证通过")

    print("🧪 2. 测试 Gradio 核心协议探针 (/config)...")
    r_config = client.get("/config")
    assert r_config.status_code == 200, f"/config failed: {r_config.text}"
    print("  ✅ /config 验证通过 (HTTP 200), 魔搭外层宿主无障碍连接")

    print("🧪 3. 测试静态 Webview 与资源挂载 (/editor)...")
    r_editor = client.get("/editor/")
    assert r_editor.status_code == 200
    assert "AICUT" in r_editor.text
    print("  ✅ /editor 验证通过, 成功加载主页面 HTML")

    r_js = client.get("/assets/index-CcFosPwA.js")
    assert r_js.status_code == 200
    assert len(r_js.content) > 100000
    print(f"  ✅ /assets JS 资源挂载验证通过, 大小: {len(r_js.content)} 字节")

    print("🧪 4. 测试 Agent Harness 语义打靶逻辑与剪映草稿导出...")
    table, log_text, draft_json = handle_gradio_match(PRESETS[0]["text"])
    assert "智能匹配镜头资产" in table
    assert "多用膏" in table or "底妆" in table or "散粉" in table
    assert len(log_text) > 0
    
    draft = json.loads(draft_json)
    assert draft["version"] == "5.9.0"
    assert len(draft["tracks"]) == 2
    assert len(draft["tracks"][0]["segments"]) > 0
    print(f"  ✅ Agent Harness 语义打靶与剪映草稿生成通过, 生成镜头片段: {len(draft['tracks'][0]['segments'])} 个")

    print("🧪 5. 测试 POST /api/harness/match 接口...")
    r_match = client.post("/api/harness/match", json={"lines": [{"text": "早上八点想要好气色", "startSec": 0, "endSec": 2.5}]})
    assert r_match.status_code == 200
    assert r_match.json()["success"] is True
    print("  ✅ /api/harness/match REST API 验证通过")

    print("\n🎉 ALL TESTS PASSED! AICUT 创空间全模块自检 100% 通过！")

if __name__ == "__main__":
    test_aicut_studio()
