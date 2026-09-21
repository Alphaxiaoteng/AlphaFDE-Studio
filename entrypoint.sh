#!/usr/bin/env bash
# ==============================================================================
# 云谷中心 · 政策与活动雷达 Docker 容器启动入口 (Entrypoint)
# ==============================================================================
set -e

echo "=========================================================="
echo "🐳 启动云谷中心企服运营工作台容器环境 (Docker Container)"
echo "   端口: ${PORT:-7860} | 自动定时清洗: ${AUTO_CRON:-true}"
echo "=========================================================="

# 1. 容器首次/每次启动，执行一次全量三层漏斗规则引擎自检更新
echo "🔄 [Init] 执行启动期政策与公开活动三层漏斗有效性清洗..."
python3 /app/policy_radar_cli.py update || true

# 2. 如果开启 AUTO_CRON，则在后台启动每日定时更新循环（每 24 小时或每日早 08:00 唤醒）
if [ "${AUTO_CRON}" = "true" ]; then
  echo "⏰ [Cron] 启用后台自动定时清洗守护线程 (每日早 08:00 自动执行)..."
  (
    while true; do
      # 每次休眠 24 小时 (86400 秒)
      sleep 86400
      echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] 容器后台定时触发雷达数据更新..." >> /app/pipeline_audit.log
      python3 /app/policy_radar_cli.py cron >> /app/pipeline_audit.log 2>&1 || true
    done
  ) &
fi

# 3. 启动前台 Web 服务
echo "🌐 [Server] 启动主服务，监听 0.0.0.0:${PORT:-7860}..."
exec python3 /app/server.py
