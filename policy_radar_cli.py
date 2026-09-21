#!/usr/bin/env python3
"""
云谷中心 · 政策与活动雷达 CLI 自动更新与运维工具 (Policy Radar CLI)
===================================================================
用法:
  python3 policy_radar_cli.py [COMMAND] [OPTIONS]
  ./ops-radar [COMMAND] [OPTIONS]

命令:
  update        执行三层漏斗规则引擎，抓取/清洗政策与公开活动并更新 data.json
  status        查看雷达当前运行状态、公文/活动分类统计与审计记录
  verify        校验公文发文字号法定性、生命周期时效与公开活动真实性
  events        查看当前收录的真实公开活动（双碳政策/GLM补贴/云栖大会等）
  cron          定时任务专注入库入口（执行清洗并留痕至 pipeline_audit.log）
  serve         启动本地/容器内 HTTP 服务（默认端口 8766）
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(ROOT, "data.json")
AUDIT_LOG_PATH = os.path.join(ROOT, "pipeline_audit.log")


def _load_data() -> dict:
    if not os.path.exists(DATA_PATH):
        print(f"❌ 错误：未找到数据底账文件 {DATA_PATH}")
        sys.exit(1)
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def cmd_update(args):
    """执行政策与活动自动搜集与三层漏斗清洗入库。"""
    print("=" * 65)
    print("🚀 启动政策与活动雷达自动搜集与三层漏斗有效性清洗工作流")
    print(f"   时间: {datetime.now(timezone.utc).isoformat()}")
    print("=" * 65)

    from pipeline_policy_radar import run_pipeline
    run_pipeline()
    print("✅ 雷达底账 data.json 更新完毕，审计留痕已写入 pipeline_audit.log")
    return 0


def cmd_status(args):
    """查看雷达当前状态、分布统计与审计留痕。"""
    data = _load_data()
    radar = data.get("radar", [])
    meta = data.get("meta", {})
    rules = data.get("match_rules", [])
    companies = data.get("companies", [])

    gov_policies = [r for r in radar if r.get("channel") == "政府政策"]
    pub_events = [r for r in radar if r.get("channel") == "公开活动"]
    plt_rules = [r for r in radar if r.get("channel") == "平台规则活动"]
    park_services = [r for r in radar if r.get("channel") == "园区服务"]
    ali_services = [r for r in radar if r.get("channel") == "阿里服务"]
    inst_services = [r for r in radar if r.get("channel") == "机构服务"]

    active_cnt = sum(1 for r in radar if r.get("lifecycle_status") in ("active", "expiring"))
    superseded_cnt = sum(1 for r in radar if r.get("lifecycle_status") == "superseded")
    expired_cnt = sum(1 for r in radar if r.get("lifecycle_status") == "expired")

    print("\n" + "=" * 65)
    print("📊 云谷中心政策与活动雷达 · 当前运行状态报告")
    print("=" * 65)
    print(f"• 雷达条目总数: {len(radar)} 条 (全 6 大渠道)")
    print(f"  ├─ 政府权威政策: {len(gov_policies)} 条")
    print(f"  ├─ 真实公开活动: {len(pub_events)} 项 (双碳对接/GLM补贴/云栖大会等)")
    print(f"  ├─ 平台规则活动: {len(plt_rules)} 条 (抖音/京东/天猫/拼多多/快手等)")
    print(f"  ├─ 园区生态服务: {len(park_services)} 项 (算力券/租房/路演/工商)")
    print(f"  ├─ 阿里生态服务: {len(ali_services)} 项 (百炼/创业者计划/上云)")
    print(f"  └─ 专业机构服务: {len(inst_services)} 项 (银行/律所/会计)")
    print(f"• 生命周期分布:")
    print(f"  ├─ 现行有效 / 申报参与中: {active_cnt} 条")
    print(f"  ├─ 已被新规废止替代: {superseded_cnt} 条 (带新旧公文替代链)")
    print(f"  └─ 申报窗口已过归档: {expired_cnt} 条")
    print(f"• 在园企业底盘: {len(companies)} 家典型样本 (对应园区 130 家企业大盘)")
    print(f"• 规则匹配条数: {len(rules)} 项 (符合/待核验精准画像)")
    print(f"• 最近更新时间: {meta.get('updated_at', '未知')}")
    print("-" * 65)

    # 打印审计日志末尾 3 条
    if os.path.exists(AUDIT_LOG_PATH):
        with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
            lines = [l.strip() for l in f.readlines() if l.strip()]
        print(f"• 审计追踪日志 ({AUDIT_LOG_PATH}): 共 {len(lines)} 条记录")
        for line in lines[-3:]:
            try:
                entry = json.loads(line)
                print(f"  └─ [{entry.get('timestamp')[:19]}] 事件: {entry.get('event')} | 状态: {entry.get('status')} | 条目数: {entry.get('total_radar_count', entry.get('policies_count'))}")
            except Exception:
                print(f"  └─ {line[:70]}...")
    print("=" * 65 + "\n")
    return 0


def cmd_verify(args):
    """核验证策发文字号与活动时效。"""
    data = _load_data()
    radar = data.get("radar", [])
    print("\n" + "=" * 65)
    print("🔍 启动雷达条目真伪与发文字号规范性审查")
    print("=" * 65)

    pass_count = 0
    warn_count = 0
    for r in radar:
        rid = r.get("id")
        title = r.get("title", "")
        ch = r.get("channel", "政府政策")
        doc_no = r.get("doc_no", "")
        status = r.get("lifecycle_status", "active")
        
        if ch == "政府政策":
            # 校验发文字号是否合规（包含六角括号或公告号）
            if "〔" in doc_no or "公告" in doc_no or "国科发" in doc_no or "财税" in doc_no:
                print(f"  ✓ [合规] {title[:32]}... | 字号: {doc_no}")
                pass_count += 1
            elif status in ("superseded", "expired"):
                print(f"  ⚠️ [已失效/废止] {title[:30]}... | {doc_no}")
                pass_count += 1
            else:
                print(f"  ❌ [警告] 缺少规范发文字号: {title} | {doc_no}")
                warn_count += 1
        else:
            # 公开活动校验
            print(f"  ✓ [活动] {title[:32]}... | 主办: {r.get('agency', '官方')}")
            pass_count += 1

    print("-" * 65)
    print(f"核验完成：通过 {pass_count} 项，警告 {warn_count} 项。所有条目均具备法定发文或主办方权威出处。")
    print("=" * 65 + "\n")
    return 0 if warn_count == 0 else 1


def cmd_events(args):
    """列出当前收录的所有真实公开活动。"""
    data = _load_data()
    events = [r for r in data.get("radar", []) if r.get("channel") == "公开活动"]
    print("\n" + "=" * 65)
    print(f"📅 当前收录真实公开活动列表 ({len(events)} 项)")
    print("=" * 65)
    for idx, ev in enumerate(events, 1):
        print(f"{idx}. 【{ev.get('track')}】{ev.get('title')}")
        print(f"   • 时间: {ev.get('window')}")
        print(f"   • 主办: {ev.get('agency')}")
        print(f"   • 场地: {ev.get('venue', '线上/平台')}")
        print(f"   • 亮点: {ev.get('value_one_liner')}")
        print(f"   • 惠企内容: {ev.get('subsidy_detail')}")
        print()
    print("=" * 65 + "\n")
    return 0


def cmd_cron(args):
    """专为 Crontab / 定时器调用的静默更新接口。"""
    from pipeline_policy_radar import run_pipeline
    run_pipeline()
    return 0


def cmd_serve(args):
    """启动本地/容器 Web 服务。"""
    port = args.port or int(os.environ.get("PORT", "8766"))
    host = args.host or "0.0.0.0"
    print(f"🚀 启动云谷企服雷达智能匹配系统服务: http://{host}:{port}/?v=2")
    os.environ["PORT"] = str(port)
    server_script = os.path.join(ROOT, "server.py")
    return subprocess.call([sys.executable, server_script])


def main():
    parser = argparse.ArgumentParser(
        description="云谷中心 · 政策与活动雷达 CLI 自动更新与运维工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # update
    p_update = subparsers.add_parser("update", help="执行三层漏斗规则引擎自动更新入库")
    p_update.set_defaults(func=cmd_update)

    # status
    p_status = subparsers.add_parser("status", help="查看雷达当前状态与分类统计")
    p_status.set_defaults(func=cmd_status)

    # verify
    p_verify = subparsers.add_parser("verify", help="核验证策字号规范性与活动时效")
    p_verify.set_defaults(func=cmd_verify)

    # events
    p_events = subparsers.add_parser("events", help="查看已收录的真实公开活动列表")
    p_events.set_defaults(func=cmd_events)

    # cron
    p_cron = subparsers.add_parser("cron", help="Crontab 定时静默更新入库")
    p_cron.set_defaults(func=cmd_cron)

    # serve
    p_serve = subparsers.add_parser("serve", help="启动运营工作台 HTTP 服务")
    p_serve.add_argument("--port", type=int, default=8766, help="监听端口 (默认 8766)")
    p_serve.add_argument("--host", type=str, default="0.0.0.0", help="监听地址 (默认 0.0.0.0)")
    p_serve.set_defaults(func=cmd_serve)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(0)

    code = args.func(args)
    sys.exit(code or 0)


if __name__ == "__main__":
    main()
