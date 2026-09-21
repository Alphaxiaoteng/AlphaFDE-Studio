# ==============================================================================
# 云谷中心 · 政策与活动雷达轻量化生产 Docker 镜像
# ==============================================================================
FROM python:3.11-slim

# 设置工作目录与环境变量
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PORT=7860 \
    AUTO_CRON=true \
    TZ=Asia/Shanghai

# 安装基础系统工具（curl用于健康检查，cron/tzdata用于时区与定时任务）
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tzdata \
    cron \
    && rm -rf /var/lib/apt/lists/*

# 复制项目代码与资源文件
COPY . /app/

# 设置脚本可执行权限
RUN chmod +x /app/entrypoint.sh /app/policy_radar_cli.py /app/ops-radar /app/scripts/*.sh 2>/dev/null || true

# 暴露服务端口
EXPOSE 7860 8766

# 数据持久化挂载声明
VOLUME ["/app/data.json", "/app/pipeline_audit.log"]

# 容器启动入口
ENTRYPOINT ["/app/entrypoint.sh"]
