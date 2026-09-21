#!/bin/bash
# ==============================================================================
# 云谷中心 · 每日服务雷达自动搜集与三层漏斗有效性清洗 Cron 任务脚本
# 触发时机：每日早间 08:00
# 运行逻辑：触发 pipeline_policy_radar.py，执行时效检查/基因匹配/双益过滤并落盘审计日志
# ==============================================================================

set -e

DIR="/Users/albert/Documents/project/tmp/fde/ops-console"
LOG="$DIR/pipeline_audit.log"

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] 触发每日服务雷达自动清洗与更新任务..." >> "$LOG"

/usr/bin/env python3 "$DIR/pipeline_policy_radar.py" >> "$LOG" 2>&1

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] 每日服务雷达清洗成功完成 (Exit Code 0)。" >> "$LOG"
  echo "✓ 每日政策清洗完成，已同步落盘 data.json 并记录审计日志。"
else
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] 每日服务雷达清洗异常，退出码: $EXIT_CODE" >> "$LOG"
  echo "❌ 任务执行异常，退出码: $EXIT_CODE"
  exit $EXIT_CODE
fi
