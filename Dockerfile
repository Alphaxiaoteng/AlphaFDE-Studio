# ==============================================================================
# 云谷中心 · 政策与活动雷达 TypeScript 生产 Docker 镜像
# ==============================================================================
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=7860 \
    HOST=0.0.0.0 \
    TZ=Asia/Shanghai

# 安装 tzdata 处理时区
RUN apk add --no-cache tzdata

# 安装依赖
COPY package*.json tsconfig.json ./
RUN npm install

# 复制项目代码与资源文件
COPY . .

# 编译 TypeScript
RUN npm run build

# 暴露服务端口
EXPOSE 7860 8766

# 启动 TypeScript 服务
CMD ["node", "dist/server.js"]
