#!/usr/bin/env bash
# ==============================================================================
# AlphaFDE · 魔搭创空间 (ModelScope Studio) 一键部署推送脚本
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================================"
echo "🚀 AlphaFDE 创空间工程打包与推送向导"
echo "========================================================"

# 检查当前目录是否为 git 仓库
if [ ! -d ".git" ]; then
    echo "📦 初始化本地 Git 仓库..."
    git init
    git checkout -b master 2>/dev/null || git checkout -b main
fi

git add .
git commit -m "feat: initial commit for AlphaFDE Studio on ModelScope" || true

REPO_URL="$1"

if [ -z "$REPO_URL" ]; then
    echo ""
    echo "📋 部署指引："
    echo "1. 请前往魔搭社区创空间创建页面: https://modelscope.cn/studios"
    echo "2. 点击右上角「我要创建」或「创建创空间」"
    echo "3. 填写基本信息："
    echo "   - 创空间名称: AlphaFDE-Studio (或自定义)"
    echo "   - SDK 框架: 选择 Gradio (Gradio 5.x)"
    echo "   - 硬件资源: 选择 CPU (免费) 即可流畅运行"
    echo "   - 可见性: 公开 (或仅公开体验)"
    echo "4. 创建完成后，复制页面上的 Git 仓库克隆地址 (例如: https://oauth2:token@www.modelscope.cn/studios/username/AlphaFDE-Studio.git)"
    echo ""
    read -p "👉 请输入您的魔搭创空间 Git 仓库地址: " REPO_URL
fi

if [ -z "$REPO_URL" ]; then
    echo "❌ 未提供 Git 仓库地址，已中止推送。"
    echo "💡 您可以随时手动运行: ./deploy_to_modelscope.sh <您的创空间Git地址>"
    exit 1
fi

echo ""
echo "🔗 正在配置远程仓库源..."
git remote remove modelscope 2>/dev/null || true
git remote add modelscope "$REPO_URL"

echo "⬆️ 正在推送到魔搭创空间..."
# 尝试推送 master 或 main
if git push -u modelscope master; then
    echo ""
    echo "🎉 部署推送成功！"
elif git push -u modelscope main; then
    echo ""
    echo "🎉 部署推送成功！"
else
    echo "⚠️ 普通推流失败，尝试强制覆盖初始分支 (git push -f modelscope HEAD:master)..."
    git push -f modelscope HEAD:master
    echo "🎉 部署推送成功！"
fi

echo ""
echo "✅ 创空间已触发自动构建！"
echo "👉 请前往魔搭创空间页面查看构建日志与在线运行效果！"
