# 竞品与开源参考（有出处，非空想）

> 调研日期：2026-09-21。用于对齐 `ops-console` 交互与能力边界，**禁止照抄未授权 UI**；只借鉴公开可见的信息架构与匹配逻辑。

---

## 一、可直接打开的 Demo / 线上产品（优先看）

| 名称 | 类型 | 链接 | 和我们相关的点 |
| :--- | :--- | :--- | :--- |
| **OPC 政策导航** | GitHub Pages 静态 Demo | https://siuserxiaowei.github.io/opc-policy/ · 仓 https://github.com/siuserxiaowei/opc-policy | 单页填条件 → 匹配列表；`data/policies.json` 结构化政策；广州专版有倒计时/筛选/材料清单；极轻量 HTML |
| **上海市企业服务云** | 政府企服正式站 | https://www.ssme.sh.gov.cn/ · 政策知识库 https://shpolicy.ssme.sh.gov.cn/knowledge/ | 「惠企政策一窗通」：检索 + 智能匹配 + 申报引导；登录后少填表、门槛条件组合匹配（公开报道） |
| **杭州亲清在线** | 本地政务正式站（云谷所在市） | https://qinqing.hangzhou.gov.cn/ | 政策超市、分平台「余省心」；申报/兑现主路径在政府平台——园区 Demo **应对接叙事，不重复造兑现厅** |
| **ICS-park 演示** | 智慧园区开源（有演示地址） | 仓 https://github.com/a-jiang/ICS-park · 文内演示 `http://8.129.171.42/`（admin/admin123，**以仓库 README 为准，可能失效**） | 企业档案、政策发布、申报辅导、企业服务菜单——偏「园区门户+后台」，政策匹配智能化弱 |

---

## 二、GitHub 开源（政策匹配 / 园区）

| 仓库 | Stars/形态 | 可借什么 | 不宜直接搬什么 |
| :--- | :--- | :--- | :--- |
| [CAZAMA1/Precise-Investment-Promotion-System-for-Industrial-Parks](https://github.com/CAZAMA1/Precise-Investment-Promotion-System-for-Industrial-Parks) | 园区精准招商；Streamlit；混合匹配（语义+BM25+规则）；含 `docs/DEMO_SCRIPT_5MIN.md` | **企业-政策可解释匹配**、Top 结果+门槛解释、5 分钟演示脚本结构 | 整站 Streamlit 壳；未核验数据合规 |
| [siuserxiaowei/opc-policy](https://github.com/siuserxiaowei/opc-policy) | 静态 HTML + JSON | **政策 JSON Schema、匹配页信息密度、轻量可投屏** | OPC 一人公司垂直场景，不等于园区企服 |
| [skygazer42/Glyph](https://github.com/skygazer42/Glyph) | 政务政策问答/资格/测算 API | REST API + 规则 DSL + 出处型回答 | 过重；消费补贴场景为主 |
| [BoussinesqJ/EcoPolicy-AI](https://github.com/BoussinesqJ/Economic-Policy-Analyzer) | Agent + Skill + 政策监控 | **Skill/REST 双态、PolicyMatch 矩阵思路**（与我们「开放 Skill」接近） | 全国抓取链路；Demo 不该接公网爬虫 |
| [a-jiang/ICS-park](https://github.com/a-jiang/ICS-park) / [kaifazhehcf/ics-park](https://github.com/kaifazhehcf/ics-park) | 园区资产+企服+招商 | 企业档案 / 政策发布信息架构 | 大而全后台，易踩「重复录入 CRM」雷 |
| [bsdinsight/parkone](https://github.com/bsdinsight/parkone) · https://parkone.vn | 工业园租约 CRM（Odoo） | 租户主数据、租约生命周期（**公司管理可参考字段边界**） | 越南工业园场景；非政策匹配 |

海外可扫（匹配逻辑参考，UI 文化不同）：

- https://github.com/soumyajit-18-shipi-it/AdhikarSetuu — MSME 福利匹配 + 排除分析看板  
- https://github.com/Atypis/subsidy4u — 德国补贴助手（对话过滤可视化）  
- https://github.com/my-codespace/yojna-mitra — 规则匹配 + SchemeCard（合格/部分合格 pill）

---

## 三、国内商业竞品（官网/报道，无源码）

| 产品 | 入口 | 公开能力（报道/官网表述） |
| :--- | :--- | :--- |
| **查策网** | 36氪报道：https://m.36kr.com/p/2536153981232645 | 政策库、企业画像匹配、API + 私有化；曾参与「上海市企业服务云」政策服务能力 |
| **科策云** | https://m.keceyun.com/szhfa/cyy | **产业园数字化**：企业补贴智能匹配、一键通知、政策 API |
| **实在智能 · 政策计算器** | https://www.ai-indeed.com/products/evaluator | 政策图谱、动态匹配、「政策找企业」、RPA 辅助通知/申报 |
| **鸿程 AI+惠企** | https://www.zjhcsoft.com/smart-znzz/213.html | 政策智配、千人千面推荐、查/报/兑/评链路 |

---

## 四、对云谷 Demo 的落地建议（只保留有据的）

1. **交互密度**：优先抄 **opc-policy** 的「条件 → 结果卡片 → 出处/材料」轻量路径，而不是猜 Codeless 全产品壳。  
2. **匹配可解释**：优先抄 **CAZAMA1** 的「门槛/激励解释 + DEMO_SCRIPT_5MIN」，对应我们已定的三态+出处。  
3. **Skill 形态**：看 **EcoPolicy-AI** 的 REST/Skill 双态，继续我们已做的 `/api/policy_radar` 等，不要再发明第五个工作台。  
4. **本地竞品叙事**：投屏时对齐 **亲清在线**（政府兑现主渠道）+ 园区运营台做「初筛副驾驶 / 漏提醒」，避免声称替代亲清兑现。  
5. **公司侧**：租户主数据边界可扫 **Parkone/ICS-park**，但字段必须继续脱敏；不要做成第二套 CRM 录入台。

---

## 五、建议你本人先点开的 4 个

1. https://siuserxiaowei.github.io/opc-policy/  
2. https://qinqing.hangzhou.gov.cn/  
3. https://www.ssme.sh.gov.cn/  
4. https://github.com/CAZAMA1/Precise-Investment-Promotion-System-for-Industrial-Parks（看 README + `docs/DEMO_SCRIPT_5MIN.md`）
