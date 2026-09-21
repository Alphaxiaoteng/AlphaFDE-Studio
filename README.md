---
title: 云谷政策雷达智能匹配系统 · AlphaFDE
emoji: 📡
colorFrom: blue
colorTo: cyan
sdk: docker
app_port: 7860
pinned: false
---

# 云谷政策雷达智能匹配系统 · AlphaFDE

> AlphaFDE T-JFG7 · 云谷中心 AI 提效升级园区运营  
> 在线 Demo：[魔搭创空间](https://modelscope.cn/studios/cp1024/AlphaFDE-Studio) · [直连](https://cp1024-alphafde-studio.ms.show/)

3 人企服编制下，把政策辅导做成可核验流水线：**政策雷达初筛 → 三态判定（符合/排除/待核验）→ 专员放行 → 微信草稿触达 → SOP 留痕**。  
不读私人微信、不代窗口申报、不做地库/晚宴等未交付能力。

## 功能

| 模块 | 说明 |
| :--- | :--- |
| **看板** | 在园企业、现行政策、匹配中、SOP 通过、临近申报死线 |
| **政策雷达** | 政府政策 / 公开活动；`urgency` + `days_left` 紧急窗口置顶；条款 `citation` |
| **企业运营** | 脱敏画像、字段来源与确认态、企业↔政策三态匹配、材料 gap |
| **匹配 SOP** | 发送 → 企业接受 → 申请提交 → 办理中 → 已通过；确认/驳回写日志 |
| **Agent Skills** | `GET /skills.md` 一句话接入 API |

## 在线体验

```bash
# Skills 喂给 Agent
curl -fsSL -A "Mozilla/5.0" https://cp1024-alphafde-studio.ms.show/skills.md
```

- UI：https://cp1024-alphafde-studio.ms.show/
- ModelScope：https://modelscope.cn/studios/cp1024/AlphaFDE-Studio

## 本地运行

```bash
# 依赖：Python 3.10+（标准库即可跑主服务）
python3 server.py
# 默认 http://127.0.0.1:8766
```

可选环境变量（复制 `.env.example` → `.env`，**勿提交 `.env`**）：

| 变量 | 用途 |
| :--- | :--- |
| `ALLNET_API_KEY` | 媒体热点（无密钥时诚实降级） |
| `TIKHUB_API_KEY` | 可选补充图/视频源 |
| `PORT` | 默认 `8766` |

## Docker

```bash
docker compose up -d --build
# http://127.0.0.1:8766
```

健康检查与持久化见 `docker-compose.yml`；CLI / 日更流水线见 `CLI_DOCKER_SOP.md`、`POLICY_COLLECTION_SOP.md`。

## 报价口径（试点）

- 一次性部署：**¥29,800**
- 月运维：**¥5,800**
- 首年合计：**¥99,400**

## 边界（红线）

- ❌ 不读私人微信 / 不宣称企微进个人群  
- ❌ 不代政府窗口申报、不做「必过」承诺  
- ❌ 不做地库导航、晚宴排座、物业催缴全链路  
- ✅ 工作数据建议园区受控部署；敏感原件不裸传公网模型  

## 许可

比赛与开源演示用途；样例企业为脱敏虚构数据，非平台实名接入。
