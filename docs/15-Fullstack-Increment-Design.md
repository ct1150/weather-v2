---
title: Fullstack Increment Design — Cloudflare 全家桶（MVP → 全家桶）
authority: Architecture
status: Active
last_updated: 2026-07-21
owner: Architecture (高见远 / Gao)
relation: docs/14-Fullstack-Increment-PRD.md, docs/system_design.md, docs/08-Cloudflare-Deployment.md, docs/06-Database.md, packages/weather/src/provider.ts, workers/weather-sync/src/sync.ts, packages/db/migrations/0001_weather.sql
---

# 增量架构设计 — Cloudflare 全家桶（MVP → 全家桶）

> 本文档是 `docs/14-Fullstack-Increment-PRD.md` 的**架构阶段产出**：实现方案 + 文件清单 + 类图/时序图 + **有序任务列表（给工程师的核心输入）**。
>
> **约束基线**：`DEP-FREE-001`（免费套餐）/ `DEP-PAGES-001`（Pages 优先）/ `DEP-CONFIG-001`（精确词表·密钥走 Secrets）/ `DEP-CICD-001`（预览→迁移→冒烟→晋级）/ `DEP-ROLLBACK-001`（可回滚）。
>
> **已锁定决策（主理人 synthesis，本文沿用不改）**：
>
> 1. 数据源 = **Open-Meteo（免费免密钥）**，新增 `OpenMeteoProvider` 实现现有 `WeatherProvider` 接口，替换 fake；`WEATHER_PRIMARY_PROVIDER=open-meteo` 决定 `weather_snapshots.provider` 列值（`'fake'`→`'open-meteo'`）。
> 2. 域名 = 默认 `*.pages.dev`，不接自定义域名 / 不加 `CLOUDFLARE_ZONE_ID`。
> 3. **前端保持静态导出**（`output:'export'`），`apps/web` 不接 D1/KV 运行时绑定；D1/KV 绑定只进 `workers/weather-sync/wrangler.toml`。实时读 D1 列为 P2，本期不做。
> 4. **KV 最小真实用途**：Worker 写一条"同步健康"记录（last success ts + provider）到 KV（预览/生产隔离）；D1 仍是天气快照真源。KV 命中优先、缺失回退 D1/源。
> 5. **Web Analytics**：`CLOUDFLARE_ANALYTICS_ENABLED` 开关；开启时注入公开 beacon 脚本。`NEXT_PUBLIC_*` 构建期内联；关闭时零集成。
> 6. Cron 每小时、**仅 production 注册**；页面/应用始终读"上一个 active 快照"，新版失败不替换 active（沿用 `sync.ts` 候选门禁 + 栅栏锁 15min TTL）。
> 7. Open-Meteo 字段 **1:1 对应现有 `weather_daily`/`weather_hourly` 列**；**不需要新增 D1 列**；仅 `weather_code`（WMO）需展示/图标语义映射。

---

## 1. 实现方案 + 框架选型

### 1.1 Worker 运行时形态

- **形态**：标准 Cloudflare **Worker**（非 Pages Functions）。入口 `workers/weather-sync/src/index.ts` 在现有 `export * from "./sync.js"` 基础上，增加 `export default { async scheduled(event, env, ctx), async fetch(req, env) }`：
  - `scheduled`：每小时触发，构造 `provider`（依据 `env.WEATHER_PRIMARY_PROVIDER`），调用 `runSync({ db: env.DB, provider, lock: new D1FenceLock(env.DB), config, kv: env.WEATHER_SYNC_KV })`。
  - `fetch`：保留一个**手动触发 / 健康检查**端点（仅用于运维按需触发与 CI 冒烟 Profiling，不做用户读取——满足 PRD-INC-003 "无用户请求期 provider 调用"）。
- **D1 绑定**：`env.DB`（`wrangler.toml` 的 `[[d1_databases]] binding = "DB"`），指向 `database_name = "wnr-weather"`，`migrations_dir = "../../packages/db/migrations"`。`sync.ts` 继续使用 `D1DatabaseLike`（来自 `@wnr/test-utils`）以保持单测可注入；真实 `D1Database` 结构兼容该接口。
- **KV 绑定**：`env.WEATHER_SYNC_KV`（`[[kv_namespaces]] binding = "WEATHER_SYNC_KV"`），预览/生产各一个**隔离命名空间**。
- **Cron**：在 `workers/weather-sync/wrangler.toml` production 环境注册 `crons = ["17 */6 * * *"]`（每 6 小时）；逐小时数据仅保留重点城市未来 48 小时，详见 ADR-001。

### 1.2 Open-Meteo 适配器

- **无 SDK**：直接用全局 `fetch`（Worker 运行时原生支持）。单次 `GET https://api.open-meteo.com/v1/forecast`，`timezone=<city.timezone>`，请求 `daily`/`hourly` 全集（见附录 A）；每城市一次请求，符合免费套餐。
- **归一化 1:1**：`normalizeDaily` / `normalizeHourly` 将 Open-Meteo JSON 映射到现有 `NormalizedDaily`/`NormalizedHourly`（字段名已与 `weather_daily`/`weather_hourly` 列 1:1 对齐）。`sunrise`/`sunset` 由 Open-Meteo 返回的本地 ISO 截断为 `HH:MM` 写入 `sunrise_local`/`sunset_local`（与现有列语义、前端 `weatherSummary.observedAt` 一致）。
- **健壮性**：`AbortController` 超时（默认 10s）+ 单次指数退避重试（≤2 次）。失败抛 `ProviderRequestError`（被 `runSync` 的 per-city try/catch 捕获并写入 `sync_failures`，detail 已 sanitize，不落原始 body）。
- **provider id**：`OpenMeteoProvider.id = "open-meteo"`；`sync.ts` 当前两处硬编码 `'fake'`（`insertRun` / `persistCandidate`）改为 `deps.provider.id`，使 `weather_snapshots.provider` 如实记录。

### 1.3 KV 健康记录（最小真实用途）

- **写入时机**：`runSync` 在 `activate` 成功后、`release` 前，若 `deps.kv` 存在则 `kv.put("sync-health", JSON.stringify({ lastSuccessAt: nowIso, provider: deps.provider.id, status: "ok" }))`。
- **读路径**：本期前端仍读构建期烤数据，**不消费 KV**（满足 Q3 推荐路径）。KV 作为"同步健康"可观测信号，供 owner 在 Cloudflare 控制台 / 未来 Admin 只读视图使用；命中优先、缺失回退 D1/源的逻辑作为**后续 P2（PRD-INC-010）**扩展，本期仅落地写入与冒烟断言。

### 1.4 Web Analytics（前端零集成原则）

- 新建 `apps/web/src/components/CloudflareAnalytics.tsx`：仅当 `process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED === "true"` 且 `process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` 存在时，渲染 Cloudflare Web Analytics beacon `<script>`。否则返回 `null`（**零集成、不进 bundle 逻辑**）。
- 在 `apps/web/src/app/layout.tsx` 挂载该组件（静态导出下脚本在构建期内联）。
- token 是**公开 beacon token**，放在 Pages 公开 env var（非 secret）；组件仅在 enabled 且 token 存在时渲染，关闭时完全不出现。

### 1.5 明确"本期不做什么"

- 不新建 `0002` 迁移；CI **只 apply `0001_weather.sql`**（schema 已含 sync_runs / sync_run_city_scope / sync_failures / sync_locks / feature_flags / analytics_events_daily / active_weather_snapshot.activated_at / weather_snapshots.provider，全部已具备）。
- `apps/web` 不接 D1/KV/运行时绑定，保持 `output:'export'`。
- 不实现 `/api/v1` 路由 handler；不切 Next-on-Pages；前端"数据更新于"时间戳（PRD-INC-008）列为 P2。
- 不引入 `WEATHERAPI_SECRET` / R2 / Durable Objects / Queues。

---

## 2. 文件清单（相对仓库根，新建 / 修改）

**新建**

- `packages/weather/src/open-meteo.ts` — `OpenMeteoProvider`（实现 `WeatherProvider`）+ `createWeatherProvider(name?)` 工厂（按 `WEATHER_PRIMARY_PROVIDER` 选择 `open-meteo` | `fake`）。**并入 `packages/weather`**，不另起包；`index.ts` 已 `export * from "./provider.js"`，需补 `export * from "./open-meteo.js"`。
- `packages/domain/src/weather-code.ts` — 规范化的 **WMO weather_code → {label, icon}** 映射（覆盖 Open-Meteo 完整 WMO 码集 0,1,2,3,45,48,51–67,71–77,80–86,95,96,99）。（_注：PRD 假设该映射在 `packages/domain`，实际现状在 `apps/web/src/build/bake.ts` 的 `conditionLabel`（仅 0..3）。本期新建规范模块并让 `bake.ts` 消费，向前兼容真实 WMO 码。详见 §8 #1。_）
- `workers/weather-sync/wrangler.toml` — `[[d1_databases]]`（DB）、`[[kv_namespaces]]`（WEATHER_SYNC_KV）及仅 production 注册的六小时 `crons`。
- `apps/web/src/components/CloudflareAnalytics.tsx` — Analytics 注入组件（条件渲染）。
- `.env.example` — 增补 `WEATHER_PRIMARY_PROVIDER=open-meteo`、`CLOUDFLARE_ANALYTICS_ENABLED`、`NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`（占位/公开），保留禁用项注释。

**修改**

- `packages/weather/src/index.ts` — 增加 `export * from "./open-meteo.js"`。
- `packages/weather/src/provider.test.ts` — 为 `createWeatherProvider('open-meteo')` 与 `OpenMeteoProvider` 增加单测（用 `globalThis.fetch` mock / 最小 JSON fixture，断言 1:1 归一化与超时/重试）。
- `workers/weather-sync/src/index.ts` — 增加 `scheduled` + `fetch` 默认导出，构造 `provider` 与 `runSync` 依赖（含 D1 fence lock、KV）。
- `workers/weather-sync/src/sync.ts` — ① `SyncDeps` 增加可选 `kv`；② `insertRun` / `persistCandidate` 的 `'fake'` 硬编码改为 `deps.provider.id`；③ `activate` 成功后写 KV `sync-health`。
- `apps/web/src/app/layout.tsx` — 挂载 `<CloudflareAnalytics />`。
- `apps/web/src/build/bake.ts` — `conditionLabel` 改为调用 `packages/domain` 的 WMO 映射（删除本地 0..3 switch）。
- `.github/workflows/deploy.yml` — 增量步骤：preview `d1 migrations apply` → 扩展冒烟 → `wrangler deploy` Worker（preview 无 Cron）→ `pages deploy` → production 晋级（production 注册 Cron）。
- `packages/config/src/runtime-config.ts`（可选增强）— 增加 `WEATHER_PRIMARY_PROVIDER` → `weatherProvider` 启用的文档化解析辅助（见 §7 共享知识）。**不破坏现有 `RuntimeConfig` 形状**，仅补充一个 `resolveProviderName()` 工具函数。

---

## 3. 数据结构与接口（类图，见 `docs/15-class-diagram.mermaid`）

要点（与 §2 文件一一对应）：

- **Provider 端口**：`WeatherProvider`（`id` / `fetchForecast` / `healthCheck`）。`FakeWeatherProvider` 与 `OpenMeteoProvider` 均 `..|>` 实现该接口；`OpenMeteoProvider` 内部 `normalizeDaily`/`normalizeHourly` 产出 `NormalizedDaily`/`NormalizedHourly`（组合关系 1–24）。
- **Worker 运行时**：`WorkerEnv`（DB / WEATHER_SYNC_KV / WEATHER_PRIMARY_PROVIDER）→ 注入 `WeatherSyncWorker`；`runSync` 消费 `SyncDeps`（组合 `WeatherProvider` / `FenceLock` / `RuntimeConfig` / 可选 `KVNamespaceLike`），返回 `SyncReport`。
- **D1 消费**：`SyncDeps ..>` `WeatherSnapshots` / `WeatherDaily` / `WeatherHourly` / `ActiveWeatherSnapshot` / `SyncRuns` / `SyncFailures` / `SyncLocks`，`weather_snapshots.provider` 取 `provider.id`。
- **KV 健康**：`SyncDeps ..> KVHealthRecord`（`put("sync-health")`）。
- **前端分析**：`RootLayout ..> CloudflareAnalytics`（条件渲染）。
- **WMO 映射**：`WeatherCodeMap` 模块，`NormalizedDaily` 的 `weatherCode` 经其得到 label/icon。

---

## 4. 程序调用流程（时序图，见 `docs/15-sequence-diagram.mermaid`）

- **(A) Cron → Open-Meteo → D1 + KV**：Cron（prod 每小时）→ Worker `scheduled` → `createWeatherProvider(env.WEATHER_PRIMARY_PROVIDER)` → `runSync` → 检查 `config.weatherProvider.enabled` → 栅栏锁 acquire（15min TTL，单调 token）→ `readEnabledCities` → 逐城市 `OpenMeteoProvider.fetchForecast`（HTTP GET Open-Meteo）→ 归一化 1:1 → 候选门禁（citiesOk>0 且 featured 全成功）→ `persistCandidate`（provider='open-meteo'）→ `activate`（bootstrap/replace）→ `KV.put("sync-health")` → `release`。失败城市隔离写 `sync_failures`（sanitized）；门禁失败不激活，保留上一 active 快照。
- **(B) deploy.yml 流水线**：install → verify → 静态构建 `out/` → dry-run 门禁 → secret scan → **preview `d1 migrations apply 0001`** → 扩展预览冒烟（KV 命中 + D1 回退 + 无用户期 provider 调用）→ `wrangler deploy --env preview`（无 Cron）→ `pages deploy out`（preview 分支）→ 仅 `main`：**production `d1 migrations apply 0001`** → `wrangler deploy`（production，注册 Cron）→ `pages deploy out`（production）→ production 冒烟。预览/生产绑定与 KV 命名空间隔离。

---

## 5. 有序任务列表（核心交付，供工程师按图施工）

> **任务数 = 5**（满足"≤5、按模块分组"硬上限；将原建议的 6 组压缩为 5：KV（原 T-C）并入 Worker 组 T02，因其写入发生在 Worker 内）。依赖基本并行：T01 ∥ T03 → T02 / T05 → T04。
>
> **全局硬约束（务必遵守）**：**不需要 `0002` 迁移；CI 只 `apply 0001_weather.sql`**。所有 D1 表与列已就位。

### T01 — Open-Meteo Provider 适配器（packages/weather）【P0】

- **模块**：数据接入（PRD-INC-001 / 006）
- **Source files**：`packages/weather/src/open-meteo.ts`（新）、`packages/weather/src/index.ts`（改：增 `export * from "./open-meteo.js"`）、`packages/weather/src/provider.test.ts`（改：增 OpenMeteoProvider 单测）
- **Dependencies**：无
- **验收要点**：
  - `OpenMeteoProvider implements WeatherProvider`，`id === "open-meteo"`。
  - `fetchForecast` 用 `fetch` 调 `api.open-meteo.com/v1/forecast`（`timezone=<city.timezone>`，`daily`/`hourly` 全集见附录 A），无 API key。
  - 归一化结果 1:1 填充 `NormalizedDaily`/`NormalizedHourly`，字段与 `weather_daily`/`weather_hourly` 列对齐；`sunrise_local`/`sunset_local` 为 `HH:MM`。
  - 超时 10s（AbortController）+ ≤2 次退避重试；失败抛 `ProviderRequestError`。
  - `createWeatherProvider(name?)` 工厂：`'open-meteo'`→`OpenMeteoProvider`，否则 `FakeWeatherProvider`（默认 `'fake'`，向后兼容）。
  - 单测用 `fetch` mock + 最小 JSON fixture，断言 1:1 映射、超时、重试、空结果处理。
- **对应 DEP**：DEP-FREE-001（免密钥/免费）、DEP-CONFIG-001（`WEATHER_PRIMARY_PROVIDER` 取值）、DEP-ROLLBACK-001（失败隔离）。

### T02 — weather-sync Worker：绑定 + Cron + KV 健康写入（workers/weather-sync）【P0】

- **模块**：后台同步运行时（PRD-INC-001 / 002 / 005）
- **Source files**：`workers/weather-sync/wrangler.toml`（新）、`workers/weather-sync/src/index.ts`（改：增 `scheduled`+`fetch` 默认导出）、`workers/weather-sync/src/sync.ts`（改：`SyncDeps.kv`、provider 列值 `'fake'`→`deps.provider.id`、KV `sync-health` 写入）、`workers/weather-sync/src/sync.test.ts`（改：增 KV 写入断言）
- **Dependencies**：T01
- **验收要点**：
  - `wrangler.toml`：`name = "wnr-weather-sync"`；D1/KV 保持 preview/prod 隔离；`crons = ["17 */6 * * *"]` 仅在 production 环境声明。
  - `index.ts`：`scheduled(event, env, ctx)` 依据 `env.WEATHER_PRIMARY_PROVIDER` 构造 provider，调用 `runSync({ db: env.DB, provider, lock: new D1FenceLock(env.DB), config, kv: env.WEATHER_SYNC_KV })`；`fetch` 提供手动触发/健康检查（非用户读取路径）。
  - `sync.ts`：`SyncDeps` 增可选 `kv: { put(key, value): Promise<unknown> }`；`insertRun`/`persistCandidate` 的 `'fake'` 改为 `deps.provider.id`；`activate` 成功后 `await deps.kv?.put("sync-health", JSON.stringify({ lastSuccessAt: nowIso, provider: deps.provider.id, status: "ok" }))`。
  - 单测：`runSync` 成功后断言 `kv.put` 被调用且内容为 `{status:"ok", provider:"open-meteo", ...}`；preview 路径（无 KV）不报错。
  - 沿用现有栅栏锁（15min TTL）与候选门禁，失败不替换 active。
- **对应 DEP**：DEP-CONFIG-001（绑定命名/隔离）、DEP-CICD-001（Cron 仅 production）、DEP-ROLLBACK-001（保留上一 active）、DEP-FREE-001（免费绑定集）。

### T03 — Web Analytics 接入（apps/web）【P0】

- **模块**：匿名可观测（PRD-INC-004）
- **Source files**：`apps/web/src/components/CloudflareAnalytics.tsx`（新）、`apps/web/src/app/layout.tsx`（改：挂载组件）、`.env.example`（改：增补分析变量）
- **Dependencies**：无（与 T01 独立并行）
- **验收要点**：
  - `CloudflareAnalytics`：仅当 `process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED === "true"` 且 `process.env.NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` 存在时渲染 beacon `<script src="https://static.cloudflareinsights.com/..." data-cf-beacon='{"token":"..."}'>`；否则返回 `null`（零集成）。
  - `layout.tsx` 在 `<body>` 内挂载；静态导出下脚本构建期内联，不影响天气读取路径。
  - `.env.example` 增补：`CLOUDFLARE_ANALYTICS_ENABLED`、`NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`（公开占位，注释说明非 secret）。
  - 关闭时 `out/` 中**无** analytics 脚本、无 token；secret scan 零命中。
- **对应 DEP**：DEP-FREE-001（不碰 PII/免费套餐）、DEP-CONFIG-001（精确词表 `CLOUDFLARE_ANALYTICS_ENABLED`、公开 token 走 Pages 公开 env var）。

### T04 — CI 流水线增量（.github/workflows/deploy.yml）【P0】

- **模块**：统一部署（PRD-INC-003 / 002）
- **Source files**：`.github/workflows/deploy.yml`（改：增量步骤）
- **Dependencies**：T02、T03
- **验收要点**：
  - 保留现有 verify→build→dry-run→secret-scan→pages deploy 骨架。
  - **新增 preview 步骤**：`wrangler d1 migrations apply wnr-weather --env preview --remote`（仅 apply `0001`）；扩展预览冒烟覆盖 **KV 命中 + D1 回退 + 无用户期 provider 调用**；`wrangler deploy --env preview`（Worker，无 Cron）；`pages deploy out --branch <pr>`。
  - **production 晋级（仅 `push main`）**：`wrangler d1 migrations apply wnr-weather --remote`（production，仅 `0001`）→ `wrangler deploy`（production，注册 Cron）→ `pages deploy out`（production）→ production 冒烟（active 快照新鲜度、Cron 注册）。
  - **预览/生产隔离**：使用 `--env preview` / 默认 production；KV 命名空间与 D1 数据库按环境隔离。
  - 复用同一 `out/` 构建产物（不重建）；`artifactId` 身份契约沿用现有 `tooling/deploy`。
  - 明确注释：**不创建、不 apply 任何 `0002` 迁移**。
- **对应 DEP**：DEP-CICD-001（预览→迁移→冒烟→晋级、Cron 仅 production、产物复用）、DEP-ROLLBACK-001（晋级前冒烟）、DEP-FREE-001。

### T05 — 配置词表 + schema/共享约定 + WMO 映射（config / domain / 共享知识）【P1】

- **模块**：配置与契约（PRD-INC-006；支撑全部）
- **Source files**：`packages/config/src/runtime-config.ts`（改：增 `resolveProviderName()` 辅助，不改 `RuntimeConfig` 形状）、`packages/domain/src/weather-code.ts`（新）、`apps/web/src/build/bake.ts`（改：`conditionLabel` 改用 WMO 映射）、`.env.example`（改：与 T03 协同增补 `WEATHER_PRIMARY_PROVIDER`）
- **Dependencies**：T01（provider id 词汇）、T03（分析变量词汇）
- **验收要点**：
  - `packages/domain/src/weather-code.ts`：导出完整 Open-Meteo **WMO 码集** → `{ label, icon }` 映射；单测覆盖 0/1/2/3/45/48/51–67/71–77/80–86/95/96/99 与未知码降级（默认 Clear）。
  - `bake.ts` 删除本地 `conditionLabel` 0..3 switch，改为 `describeWeatherCode(code)`（来自 `packages/domain`）；前端当前仍经 FakeWeatherProvider（0..3），映射向前兼容真实 WMO 码。
  - `resolveProviderName(raw)`：`'open-meteo'|'fake'|'weatherapi'(disabled)` 合法值解析，未知值拒绝/降级（不隐式启用）。
  - **明确声明**：CI 仅 apply `0001_weather.sql`；**无 `0002` 迁移**；`weather_snapshots.provider` 由 `deps.provider.id` 填充。
  - schema/共享约定测试：env 绑定命名（DB / WEATHER_SYNC_KV）、KV key（`sync-health`）、`WEATHER_PRIMARY_PROVIDER` 取值、provider 列值（`'open-meteo'`）与 `.env.example` 一致。
- **对应 DEP**：DEP-CONFIG-001（精确词表/密钥走 Secrets）、DEP-FREE-001。

---

## 6. 依赖包列表（需新增 / 调整）

| 包                                             | 范围                                   | 建议版本              | 说明                                                                                  |
| ---------------------------------------------- | -------------------------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| `@cloudflare/workers-types`                    | `workers/weather-sync` devDependencies | `^4.2024xxxx`         | 提供 `D1Database` / `KVNamespace` / `ScheduledEvent` 类型；`wrangler` 已在根 devDep。 |
| `wrangler`                                     | 根 devDependencies（已有）             | `^3.90.0`             | `wrangler deploy` / `wrangler d1 migrations apply` / `wrangler kv namespace`。        |
| Open-Meteo SDK                                 | **不引入**                             | —                     | 直接用全局 `fetch`，免密钥、无外网付费。                                              |
| `next` / `react` / `react-dom`                 | `apps/web`（已有）                     | `^14.2.0` / `^18.3.1` | 静态导出不变；Analytics 组件用 React 18。                                             |
| `@wnr/domain` / `@wnr/weather` / `@wnr/config` | workspace（已有）                      | —                     | 新增 WMO 映射模块与 provider 工厂，均在既有包内。                                     |

> 包管理器固定 `pnpm@10.11.0`、Node `>=22`（与根 `package.json` 一致）。Worker 侧**无新增运行时依赖**（仅类型 devDep）。

---

## 7. 共享知识（跨文件约定）

- **env 绑定命名（Worker）**：D1 = `DB`；KV = `WEATHER_SYNC_KV`（preview / production 各一个隔离命名空间，靠 `wrangler.toml` 的 `[env.preview]` / `[env.production]` 中不同的 `id` 区分）。
- **`WEATHER_PRIMARY_PROVIDER` 取值**：`open-meteo`（本期启用）| `fake`（MVP 遗留/调试）| `weatherapi`（保留但本期 disabled，不接 `WEATHERAPI_SECRET`）。决定 `createWeatherProvider()` 的选择与 `weather_snapshots.provider` 列值。
- **provider 列值**：`weather_snapshots.provider = deps.provider.id`（`'open-meteo'` 或 `'fake'`），**不再硬编码 `'fake'`**。
- **KV key 约定**：固定键 `sync-health`，值为 JSON `{ lastSuccessAt: string(ISO), provider: string, status: "ok" }`；因命名空间已按环境隔离，单键即可。
- **Analytics 变量命名**：规范词表名 `CLOUDFLARE_ANALYTICS_ENABLED`（DEP-CONFIG-001）；静态导出须内联，故构建期经 Pages 公开 env var 注入 `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED`（值 `"true"`/`"false"`），beacon token 经 `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`（**公开**，非 secret）。
- **迁移契约**：CI **只 apply `0001_weather.sql`**；**不存在 `0002`**；production startup 不自动迁移（DATA-MIGRATION-001）。
- **Cron 注册**：`crons = ["17 */6 * * *"]` **仅 production**；preview 无 scheduled binding。
- **失败隔离 / 门禁**：沿用 `sync.ts` 候选门禁（citiesOk>0 且 featured 全成功才激活）+ 栅栏锁 15min TTL；新版失败不替换 active，页面始终读上一 active 快照。
- **Secrets 边界**：`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 仅 GitHub Actions Secrets；Analytics token 为公开 beacon，放 Pages 公开 env var；`WEATHERAPI_SECRET` 保持禁用、不写入仓库/构建产物。

---

## 8. 待明确事项（不阻塞主流程，给出推荐）

1. **WMO 映射落脚点**：PRD 假设 `packages/domain` 已有 weather_code→展示映射，但现状映射在 `apps/web/src/build/bake.ts` 的 `conditionLabel`（仅 0..3 三态）。**推荐**：本期新建 `packages/domain/src/weather-code.ts`（完整 WMO 码集），`bake.ts` 改为消费它（向前兼容真实 WMO 码）。前端本期仍经 FakeWeatherProvider（0..3），故属前向兼容，不阻塞。
2. **D1 / KV 资源创建**：`wrangler d1 create wnr-weather`（preview + production）与 `wrangler kv namespace create wnr-weather-sync-{preview,production}` 需在 CI 首次运行前于 Cloudflare 控制台/CLI 创建，并将 id 填入 `wrangler.toml` 的 `[env.*]` 块。**推荐**：在 `deploy.yml` 注释中给出创建命令；首次部署前由 owner 预创建（一次性）。
3. **Open-Meteo 免费额度复核**：本期每城市每次同步 1 次 HTTP 调用、每日 1 次 Cron、城市数受免费套餐约束。DEP-FREE-001 要求在发布前复核当前官方免费配额。`packages/weather` 单测已覆盖归一化，建议补一个"调用次数/批量"断言以防未来每城市多次请求。
4. **Analytics token 获取**：需在 Cloudflare Web Analytics 控制台为 `where-not-rain` 项目启用并复制公开 token，配置为 Pages 公开 env var `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`。关闭 `CLOUDFLARE_ANALYTICS_ENABLED` 时无需 token。
5. **Worker `compatibility_date`**：沿用与 `apps/web/wrangler.toml` 一致的 `compatibility_date = "2025-07-01"`（或更新到当前官方推荐值）；`scheduled`/`fetch` 默认导出为标准 Worker 形态，与现有 `export * from "./sync.js"` 共存。

---

## 附录 A：Open-Meteo 请求参数（1:1 字段）

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=<lat>&longitude=<lng>
  &timezone=<city.timezone>
  &forecast_days=<N>&start_date=<YYYY-MM-DD>&end_date=<YYYY-MM-DD>
  &daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,
         apparent_temperature_min,precipitation_sum,precipitation_probability_max,
         relative_humidity_2m_mean,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,
         cloud_cover_mean,visibility_mean,sunrise,sunset
  &hourly=weather_code,temperature_2m,apparent_temperature,precipitation,
          precipitation_probability,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,
          uv_index,cloud_cover,visibility
```

字段→列映射见 `docs/14-Fullstack-Increment-PRD.md` 附录 A（已 1:1 覆盖，无新增列）。

---

## 附录 B：约束符合性对照（增量）

| 约束             | 本设计如何满足                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEP-FREE-001     | Open-Meteo 免密钥、Worker/D1/KV/Analytics 均免费套餐兼容；Analytics 公开 token 不碰 PII；无 R2/DO/Queues。                                                    |
| DEP-PAGES-001    | Pages 仍是主交付（`output:'export'`）；Worker 仅作互补后台，不替代 Pages；Cron 仅 production。                                                                |
| DEP-CONFIG-001   | 精确词表 `WEATHER_PRIMARY_PROVIDER`/`CLOUDFLARE_ANALYTICS_ENABLED`；KV/D1 绑定命名隔离；secret 走 GitHub Secrets/公开 env var；`.env.example` 无真实 secret。 |
| DEP-CICD-001     | 预览→`d1 migrations apply 0001`→扩展冒烟（KV 命中/D1 回退/无用户期 provider 调用）→Worker 部署→Pages 部署→production 晋级；Cron 仅 production；产物复用。     |
| DEP-ROLLBACK-001 | 迁移仅 `0001`、向后兼容；候选门禁 + 栅栏锁保留上一 active 快照；Cron/Analytics 可独立禁用；失败不发布 pending 候选。                                          |
