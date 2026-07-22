---
title: Fullstack Increment PRD — Cloudflare 全家桶
authority: Product
status: Active
last_updated: 2026-07-21
scope: Incremental — extends docs/01-Product-PRD.md (MVP) and docs/08-Cloudflare-Deployment.md
owner: Product (许清楚 / Xu)
relation: docs/system_design.md, packages/db/migrations/0001_weather.sql, workers/weather-sync/src/sync.ts, apps/web/wrangler.toml, .github/workflows/deploy.yml
---

# 增量 PRD — Cloudflare 全家桶（MVP → 全家桶）

> **本文只描述变更部分。** MVP 基线（Pages 静态导出 + 构建期 `FakeWeatherProvider` 烤数据）见 `docs/01-Product-PRD.md`、`docs/system_design.md`。本增量把核心从"纯静态导出"升级为 **Cloudflare 全家桶**：Pages（已有）+ `weather-sync` Worker（Cron 每小时同步）+ D1（绑定 + CI 迁移 apply）+ KV（按需）+ Cloudflare Web Analytics。
>
> **不可变约束**：`weather.txt` 是 SPEC 提示词 / 审计基线（SHA 锁定），**不得改动、不得作为天气数据源**，本增量不涉及它。
> **已锁定决策**：数据源 = Open-Meteo（免费、免密钥）；域名 = 默认 `*.pages.dev`（不接自定义域名 / `CLOUDFLARE_ZONE_ID`）；不启用 Weatherapi（`WEATHERAPI_SECRET` 保持可选/禁用）。

## 1. 产品目标（本次增量）

| #   | 目标                                                                                                                                              | 正交性说明                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| G1  | **真实天气后台定时入湖** — 后台每小时通过 `weather-sync` Worker 抓取 Open-Meteo（免密钥）并写入 D1，无需人工干预即可持续刷新天气基线。            | 与"前端展示"正交：仅解决数据来源从"构建期合成"变为"运行时真实同步"，不改变页面契约。 |
| G2  | **数据层可演进、可回滚** — D1 绑定 + 迁移按预览先行→生产晋级的顺序 apply；迁移可加、向后兼容，Cron 可独立禁用。                                   | 与"功能"正交：仅保障部署/数据契约的安全与可逆，不新增用户可见能力。                  |
| G3  | **全家桶统一部署 + 匿名可观测** — Pages 与 Worker 同流水线部署；Cloudflare Web Analytics 仅在配置开启时采集匿名访问，不落地 PII、不触碰免费套餐。 | 与"数据正确性"正交：仅解决交付与观测，不影响天气计算。                               |

## 2. 用户故事地图（Mermaid）

```mermaid
flowchart TD
  subgraph Persona1[Owner / 运维视角]
    A1[每小时自动同步真实天气到 D1] --> A2[D1 持久化快照且迁移可回滚]
    A2 --> A3[预览先 apply 迁移+冒烟再晋级生产]
    A3 --> A4[Web Analytics 看匿名流量趋势]
    A1 --> A5[Worker 失败/锁冲突可观测、可独立禁用 Cron]
  end
  subgraph Persona2[系统能力视角]
    B1[Worker Cron 每小时] --> B2[Open-Meteo 免密钥抓取]
    B2 --> B3[归一化后写入 D1 快照]
    B3 --> B4[激活指针 bootstrap/replace 契约]
    B3 --> B5[KV 缓存命中, 缺失回退源]
  end
  subgraph Persona3[终端用户视角 — 条件性]
    C1[看到"数据更新于 X 前" — 仅当读取路径改读 D1 时]
  end
  A3 -.->|复用 0001_weather.sql| B3
  A4 -.->|CLOUDFLARE_ANALYTICS_ENABLED| B1
```

### 用户故事（覆盖关键场景）

| ID   | 角色             | 故事                                                                                                               | 对应目标           |
| ---- | ---------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------ |
| US-1 | Owner            | 作为运维，我希望后台每小时自动抓取真实天气并写入 D1，这样站点在无人干预下保持最新天气基线。                        | G1                 |
| US-2 | Owner            | 作为 owner，我希望 D1 持久化天气快照且迁移可回滚，这样数据层升级不会破坏已发布页面。                               | G2                 |
| US-3 | Owner            | 作为 owner，我希望预览环境先 apply 迁移 + 冒烟再晋级生产，并且 Cron 注册每小时同步，这样发布安全可证。             | G2, G3             |
| US-4 | Owner            | 作为 owner，我希望 Web Analytics 自动采集匿名访问量，这样我能观测流量趋势而不触碰 PII 或破坏免费套餐。             | G3                 |
| US-5 | 系统             | 作为系统，我希望 KV 命中缓存并在缺失时回退到源，这样降低重复抓取/读取成本。                                        | G1, G3             |
| US-6 | 前端用户（条件） | 作为用户，我希望看到"数据更新于 X 前"（当读取路径改读 D1 时），这样我能判断数据新鲜度。                            | G1（依赖 §5 决策） |
| US-7 | Owner            | 作为 owner，我希望 Admin 只读展示最近同步状态与快照时间（`PRD-FR-012` 扩展），这样我能不进数据库就掌握后台健康度。 | G1, G2             |

## 3. 需求池（增量；每条标注对应 DEP-* 约束）

> 约定：P0 = 必须（本增量上线门槛）；P1 = 应该；P2 = 可选/后续。DEP-* 引用 `docs/08`。

### P0 — 上线门槛

| ID          | 需求                                                                                                                                                                                                                            | 验收要点                                                                                                                                                                                                         | 对应约束                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| PRD-INC-001 | **定时真实天气同步（weather-sync Worker）** — 新增 `OpenMeteoProvider`（免密钥）替代 `FakeWeatherProvider`；Cron 每小时触发 `runSync`，复用 `sync.ts` 的栅栏锁 + bootstrap/replace 契约写入 D1。                                | 每小时成功产出 1 个 active 快照；provider 标识为 `open-meteo`；无密钥、无外网付费；失败城市隔离并记录 `sync_failures`（已 sanitize）。                                                                           | DEP-FREE-001, DEP-PAGES-001, DEP-CICD-001, DEP-ROLLBACK-001 |
| PRD-INC-002 | **D1 持久化天气快照** — `workers/weather-sync/wrangler.toml` 新增 `[[d1_databases]]`（binding `DB`，`database_name = "wnr-weather"`，`migrations_dir` 指向 `packages/db/migrations`），CI 执行 `wrangler d1 migrations apply`。 | 复用 `0001_weather.sql` 全量 schema；迁移可加、向后兼容；预览先 apply + 冒烟再晋级；不破坏已发布页面。                                                                                                           | DEP-CICD-001, DEP-ROLLBACK-001, DEP-FREE-001                |
| PRD-INC-003 | **全家桶统一部署** — 扩展 `deploy.yml` 在部署 Pages 之外，部署 `weather-sync` Worker 并注册 Cron（每小时）。                                                                                                                    | Pages 与 Worker 同流水线、同 artifact 身份契约（fail-closed）；Cron 仅在 production 注册（预览无 scheduled binding，见 `wrangler.toml` 注释）；preview 冒烟覆盖 KV 命中 + D1 回退 + 无用户请求期 provider 调用。 | DEP-CICD-001, DEP-PAGES-001                                 |
| PRD-INC-004 | **Cloudflare Web Analytics 接入** — 新增配置 `CLOUDFLARE_ANALYTICS_ENABLED`；开启时注入 Analytics 脚本，**用户不可见**。                                                                                                        | 仅匿名聚合（无 cookie / 无 PII / 不进 D1 `analytics_events_daily` 个人字段）；关闭时零集成；不影响天气读取路径与免费套餐。                                                                                       | DEP-FREE-001, DEP-CONFIG-001                                |

### P1 — 应该

| ID          | 需求                                                                                                                                                                                               | 验收要点                                                                                        | 对应约束                       |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ |
| PRD-INC-005 | **KV 缓存 / 特性开关（按需）** — 新增 KV 命名空间绑定（预览/生产隔离）；候选用途：地理/天气缓存或 feature flag。                                                                                   | 命中优先、缺失回退源（D1 / provider）；无密钥泄露；具体用途需 §5 拍板。                         | DEP-FREE-001, DEP-CONFIG-001   |
| PRD-INC-006 | **预览/生产隔离配置 + 精确词表** — 新增 `WEATHER_PRIMARY_PROVIDER=open-meteo`；`WEATHER_FALLBACK_PROVIDER` 保持可选；`WEATHERAPI_SECRET` 继续可选禁用；预览/生产使用隔离 D1/KV binding 与 secret。 | 满足 `DEP-CONFIG-001` 精确词表与密钥走 Secrets；schema 测试覆盖新名称；未知名称不隐式启用能力。 | DEP-CONFIG-001, DEP-FREE-001   |
| PRD-INC-007 | **Admin 只读同步状态（扩展 `PRD-FR-012`）** — 从 D1 读最近 `sync_runs` / `active_weather_snapshot.activated_at` 供 owner 查看，对终端用户关闭。                                                    | 只读、无 mutation；不暴露 secret / 原始 provider body；未授权请求不泄露内部实现。               | DEP-FREE-001, DEP-ROLLBACK-001 |

### P2 — 可选 / 后续

| ID          | 需求                                                                                                                                                   | 验收要点                                                                            | 对应约束      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------- |
| PRD-INC-008 | **前端"数据更新于"时间戳** — 当读取路径改读 D1 活跃快照时，从 `active_weather_snapshot.activated_at` / `weather_snapshots.fetched_at` 派生新鲜度标签。 | 依赖 §5 读取路径决策；stale 阈值沿用 `WEATHER_DATA_MAX_AGE_MINUTES`；从不声称实时。 | DEP-PAGES-001 |
| PRD-INC-009 | **前端请求期实时读取 D1** — 切换 `apps/web` 到 `@cloudflare/next-on-pages` + D1 绑定（触发条件见 `docs/system_design.md §1.3`）。                      | 仅在引入 /api/v1、SSR/ISR、或 D1 读取时执行；本期**不执行**。                       | DEP-PAGES-001 |
| PRD-INC-010 | **KV 地理/天气缓存命中与回退可观测** — 度量命中率/回退率供 owner 调优。                                                                                | 仅聚合计数，无 PII；与 `PRD-INC-005` 协同。                                         | DEP-FREE-001  |

## 4. UI / 可观测性说明

- **Cloudflare Web Analytics（PRD-INC-004）**：对用户**完全不可见**，不渲染任何 UI、不写入 Cookie、不注入前端可读标识。仅 owner 在 Cloudflare 控制台查看匿名流量/性能趋势。
- **weather-sync Worker / D1 / KV**：均为**后端能力**，不向终端用户暴露控制面或实现字段（遵循 `PRD-FR-011` "不暴露 provider 实现字段"）。
- **前端"数据更新于"时间戳（PRD-INC-008）**：**仅在 §5 读取路径决策选择"改读 D1"后出现**；MVP 期页面数据仍是构建期烤入的静态快照，时间戳同源烤入（`dataUpdatedAt`）。若保持静态导出，则 `weather.txt`/D1 快照时间**不回灌**到前端，避免误导为实时。
- **Admin（PRD-INC-007）**：复用 `PRD-FR-012` 的禁用-by-default + 只读 + 鉴权契约，仅新增"天气同步状态/快照时间"视图，非核心用户体验。

## 5. 待确认问题（Open Questions）

| #   | 问题                                                         | 影响                                                                      | 建议/现状                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | **Open-Meteo 字段 → 现有 Travel Score 映射是否需要新字段？** | 决定 `OpenMeteoProvider` 归一化层与是否需要 D1 迁移新增列。               | 现有 `NormalizedDaily`/`NormalizedHourly` 与 `weather_daily`/`weather_hourly` 列**已 1:1 覆盖** Open-Meteo 免费 daily/hourly 变量（见附录映射表）。**暂不需要新字段**；唯一需确认的是 `weather_code`（WMO 编码）到现有展示/图标语义的映射。                                                                                  |
| Q2  | **KV 的具体用途是否确认？**                                  | 决定 `PRD-INC-005` 范围与绑定数量。                                       | 候选：(a) 地理/天气读取缓存（降 D1 读压）；(b) feature flag 存储。本期建议先落 (b) 或留空绑定，待读取路径（Q3）拍板后再扩 (a)。                                                                                                                                                                                              |
| Q3  | **前端读取路径：继续用构建期烤数据，还是改读 D1？**          | 决定 `PRD-INC-008/009` 是否本期执行，以及是否触发 Next-on-Pages 切换。    | **推荐（增量最小正确路径）**：本期保持 Pages 静态导出 + 构建期烤数据作为页面数据源；D1/Worker/KV/Analytics 作为**增量后端能力**叠加，不直接驱动页面读取。理由：契合 `DEP-PAGES-001`（Pages 优先、Worker 仅作互补后台）、保护免费套餐、避免引入 `/api/v1` 或 SSR。实时读 D1 列为 P2（触发 `system_design §1.3` 条件时再切）。 |
| Q4  | **provider 标识与配置联动**                                  | 影响 `sync.ts` 中快照/run 的 `provider` 列（`'fake'` → `'open-meteo'`）。 | 现有桩写死 `'fake'`；新适配器应读 `WEATHER_PRIMARY_PROVIDER` 决定 `provider` 列值与 health-check 标识。属工程细节，需随 `PRD-INC-001` 一并调整。                                                                                                                                                                             |
| Q5  | **Cron 重叠/失败对页面影响**                                 | 影响 `DEP-ROLLBACK-001` 的"保留上一个 active 快照"。                      | 沿用 `sync.ts` 候选门禁（featured 失败则不完全激活）+ 栅栏锁（15min TTL，重叠保护）；页面（无论静态或实时）始终读"上一个 active 快照"，新版失败不影响已发布数据。                                                                                                                                                            |

## 附录 A：Open-Meteo 免费变量 → 现有 D1 列映射（供 Q1 参考）

| Open-Meteo 字段（免费）         | `weather_daily` / `weather_hourly` 列 | 单位一致性               |
| ------------------------------- | ------------------------------------- | ------------------------ |
| `weather_code`                  | `weather_code`                        | WMO 编码，需映射展示语义 |
| `temperature_2m_max/min`        | `temp_max_c` / `temp_min_c`           | °C ✓                     |
| `apparent_temperature_max/min`  | `apparent_max_c` / `apparent_min_c`   | °C ✓                     |
| `precipitation_sum`             | `precipitation_mm`                    | mm ✓                     |
| `precipitation_probability_max` | `precipitation_probability_max`       | % ✓                      |
| `relative_humidity_2m_mean`     | `humidity_mean`                       | % ✓                      |
| `wind_speed_10m_max`            | `wind_speed_max_kph`                  | km/h ✓                   |
| `wind_gusts_10m_max`            | `wind_gust_max_kph`                   | km/h ✓                   |
| `uv_index_max`                  | `uv_index_max`                        | 指数 ✓                   |
| `cloud_cover_mean`              | `cloud_cover_mean`                    | % ✓                      |
| `visibility_mean`               | `visibility_mean_m`                   | m ✓                      |
| `sunrise` / `sunset`            | `sunrise_local` / `sunset_local`      | 城市本地时间 ✓           |

> 结论：归一化层可直接填充现有 `NormalizedDaily`/`NormalizedHourly`，**无需新增 D1 列**；Travel Score 内核（`packages/domain`）消费列不变。

## 附录 B：约束符合性对照（增量部分）

| 约束                                | 本增量如何满足                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DEP-FREE-001（免费套餐）            | Open-Meteo 免密钥、Worker/D1/KV/Analytics 均免费套餐兼容；GA4/Plausible 仍禁用；移除可选集成核心仍可用。                                                                       |
| DEP-PAGES-001（Pages 优先）         | Pages 仍是主交付；Worker 仅作互补同步后台，不替代 Pages；Next-on-Pages 切换条件严格受限（§1.3 / Q3）。                                                                         |
| DEP-CONFIG-001（精确词表/密钥）     | 新增 `WEATHER_PRIMARY_PROVIDER=open-meteo`、`CLOUDFLARE_ANALYTICS_ENABLED`；密钥走 Cloudflare Secrets；预览/生产隔离；schema 测试覆盖。                                        |
| DEP-CICD-001（预览→迁移→冒烟→晋级） | 扩展 `deploy.yml` 同时部署 Pages+Worker；预览先 `wrangler d1 migrations apply` + 冒烟（含 KV 命中/D1 回退/无用户期 provider 调用）再晋级；Cron 仅生产注册；artifact 身份复用。 |
| DEP-ROLLBACK-001（可回滚）          | 迁移可加、向后兼容；上版应用兼容当前 schema；Cron/集成可独立禁用；保留上一个 active 快照与 last-known-good 读模型。                                                            |
