# SPEC 文档体系优化设计

- 日期：2026-07-17
- 状态：已批准，待实施计划
- 范围：文档架构、需求治理、发布范围、派生规格同步和文档验证
- 不在范围：产品代码实现、基础设施变更、商业供应商实际接入

## 1. 背景与问题

当前 `SPEC.md` 是 `weather.txt` 的统一规格，主体能力覆盖较完整，但审计确认仍存在以下问题：

1. Google AdSense、候选 Affiliate 品牌和广告位置没有形成可追踪合同。
2. 城市页原始主题中的 Mountain 缺失，Theme Park 未进入城市评分模型。
3. “尽可能静态生成”没有落实为路由级渲染策略。
4. Bot Protection 只有威胁识别，没有控制措施和验收要求。
5. Analytics 没有明确 `top_pages` 和 `acquisition_country` 报表合同。
6. Lighthouse 100 与 INP Excellent 被改写为模糊目标，缺少稳定的发布门禁。
7. Compare、Weekend Planner、文章系统在 MVP、Beta、V1 之间重复或冲突。
8. ADR 的记录频率和每阶段 decision log 规则不明确。
9. `.kiro/specs/where-not-rain/` 是从 SPEC 派生的实施材料；权威正文变化后存在同步漂移风险。
10. 单一大型 SPEC 难以让多个领域独立维护，也不利于 Coding Agent 精确加载上下文。

本设计采用“合同优先的结构化重构”：先建立权威边界、稳定 Requirement ID、唯一发布矩阵和追踪表，再迁移正文并同步派生规格。目标是可执行和可维护，不追求固定页数。

## 2. 已批准的关键决策

1. `SPEC.md` 改为权威总纲和索引，不再复制领域正文。
2. 各 `docs/*.md` 文件是相应领域的权威正文。
3. `weather.txt` 保留为历史输入，不再作为实施依据。
4. `.kiro/specs/where-not-rain/` 是派生材料；与权威文档冲突时，以权威文档为准。
5. 采用精简 MVP；Compare、Weekend Planner 和文章系统进入 Beta。
6. Lighthouse 四项 100 保留为产品目标；CI 与生产遥测采用双层硬门禁。
7. 点名商业品牌进入候选 Adapter 注册表，不承诺全部接入。
8. Mountain 与 Theme Park 采用天气和可信目的地属性的混合适宜度；数据不足时隐藏。
9. 每阶段必须有 decision log；只有形成架构决策时才新增或更新 ADR。
10. 文档验证不引入第三方依赖。

## 3. 目标文档架构

```text
SPEC.md                              # 权威总纲、治理规则、索引
docs/
├── README.md                        # 阅读路径与维护说明
├── 00-Founder-Vision.md             # 愿景、市场、定位、商业模型
├── 01-Product-PRD.md                # 用户、功能需求、验收标准
├── 02-UX-Bible.md                   # 信息架构、流程、设计系统、状态、无障碍
├── 03-SEO-Bible.md                  # SEO、内容、程序化页面质量门禁
├── 04-AI-Coding-Bible.md            # Agent 协议、编码边界、Definition of Done
├── 05-System-Architecture.md        # 系统边界、数据流、缓存、可靠性
├── 06-Database.md                   # D1 模型、索引、迁移、保留策略
├── 07-API-Spec.md                   # API 合同、错误、鉴权、限流
├── 08-Cloudflare-Deployment.md      # 免费套餐、环境、CI/CD、回滚
├── 09-Engineering-Handbook.md       # TypeScript、测试、性能、安全、可观测性
├── 10-Growth-Bible.md               # Analytics、Affiliate、广告、实验
├── 11-Roadmap.md                    # 唯一发布矩阵与阶段门禁
├── 12-ADR/
└── 13-Requirements-Traceability.md  # 原始输入到正式合同的追踪
```

### 3.1 权威边界

| 决策类型                            | 唯一权威文档                  |
| ----------------------------------- | ----------------------------- |
| 产品愿景、市场和商业阶段            | `00-Founder-Vision.md`        |
| 功能范围和验收标准                  | `01-Product-PRD.md`           |
| UX、Design System、状态和无障碍     | `02-UX-Bible.md`              |
| SEO、内容和索引质量门禁             | `03-SEO-Bible.md`             |
| Agent 行为、编码边界和 DoD          | `04-AI-Coding-Bible.md`       |
| 系统架构、数据流、缓存和恢复        | `05-System-Architecture.md`   |
| 数据模型、索引、迁移和保留          | `06-Database.md`              |
| API 请求、响应、错误、鉴权和限流    | `07-API-Spec.md`              |
| Cloudflare 环境、额度、CI/CD 和回滚 | `08-Cloudflare-Deployment.md` |
| 测试、性能、安全和可观测性门禁      | `09-Engineering-Handbook.md`  |
| Analytics、Affiliate、广告和实验    | `10-Growth-Bible.md`          |
| 发布版本、顺序和阶段验收            | `11-Roadmap.md`               |
| 已批准的架构例外                    | 对应 ADR                      |

领域文档可以引用其他领域的 Requirement ID，但不得复制并重新定义其合同。`00-Founder-Vision.md` 中的“商业阶段”只描述收入模式和市场演进，不决定功能首次发布；任何功能的 MVP/Beta/V1/V2 归属只由 `11-Roadmap.md` 定义。若两个正文发生冲突，先根据权威边界识别拥有者；无法判断时停止实施、记录问题并请求产品负责人裁决。

### 3.2 Requirement ID

使用稳定命名空间：

- `VISION-*`：愿景和市场原则
- `PRD-FR-*`：产品功能
- `UX-*`：交互、设计系统和无障碍
- `SEO-*`：SEO 和内容质量
- `AGENT-*`：Coding Agent 与交付规则
- `ARCH-*`：系统架构和数据流
- `DATA-*`：数据模型和迁移
- `API-*`：接口合同
- `DEP-*`：部署和运行环境
- `ENG-*`：工程质量、性能、安全和可靠性
- `GROW-*`：分析、商业化和实验
- `REL-*`：发布和阶段门禁

ID 一旦发布不得因移动章节或调整标题而改变。废弃要求保留 ID 并标注 `Deprecated` 或 `Superseded by`，不得静默复用。

## 4. 唯一发布基线

发布归属和 lifecycle 只在 `docs/11-Roadmap.md` 定义。每个 Active Hard Requirement 必须且只能出现在一条 `REL-*` Roadmap 记录中；领域 Requirement 元数据只保存 `roadmap_ref`，不得重复保存版本值。性能、安全、Bot、渲染、隐私和可靠性记录以 MVP 为首次发布且 lifecycle 为 Continuous。Cloudflare Web Analytics 在 MVP 启用，`top_pages` 与 `acquisition_country` 聚合报表在 Beta 首发。

MVP 提供 typed static config 和紧急 kill switch，用于地图、广告、Affiliate 槽位和供应商总开关；V1 的通用 Feature Flag 平台才提供动态分群、灰度和实验能力。

### 4.1 MVP

- 每小时天气同步、Provider fallback、D1/KV read model 和 stale fallback
- 确定性、可解释、版本化的 Travel Score 与基础主题评分
- Travel Radar：Today、Tomorrow、This Weekend、Next Week
- Weather Explorer 主题：Sunny、Beach、Hiking、Photography、Family、Night View
- 首页、国家页、城市页、搜索，以及 Best Weather、Weekend、Beach、Hiking、Family、Photo 基础排行榜
- English、Japanese、Korean、Simplified Chinese、Traditional Chinese
- Metadata、canonical、hreflang、JSON-LD、sitemap、robots 和 SEO 质量门禁
- Cloudflare Web Analytics
- 由 typed static config 与紧急 kill switch 控制的 Affiliate/广告组件；允许保持关闭
- Cloudflare 免费套餐部署、自动更新、恢复和回滚基础

### 4.2 Beta

- Compare Cities
- Weekend Planner
- 文章系统与 RSS
- Thai、Vietnamese
- 14 天交互时间轴
- Nearby、Similar、Better-weather、Cheaper 推荐
- Admin 只读能力，以及 `top_pages`、`acquisition_country` 增长报表

### 4.3 V1

- Seasonal Travel：Cherry Blossom、Autumn、Snow、Ski、Beach、Rainy Season、Typhoon、Aurora
- 扩展主题：Camping、Shopping、Food、Theme Park、Mountain
- 支持动态分群和灰度的通用 Feature Flag 平台，以及 A/B Test
- 正式 Affiliate 接入和内容运营工具
- Travel News 编辑工作流

### 4.4 V2 / Premium

- Workers AI Travel Match
- 30-Day Outlook/Trend
- 收藏、提醒、账户和 Premium

`Beta` 是 MVP 后的公开验证版本，先于 V1；不是与 MVP/V1 并列的标签。

## 5. 缺口修复设计

### 5.1 商业化

`docs/10-Growth-Bible.md` 建立候选 Adapter 注册表：Google AdSense、Booking、Agoda、Trip.com、Klook、KKday、Expedia、Rentalcars、Airalo 和 Travel Insurance。注册表示意未来可接入，不代表合同已签署、地区可用或必须上线。

每个 Adapter 启用前必须通过：合同和品牌条款、地区可用性、披露和 `rel`、隐私同意、性能预算、安全白名单，以及对应版本可用的开关检查（MVP typed static config/kill switch；V1 起可使用通用 Feature Flag）。

广告位置固定命名为 Homepage、City Page、Article、Sidebar、Between Sections。关闭或无填充时不得保留空白或引起 CLS。

### 5.2 Mountain 与 Theme Park

两者在 V1 使用版本化混合适宜度。先将现有 Travel Score 因子归一化到 `0..100`，再计算：Theme Park 的 `weatherSuitability = rain*0.35 + temperature*0.25 + comfort*0.20 + wind*0.10 + uv*0.10`；Mountain 的 `weatherSuitability = rain*0.30 + temperature*0.15 + comfort*0.10 + wind*0.25 + uv*0.05 + visibility*0.15`。因子按可用权重重新归一，但可用权重低于 0.8 时不计算。

目的地部分要求 `activity_type`、`availability_status`、`source_url`、`verified_at`；季节性活动另要求 `season_start`、`season_end`。`availabilityFactor` 映射为 available=100、limited=60、unavailable/unknown=不可计算；`seasonFactor` 映射为 year-round 或日期在季节内=100、距离季节边界 14 天内=70、季节外=0。`destinationSuitability = availabilityFactor*0.70 + seasonFactor*0.30`。非季节活动的 `seasonFactor` 固定为 100。来源限官方目的地、政府/旅游局或已签约供应商。

`hazardPenalty` 取下列最大值而非相加：风暴/台风有效警报=100；日降水量 >=50mm 或阵风 >=75km/h=60；最高温 >=40°C 或最低温 <=-15°C=40；否则=0。最终 `score = round(clamp(weatherSuitability*0.70 + destinationSuitability*0.30 - hazardPenalty, 0, 100))`。

天气快照不得超过 2 小时，目的地属性验证不得超过 90 天。任一必填字段缺失、来源不合格、状态不可计算，或综合 confidence 低于 0.8 时隐藏分数且不得进入排行榜。实时开放状态只有在授权来源 24 小时内更新时才能展示。模型参数变化必须升级版本并记录 ADR。

### 5.3 渲染策略

唯一的路由渲染矩阵物理存放在 `docs/05-System-Architecture.md`，由 Architecture 拥有 `mode`、`revalidate`、`invalidation`、`fallback` 和 `cache headers`。`docs/03-SEO-Bible.md` 只拥有独立的 indexability/quality-gate 表，并通过 route class 和 Requirement ID 引用渲染矩阵，不复制渲染字段。

默认路由合同如下：

| 路由类别                       | 模式                   | 默认更新/失效                                   | 索引规则                                  |
| ------------------------------ | ---------------------- | ----------------------------------------------- | ----------------------------------------- |
| 方法论、法律、稳定营销页       | SSG                    | 发布时重建                                      | 通过质量门禁后索引                        |
| 首页、国家、城市、天气型排行榜 | ISR                    | 3600 秒；成功同步后按 snapshot version 主动失效 | 通过质量门禁后索引                        |
| Article                        | SSG                    | 发布或编辑时重建                                | 通过审核后索引                            |
| 白名单 Compare（Beta）         | ISR                    | 3600 秒；城市 snapshot 变化时失效               | 仅白名单组合索引                          |
| `/explore`                     | SSR shell + client map | CDN shell；地图读模型按 3600 秒缓存             | shell 可索引，筛选参数 canonical 到稳定页 |
| `/search` 与任意查询结果       | SSR                    | 不持久预渲染                                    | `noindex,follow`                          |
| `/admin`、预览页、`/api/*`     | Dynamic                | 按端点缓存合同                                  | `noindex` 或非 HTML                       |

任何路由偏离默认值都必须在 Architecture 文档中记录理由和验证证据；涉及索引变化时同步更新 SEO 表。

### 5.4 Bot Protection

MVP 必须在应用层实施以下默认分层限流；Cloudflare 原生规则作为可用时的前置增强，不得成为核心防护的唯一依赖：

| 等级 | 范围                    |                    默认每 IP 限制 | 超限动作                    |
| ---- | ----------------------- | --------------------------------: | --------------------------- |
| L1   | 可缓存公开 HTML         | 120 次/分钟，且 30 次/10 秒 burst | `429` + `Retry-After`       |
| L2   | 公开 read API、地图数据 |                        60 次/分钟 | `429` + 短期冷却            |
| L3   | 搜索、比较等高基数端点  |                        30 次/分钟 | `429`；连续超限进入挑战候选 |
| L4   | 内部同步、维护、Admin   |                10 次/分钟并强认证 | 拒绝、审计并记录安全事件    |

同一来源在 5 分钟内达到相应阈值 3 倍，或命中 Cloudflare 可用的自动化/滥用信号时，触发 Managed Challenge（套餐支持时）或延长应用层冷却。缓存键必须使用参数白名单和基数上限。可信 crawler 只能依据 Cloudflare Verified Bots 信号，或反向 DNS 后再正向 DNS 校验；不得仅信任 User-Agent。经过验证的主流搜索引擎访问公开可索引内容时免于交互挑战，但仍受异常流量安全上限保护。

测试至少覆盖阈值边界、窗口重置、伪造 crawler、缓存键放大、认证端点绕过和合法搜索爬虫访问。上线前可依据负载证据调整数值，但调整必须更新 Requirement、测试和 decision log。

### 5.5 Analytics 报表

除事件合同外，明确两项聚合报表：

- `top_pages`（Beta）：按 UTC 自然日聚合；维度为 `route_template:string`、`page_type:enum`、`locale:enum`；指标为 `page_views:nonnegative integer`。查询窗口固定为 7、28、90 天；未知 route 归入 `other`，不得保存原始 query string。
- `acquisition_country`（Beta）：按 UTC 自然日和 `country_code:ISO-3166-1-alpha-2|ZZ` 聚合；指标为 `visits:nonnegative integer` 和 `page_views:nonnegative integer`。只使用 Cloudflare 匿名国家级维度；查询窗口固定为 7、28、90 天，不保存精确位置、IP 或可逆标识符。

MVP 自定义事件共享必填字段：`event_version:integer`、`occurred_at:ISO-8601 UTC string`、`route_template:string`、`locale:enum`。事件白名单如下：

| 事件                                         | 额外必填字段                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `search_submitted`                           | `destination_key:string                                                         | other`、`result_count:nonnegative integer` |
| `search_result_clicked`                      | `destination_id:string`、`result_type:city                                      | country                                    | article`、`position:positive integer` |
| `city_viewed`                                | `city_id:string`、`country_code:string`                                         |
| `country_viewed`                             | `country_code:string`                                                           |
| `ranking_viewed`                             | `theme:enum`、`window:enum`                                                     |
| `ranking_city_clicked`                       | `theme:enum`、`window:enum`、`city_id:string`、`rank:positive integer`          |
| `affiliate_impression` / `affiliate_clicked` | `provider_id:string`、`category:enum`、`placement:enum`、`destination_id:string | null`                                      |
| `ad_impression`                              | `network_id:string`、`placement:enum`                                           |

`destination_key` 只能来自已知城市、国家和别名字典；无法匹配的自由文本统一记为 `other`，不得上传原始搜索词。未知字段必须丢弃，事件版本不受支持时拒绝写入。低于隐私最小计数阈值 10 的国家或目的地聚合并入 `other`。

### 5.6 性能双层门禁

产品目标：代表性页面 Lighthouse Performance、SEO、Accessibility、Best Practices 均为 100。

CI 阻断阈值：

- Performance >= 95
- SEO = 100
- Accessibility = 100
- Best Practices = 100

生产 p75 硬门禁：

- LCP < 2.0s
- CLS < 0.05
- INP < 200ms

CI 使用生产构建，对首页、国家页、城市页、基础排行榜和搜索 shell 各运行 3 次 Lighthouse；采用中端移动设备模拟、4× CPU slowdown、1.6 Mbps 下行、750 Kbps 上行和 150ms RTT。每个页面取 3 次中位数，任一代表页面低于阈值即阻断发布。地图、Analytics 和已启用商业脚本必须采用与生产相同的加载路径；不得通过隐藏内容或跳过生产脚本满足评分。

生产指标来自 Cloudflare Web Analytics 或经隐私审核的等价 RUM，按 route class 计算滚动 28 天 p75；每个 route class 至少 100 个有效样本才执行硬判定，样本不足只报告不阻断。连续 2 个每日评估窗口超标时创建性能事件、暂停新发布并首先关闭可选商业/实验脚本；若能归因于最近一次部署且回退可恢复指标，则回滚该部署。所有阈值、环境和处置由 `ENG-PERF-*` Requirement 固化。

### 5.7 名称和条件化要求

- `30-Day Forecast` 正式迁移为 `30-Day Outlook`，以趋势或概率表示，展示置信度和免责声明。
- Cloudflare Pages 是优先部署路径；若官方 Next.js 适配不兼容，可通过 ADR 和产品确认切换至官方 Workers 部署目标，同时保持全 Cloudflare 免费套餐约束。
- GA4/Plausible 是默认关闭、可完全移除的外部分析 Adapter；“Cloudflare-only”约束适用于核心运行基础设施。

### 5.8 Decision log 与 ADR

每个实施阶段必须记录：决策摘要、验证结果、已知限制和下一步。形成新架构决策或改变既有决策时必须创建或更新 ADR。若没有新 ADR，阶段输出写明 `ADR: none — no new architectural decision`，不得只写 `none`。

## 6. 迁移方案

迁移采用明确的 staging/cutover 协议：

1. 在旧 `SPEC.md` 仍为唯一权威时，先定义文档元数据、ID、引用和校验 schema。
2. 创建领域文档并标记 `Status: Draft / Non-authoritative`；Draft 可临时复制旧合同，但不得被 Agent 或开发者作为实施依据。
3. 补齐第 5 节缺口，建立追踪表；每条来源记录 `weather.txt` 的 SHA-256、固定行号、原文摘要、分类、目标 Requirement ID、coverage 和变更理由；发布归属只能经该 Requirement 的 `roadmap_ref` 解析，不在追踪表重复保存。
4. 预先生成新的 `SPEC.md`、Kiro requirements/design/tasks 和根 README 内容，并在 staging 状态运行全部结构校验；此时旧 SPEC 仍为唯一权威。
5. 执行一个逻辑 cutover 批次：将领域文档改为 `Active`，同时替换 `SPEC.md` 为总纲索引、启用新的 Kiro 派生材料并更新 README。工作区在该批次完成前统一标记 `Migration in progress — do not implement`，任何中间文件状态都不是已发布文档集。
6. 运行完整自动校验和独立语义复核。若失败，恢复旧 SPEC 权威标记并保持新文档为 Draft；不得留下部分启用状态。
7. 校验成功后记录 cutover decision log 和新权威文档集合摘要。

“不得双重权威”适用于 Active/已发布文档集；Draft staging 不具权威性。跨文件合同只通过链接和 Requirement ID 引用。当前不是 Git 仓库，因此原子性指一次受控的逻辑切换与整体验证，而不是 commit 原子性；迁移期间禁止根据工作区文档启动实施。

## 7. 派生 Kiro 规格同步

每个派生文件的第一段必须是单行 JSON HTML comment：

```text
<!-- derived: {"generated_at":"2026-07-17","schema":1,"sources":[{"digest":"sha256:<hex>","ids":["ARCH-DATA-001"],"path":"docs/05-System-Architecture.md"}]} -->
```

序列化规则固定为 UTF-8、JSON key 字典序、`sources` 按 path 排序、`ids` 去重后按 ID 排序、无额外空格；`generated_at` 不参与 digest。每个 requirement block 从 `<!-- requirement` 起，止于下一个 requirement comment 或文件结尾；规范化时将换行转为 LF、删除每行尾随空白、删除首尾空行并补一个结尾 LF。单个 source 的 digest 输入为按 ID 排序后的规范化 block，以 `\n---\n` 连接，再计算 SHA-256。`pnpm docs:check` 按同一算法重算并判定派生文件是否过期。

### 7.1 requirements.md

只包含精简 MVP。每个 Active Hard Requirement 若其 `roadmap_ref` 在 Roadmap 中解析为 MVP，则必须恰好映射一次；每个派生条目必须引用有效源 ID，禁止解析为 Beta/V1/V2 的 ID。Compare、Weekend Planner、文章等从 MVP requirements 移除。派生文本可以重排为 EARS 验收格式，但不得新增或弱化 `must/shall` 合同。

### 7.2 design.md

保留 MVP 的实施设计和关键接口形状。每个 MVP Active Hard Requirement 必须在 design 的至少一个设计单元中被引用，每个设计单元列出其满足的源 Requirement ID；反向不得引用后续版本或无效 ID。架构、数据库、API、性能和安全的正式合同只引用权威文档。设计中的规范性措辞必须能追溯到源 ID，不得创建新的产品义务。

### 7.3 tasks.md

只包含 MVP 实施任务。每个 MVP Active Hard Requirement 必须由至少一个任务覆盖；每个任务声明有效的 MVP 源 Requirement ID、明确的 `Verify:` 命令和预期结果，禁止引用后续版本 ID。只有命令在当前工作区退出码为 0 且记录日期与证据摘要后才能标记完成。当前已有仓库骨架，不能仅凭文件存在更新状态。

Beta/V1/V2 的详细实现任务不迁入 Roadmap，也不保留在当前执行清单；Roadmap 只保留功能 ID、首次发布和阶段门禁。未来进入相应版本规划时再生成独立的非权威实施计划。

## 8. 文档验证

权威要求使用以下可解析格式，字段和值大小写固定：

```markdown
<!-- requirement
id: ENG-PERF-001
status: Active
kind: Hard
roadmap_ref: REL-MVP-001
owner: Engineering
verification: pnpm docs:check
-->

### ENG-PERF-001 — Performance release gate

...

#### Acceptance Criteria

...
```

`status` 允许 `Active|Deprecated|Superseded`，`kind` 允许 `Hard|Guidance`。领域 Requirement 的 `roadmap_ref` 必须指向唯一 `REL-*` 记录；只有该 Roadmap 记录保存 `first_release`（`MVP|Beta|V1|V2`）和 `lifecycle`（`Launch|Continuous`）。引用使用带显式 ID 锚点的 Markdown 链接。追踪表每行固定包含：`source_sha256`、`line_start`、`line_end`、`source_excerpt`、`classification`（`Hard|Suggestion|Example`）、`requirement_id`、`coverage`（`Covered|Changed|Rejected|Needs Decision`）、`rationale`。

统一命令为 `pnpm docs:check`，实现入口为 `tooling/docs/validate-docs.mjs`，只使用 Node.js 内置模块。退出码：`0` 全部通过；`1` 发现文档合同错误；`2` 校验器配置、解析或内部错误。最低检查：

1. 所有权威文档和 ADR 目录存在，cutover 后状态均为 Active。
2. Requirement ID 全局唯一，元数据字段合法，显式锚点和引用目标存在。
3. Markdown 内部文件链接有效。
4. 每个 Active Hard Requirement 有验收标准和唯一有效的 `roadmap_ref`；其 Roadmap 记录具有唯一 first_release 和 lifecycle，不仅限功能需求。
5. `weather.txt` 当前 SHA-256 与追踪表一致；每项 Hard 来源映射到一个 Active Requirement，Suggestion/Example 不冒充硬要求。
6. 完成时 `Needs Decision` 数量必须为 0；`Rejected` 或 `Changed` 必须有 rationale 和批准记录。
7. 同一功能不被分配到多个首次发布版本；Beta 明确位于 MVP 与 V1 之间。
8. 权威正文不残留实际占位符、空章节、旧 SPEC 章节引用或未批准的规范性措辞。
9. 关键修复条款存在：候选 Affiliate、五类广告位置、Mountain/Theme Park、唯一渲染矩阵、Bot Protection、两项 Beta 分析报表、双层性能门禁。
10. Kiro requirements 对所有 MVP Active Hard Requirement 恰好覆盖一次；design 和 tasks 对每个该类 Requirement 至少覆盖一次。三者均不得引用后续版本或无效 ID，派生摘要必须新鲜。
11. 每个已完成 task 都有 `Verify:`、成功证据日期和摘要；不得仅凭文件存在宣称完成。
12. `SPEC.md`、README 和 docs 索引只引用 Active 权威文档，不复制领域合同。

自动校验后执行独立语义复核，重点检查发布范围、权威边界、接口与数据模型、性能门禁和商业化条件。自动与人工复核任一失败，都不得完成 cutover。

## 9. 错误和冲突处理

- 缺失 Requirement ID、断链、重复版本归属或追踪缺口：校验失败，不能合并文档变更。
- 领域文档冲突：以权威边界中的拥有者为准；涉及产品取舍时请求产品负责人裁决。
- ADR 与当前正文冲突：只有状态为 Accepted 且明确声明 supersede 的 ADR 可以触发正文更新；正文未同步前视为迁移未完成。
- 无法证明原始要求是否为硬需求：在追踪表标记 `Needs Decision`、指定产品负责人为 owner，并阻断 cutover；不得静默删除、降级或提升优先级。
- Cloudflare 免费额度或官方适配发生变化：记录证据，更新 Deployment 文档和 ADR，不把瞬时配额硬编码为永久事实。

## 10. 完成标准

本次文档优化仅在以下条件全部满足时完成：

- 目标文档树完整，权威边界明确。
- `SPEC.md` 已成为总纲和索引，不再复制领域合同。
- 唯一发布矩阵符合已批准的精简 MVP。
- 上一轮审计发现的实质缺口均有 Requirement ID、正文和验收标准。
- `weather.txt` 的硬需求具有可审计追踪记录。
- Kiro requirements/design/tasks 与新权威文档及 MVP 范围一致。
- 根 README 指向新的文档入口。
- `pnpm docs:check` 退出码为 0，独立语义复核无未解决问题，追踪表中的 `Needs Decision` 数量为 0。
- 未修改产品代码，未虚假更新任务完成状态。

## 11. 仓库约束

当前 `/root/test/weather` 不是 Git 仓库，无法创建设计提交。本设计文件会写入工作区；后续实施只报告修改和验证结果，不声称已提交。若用户之后初始化或提供 Git 仓库，提交仍需得到明确授权。
