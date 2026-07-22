# WNR 部署就绪增量 — 系统设计与任务分解

- **文档类型**：SOP 架构阶段产出（部署架构设计 + 任务分解）
- **架构师**：高见远（Gao / software-architect）
- **日期**：2026-07-21
- **目标**：把 `apps/web` 变成"可真实部署"的状态并落到 Cloudflare 免费套餐；本期是**部署就绪增量**，不是从零做产品。
- **遵循约束**：`docs/08` 的 DEP-FREE-001（免费套餐兼容）、DEP-PAGES-001（Pages 优先）、DEP-CICD-001（门禁/迁移显式/fail-closed 晋升/产物复用）、DEP-CONFIG-001（配置词表 + 密钥走 Secrets）。
- **已与用户确认的方案决策（默认）**：方案 A（GitHub Actions 编排构建 + 跑 `tooling/deploy` 门禁 + `wrangler pages deploy` 真实上传）；触发策略 `main`→production、`PR`→preview；Pages 项目名 `where-not-rain`；保留 `tooling/deploy/*.mjs` dry-run 门禁。

---

## 0. 已核实的仓库真实状态（决策依据）

> 以下均为读源码/配置核实结论，是本次设计的事实基础。与"团队 lead 审计结论"一致并补充细节。

1. **`apps/web` 是纯 UI 库，没有任何运行时数据通路。**
   - `apps/web/package.json` 的 `build` = `tsc -p tsconfig.json`（仅类型检查，从不产出 `out/` 或任何可部署产物）。
   - 依赖里**完全没有 `next` / `wrangler` / `@cloudflare/*`**。
   - 全仓 grep 确认 `apps/web` 内**无** `getStaticProps` / `generateStaticParams` / `getServerSideProps` / `readFileSync` / `weather.txt` / `wrangler` / `@cloudflare/next-on-pages` / `next` import / D1 / KV / route handler。
   - `apps/web/src/app/*/page.tsx` 都是**纯展示组件**：导出 `TravelRadarPageProps` 等接口，组件以 `viewModel` 作为 props，**没有任何数据加载器把 viewModel 喂给它**。
   - `apps/web/src/api/v1/schemas.ts` 是**纯类型 + 校验 + 信封构造**（`node:crypto` 仅用于哈希/UUID，无任何 D1/KV/provider 访问）；仓库内**没有任何 `route.ts`**，即 `/api/v1` 当前没有真实路由实现。
   - `apps/web/tsconfig.json` **已 extends `@wnr/tsconfig/nextjs.json`**（Next 取向），只差真正的 `next build`。
   - 无 `apps/web/next.config.*`、无 `apps/web/public/` 目录。

2. **`weather.txt` 是 SPEC 提示词（审计基线），不是天气数据文件。**
   - 内容为 `# ROLE You are a Staff-level Full Stack Engineer...`，即项目初始需求 prompt；`SPEC.md` 第 11/19/86 行、`docs/13` 等明确其为"cutover 后的不可变历史输入/审计基线，不再是实施依据"。
   - 仓库内**不存在任何城市天气/地理种子数据集**。

3. **天气与分数的"可构建期合成器"已存在：**
   - `packages/weather` 的 `FakeWeatherProvider`（`fetchForecast`）是**确定性、网络无关**的 MVP FAKE 适配器，按 `(cityId,date,hour)` 合成归一化天气 → 可直接在构建期使用，无需密钥、无外网。
   - `packages/domain` 导出 `travel-score`（纯函数）→ 可在构建期由天气计算 Travel Score。

4. **`packages/db` 与 `workers/*` 是运行时层，本期不可用：**
   - `packages/db/geography-repository.ts` 依赖 `D1DatabaseLike`（D1 运行时），**不能用于构建期烘焙**；`apps/web` 需自带地理种子。
   - `workers/weather-sync` / `workers/maintenance` 是 Cron 驱动的 D1 写入者，**没有 wrangler 配置、没有 D1 绑定**，且 `ARCH-LAYERS-001` 规定 `apps/web` 不得 import `packages/weather`/worker。本期不可部署。
   - `packages/db/migrations/0001_weather.sql` 存在，但 `wrangler.toml` 无 `[[d1_databases]]`，也无任何 `wrangler d1` 步骤。

5. **`tooling/deploy/*.mjs` 是自包含 dry-run 门禁**（注释明确 "No real Cloudflare API is ever contacted"）。
   - `build-immutable-artifact.mjs` 的 `ARTIFACT_SURFACE = ["src","package.json","tsconfig.json","vitest.config.ts","wrangler.toml"]` —— **不含 `next.config.mjs`，也不含 `out/`/`public/`**。需更新以覆盖 Next 静态导出产物。

---

## 1. 实现方案 + 框架选型

### 1.1 决策：本期把 `apps/web` 以 **静态导出（`output: 'export'`）** 部署到 **Cloudflare Pages**

- 天气 + Travel Score 在**构建期**由 `FakeWeatherProvider` + `travel-score` 合成并**烤入静态 HTML**；无请求期运行时、无 D1/KV/Cron、无 Workers、无 `@cloudflare/next-on-pages`。
- 部署命令：`wrangler pages deploy out --project-name where-not-rain`（`pages_build_output_dir` 维持 `"out"`，与现有 `wrangler.toml` 一致）。

### 1.2 为什么不是 Next-on-Pages（证据驱动）

团队 lead 给定的回退条件："若核查代码后发现本应用实际没有运行时 D1/SSR/route-handler 需求（例如天气数据在构建时从 weather.txt 烤入静态页），则可回退到静态导出"。**审计结论正是如此**：

- 没有任何 `getServerSideProps` / `generateStaticParams` / route handler / D1 / KV 访问（见 §0.1）。
- 页面是纯组件、`/api/v1` 无实现、`weather.txt` 非数据 → 没有"请求期"可言。
- 因此静态导出不是"退而求其次"，而是**证据强制的最简正确路径**。

### 1.3 回退/切换条件（何时改回 Next-on-Pages）

仅在以下任一进入本期范围时，才切到 `@cloudflare/next-on-pages` 并相应调整：
- 引入真实 `/api/v1` route handler（动态信封、D1 读取）；
- 引入 SSR（如 `/explore` 服务端渲染或 `/search` 真 SSR）；
- 引入 ISR（`revalidate` 按 snapshot 失效）；
- `apps/web` 需要 D1/KV 绑定。

切换动作（届时）：安装 `@cloudflare/next-on-pages`；`next build` 改为经 `npx @cloudflare/next-on-pages`（或在 `next.config` 启用）；`wrangler.toml` 的 `pages_build_output_dir` 改 `.vercel/output/static`；绑定 D1/KV。本期**不执行**这些。

### 1.4 构建期数据来源（关键新增工作）

1. **地理种子（新建）**：`apps/web/src/build/geography.seed.ts` 提供 `countries` / `cities`（含 `id, countryId, slug, latitude, longitude, timezone, isFeatured, 多语言 name`）。仓库内无现成数据，必须新建（范围见 §8 待明确 #3）。
2. **天气合成**：用 `FakeWeatherProvider.fetchForecast({cityId, latitude, longitude, timezone, days:7, startDate})` 对每座城市合成 7 天天气（确定性、无网络、无密钥）。
3. **分数计算**：用 `packages/domain` 的 `travel-score` 由合成天气算出 `CityScore`。
4. **投影成 ViewModel**：`BakePipeline.bake(seed, config)` 产出 `BakedDataset`，再投影为 `TravelRadarViewModel` / `CountryPageViewModel` / `CityPageViewModel` / `ExplorerViewModel`（类型已存在于 `apps/web/src/app/view-models.ts`）。
5. **页面接线**：App Router 页面模块在构建期用 `generateStaticParams` + `params`/`searchParams` 从 `BakedDataset` 计算 `viewModel` 传给现有纯组件。

> 说明：`FakeWeatherProvider` 是"假"数据（确定性合成，非真实天气）。本期静态导出以此保证"无网络、无密钥、免费套餐"。真实天气走后续 `workers/weather-sync` + D1 增量（见 §8 #2/#4）。

### 1.5 本期范围边界（明确"不做什么"）

- **不部署** `workers/weather-sync` / `workers/maintenance`（无 D1 绑定、无 worker wrangler 配置、ARCH-LAYERS-001 隔离）→ 留待 worker 增量。
- **不迁移/不绑定 D1/KV/Cron** 本期（无消费者、无绑定配置）→ D1 迁移步骤在 CI 中**休眠**（提供命令与绑定位置，见 §7 / §8 #1）。
- **不实现** `/api/v1` 路由 handler（无 route.ts）；`/explore` 沿用现有"静态壳 + 装饰 SVG 地图"（已满足 UX-A11Y-001，无外网地图脚本）。

---

## 2. 文件清单（相对仓库根，新建/修改）

**新建**
- `apps/web/next.config.mjs` — `output:'export'` + `images.unoptimized:true` 等静态导出配置。
- `apps/web/src/build/types.ts` — 烘焙层内部类型（`GeographySeed`/`CitySeed`/`BakedDataset`）。
- `apps/web/src/build/geography.seed.ts` — 地理种子（countries/cities）。
- `apps/web/src/build/bake.ts` — `BakePipeline`：聚合 FakeWeatherProvider + travel-score → BakedDataset → ViewModel。
- `apps/web/src/app/layout.tsx` — App Router 根布局（html/body、字体、全局样式、metadata）。
- `apps/web/public/robots.txt`、`apps/web/public/favicon.ico`（及必要静态资源）。
- `.env.example` — 构建期变量占位 + 文档化但本期禁用的 `WEATHER_*` 等（无真实 secret）。
- `.github/workflows/deploy.yml` — 完整 CI/CD 流水线（verify→build→gates→security→deploy）。

**修改**
- `package.json`（根）— `devDependencies` 加 `wrangler`；`scripts` 可选加 `deploy:preview`/`deploy:prod` 便捷脚本。
- `apps/web/package.json` — `dependencies` 加 `next`；`scripts.build` 改 `next build`，保留/加 `dev`/`typecheck`/`start`。
- `apps/web/tsconfig.json` — 核对/补齐 Next 必需项（见 §7）。
- `apps/web/src/app/page.tsx`、`[countrySlug]/page.tsx`、`[countrySlug]/[citySlug]/page.tsx`、`explore/page.tsx` — 由"纯组件"改造为 App Router 页面模块（读烘焙数据 + params/searchParams → 算 viewModel）。
- `apps/web/wrangler.toml` — 维持 `pages_build_output_dir="out"` 与 env vars；注明本期无 D1 绑定（未来绑定位置见 §7）。
- `tooling/deploy/build-immutable-artifact.mjs` — `ARTIFACT_SURFACE` 加入 `next.config.mjs`、`public`（如有），确保 artifact 含 Next 配置。
- `tooling/deploy/preview-smoke.mjs`（如需）— 适配静态 `out/`（无 D1/KV 断言）。
- `docs/08-Cloudflare-Deployment.md`、`docs/05-System-Architecture.md` — 补充"本期实际采用静态导出"及回退条件、本期静态子集标注。
- `.gitignore` — 确保 `.wrangler/`、`out/`、`.env` 已被忽略（现状已忽略 `out/.wrangler/.env`，核对即可）。

---

## 3. 数据结构与接口（Mermaid 类图）

完整类图见 **`docs/class-diagram.mermaid`**（构建期数据模型 + BuildConfig + CI 产物 + 延迟的 D1 schema）。

要点：
- **构建期数据模型**：`GeographySeed`(1—* `CountrySeed` / `CitySeed`) → `BakePipeline` 依赖 `FakeWeatherProvider`（合成天气）与 `TravelScoreEngine`（算分）→ 产出 `BakedDataset`（按 cityId 索引的天气/分数 + `dataUpdatedAt`）→ 投影为 4 个 `*ViewModel`。
- **BuildConfig**（DEP-CONFIG-001 子集，构建期生效）：`APP_ENV` / `APP_BASE_URL` / `DEFAULT_LOCALE` / `SUPPORTED_LOCALES` / `WEATHER_DATA_MAX_AGE_MINUTES`。
- **PipelineArtifact**：`artifactId` / `artifactDir` / `environment` —— 由 `build-immutable-artifact.mjs` 计算，并被后续 `deploy-preview`/`promotion-dry-run` 复用（fail-closed 身份校验）。
- **D1Schema（DEFERRED）**：`countries/cities/weather_snapshots/active_weather_snapshot/weather_daily/weather_hourly/city_scores/ranking_snapshots/sync_locks/sync_runs` —— 来自 `0001_weather.sql`，本期不部署，供 worker 增量消费。

---

## 4. 程序调用流程（Mermaid 时序图）

完整时序图见 **`docs/sequence-diagram.mermaid`**。

要点（`git push main` 与 PR 两条路径）：
1. `git push main` → Actions：`pnpm install` → verify（format/lint/typecheck/test/docs） → `pnpm --filter @wnr/web build`（`next build` → `out/`）→ `build-immutable-artifact`（算 `artifactId`）→ dry-run gates（`deploy-preview` / `verify-preview-repositories` / `preview-smoke` / `promotion-dry-run`，**绝不调用 Cloudflare API**）→ secret-scan → `wrangler pages deploy out --project-name where-not-rain` 真实上传（**复用同一 `out/` 与 `artifactId`**）。
2. PR → 同样 build+gates，但 `wrangler pages deploy out --branch <pr> --project-name where-not-rain` 上传预览；fork PR 仅跑 gates、不暴露 token（见 §8 #7）。
3. **D1 migrate 步骤在本期休眠**（无绑定），仅保留显式命令与位置（§7 / §8 #1）。

---

## 5. 有序任务列表（供工程师批量实现；风险已标注）

> 任务数 = 5（符合"≤5、按模块分组、首个为基础设施"的约束）。依赖基本线性：T01 → (T02 ∥ T03) → T04 → T05。

### T01 — 项目基础设施与构建配置（P0）
- **Source files**：`package.json`(根)、`apps/web/package.json`、`apps/web/next.config.mjs`(新)、`apps/web/tsconfig.json`(核)、`.env.example`(新)、`tooling/deploy/build-immutable-artifact.mjs`(改)
- **Dependencies**：无
- **Risk：中** — 需确认 `@wnr/tsconfig/nextjs.json` 含 `jsx:"preserve"`、`moduleResolution:"bundler"`、`plugins:[{name:"next"}]`、`esModuleInterop`、`allowJs`、`noEmit`、`incremental`；否则补齐。改 `apps/web/build` 为 `next build`；`next.config.mjs` 设 `output:"export"`、`images.unoptimized:true`。更新 `ARTIFACT_SURFACE` 加入 `next.config.mjs`（及 `public`）。

### T02 — 构建期数据烘焙层（P0）
- **Source files**：`apps/web/src/build/types.ts`(新)、`apps/web/src/build/geography.seed.ts`(新)、`apps/web/src/build/bake.ts`(新)；复用 `packages/weather`(FakeWeatherProvider)、`packages/domain`(travel-score)
- **Dependencies**：T01
- **Risk：高** — 仓库无天气/地理数据集；`weather.txt` 是 SPEC 提示词非数据。需新建 `geography.seed.ts`（countries/cities 含 lat/lng/tz/slug/isFeatured/多语言名），用 `FakeWeatherProvider` 合成 7 天天气，再用 `travel-score` 计算分数，聚合成 `BakedDataset` 并投影为 4 个 ViewModel。地理种子范围需确认（§8 #3）。

### T03 — 页面接入 App Router（P0）
- **Source files**：`apps/web/src/app/layout.tsx`(新)、`apps/web/src/app/page.tsx`、`apps/web/src/app/[countrySlug]/page.tsx`、`apps/web/src/app/[countrySlug]/[citySlug]/page.tsx`、`apps/web/src/app/explore/page.tsx`、`apps/web/src/app/[countrySlug]/[citySlug]/generateStaticParams` 逻辑（或并入页）、可选 `not-found.tsx`
- **Dependencies**：T01, T02
- **Risk：高** — 现有页面是**纯组件（接收 viewModel prop）**，从未 `next build` 过；需改为 App Router 页面模块（导出默认组件，从 `params`/`searchParams` + `BakedDataset` 计算 `viewModel`）。`/api/v1` 本期**不实现**（无 route.ts）。可能需修 import/类型、加 `generateStaticParams`、加 `metadata` 导出；`next/image` 须 `unoptimized` 或改用 `<img>`。

### T04 — 部署配置与 CI 流水线（P0）
- **Source files**：`apps/web/wrangler.toml`(核)、`.github/workflows/deploy.yml`(新)、`apps/web/public/`(新)、`.gitignore`(核)
- **Dependencies**：T01, T03
- **Risk：中** — `wrangler pages deploy` 真实上传需 GitHub Secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`（见 §7）。`wrangler.toml` 维持 `pages_build_output_dir="out"` 与 env vars；注明本期无 D1 绑定。CI 串联 verify→build→gates(dry-run)→secret-scan→deploy；D1 步骤休眠。

### T05 — 门禁衔接、验证与文档（P1）
- **Source files**：`tooling/deploy/*.mjs`(衔接确认，尤其 `preview-smoke` 适配静态 `out/`)、`docs/08-Cloudflare-Deployment.md`、`docs/05-System-Architecture.md`、`README.md`(部署说明)
- **Dependencies**：T04
- **Risk：低-中** — 确保 dry-run gate 与真实 `wrangler pages deploy` 的 artifact 身份契约对齐（`artifactId` 复用、fail-closed）；`preview-smoke` 须针对静态产物（无 D1/KV 断言）；在 `docs/08`/`docs/05` 补充"本期实际采用静态导出 + 回退条件 + 本期静态子集"。

---

## 6. 依赖包列表（需新增/调整）

| 包 | 范围 | 建议版本 | 说明 |
|---|---|---|---|
| `next` | `apps/web` dependencies | `^14.2.0` | App Router + 静态导出成熟；**与现有 React 18.3.1 兼容**（Next 15 强制 React 19，会引发 peer 冲突，故选 14.2）。 |
| `react` / `react-dom` | 已存在 `^18.3.1` | 保持 | 不升 19（配合 Next 14）。 |
| `wrangler` | 根 `devDependencies` | `^3.90.0` | 仅用于 `wrangler pages deploy` 与（未来）`wrangler d1`；CI 安装。 |
| `@cloudflare/next-on-pages` | **本期不引入** | — | 仅当切 Next-on-Pages（SSR/ISR/api/D1 进入范围）时再加入。 |
| `typescript` `^5.7` / `@types/node` `^22` / `@types/react` `^18` | 已存在 | 保持 | 满足 Next 14 要求。 |

> 锁文件：`pnpm-lock.yaml` 当前无任何 `next`/`wrangler` 记录；T01 安装后会写入。包管理器固定 `pnpm@10.11.0`、Node `>=22`（与根 `package.json` 一致）。

---

## 7. 共享知识（跨文件约定）

- **`pages_build_output_dir`**：本期保持 `"out"`（静态导出）。**仅当切 Next-on-Pages 时**改为 `.vercel/output/static`。
- **部署命令**：`wrangler pages deploy out --project-name where-not-rain`；项目名与 `wrangler.toml` 的 `name`（`where-not-rain`）一致；未建则 `wrangler pages project create where-not-rain --production`（幂等）。预览：`wrangler pages deploy out --branch <pr> --project-name where-not-rain`。
- **D1 绑定与 migrations_dir（本期不使用，预留）**：若未来启用，D1 绑定放 `workers/weather-sync/wrangler.toml`（新建）：
  ```
  [[d1_databases]]
  binding = "DB"
  database_name = "wnr-weather"
  migrations_dir = "../../packages/db/migrations"
  ```
  CI 命令：`wrangler d1 migrations apply wnr-weather --remote`（preview 用 `--env preview`）。`apps/web/wrangler.toml` 本期**不加** D1 绑定。
- **Secrets 命名（仅 GitHub Actions Secrets，不进仓库/构建产物）**：`CLOUDFLARE_API_TOKEN`（需 `Account > Cloudflare Pages:Edit`，未来 D1 需 `D1:Edit`）、`CLOUDFLARE_ACCOUNT_ID`。禁止出现在 `.env`、源码、构建输出、日志、快照。
- **构建期环境变量（DEP-CONFIG-001 子集）**：`APP_ENV` / `APP_BASE_URL` / `DEFAULT_LOCALE` / `SUPPORTED_LOCALES` 在 `next build` 时以 `process.env` 注入（CI 中 `export` 或 workflow `env`）；静态导出下不走 `wrangler pages deploy --var`（那是运行时）。`WEATHER_PRIMARY_PROVIDER` / `WEATHERAPI_SECRET` 等仅在 `.env.example` 中以占位/disabled 形式文档化，本期不使用。
- **`.env.example`**：仅含构建期变量占位 + 文档化但禁用的可选项；无真实 secret；secret 扫描须零命中。
- **静态导出硬约束**：`images.unoptimized = true`；无 API routes / 无 SSR / 无 ISR `revalidate`；`next/image` 须 unoptimized 或改 `<img>`。
- **产物复用（DEP-CICD-001）**：`build-immutable-artifact.mjs` 计算的 `artifactId` 必须被 `deploy-preview`/`promotion-dry-run` 复用（身份不符则 fail-closed）；真实 `wrangler pages deploy` 使用同一 `out/`，**不重建**。
- **artifact 记录落地**：根 `.artifacts/`（已存在）可用于存放 artifact id / 部署记录 JSON。
- **tsconfig 必备项**：确认 `@wnr/tsconfig/nextjs.json` 设 `jsx:"preserve"`、`moduleResolution:"bundler"`、`plugins:[{name:"next"}]`、`esModuleInterop:true`、`allowJs:true`、`noEmit:true`、`incremental:true`；否则在 `apps/web/tsconfig.json` 覆盖补齐。

---

## 8. 待明确事项（仍未决，需团队/用户拍板）

1. **D1 迁移本期是否执行？** 审计显示 `apps/web` 无 D1 消费者且 `wrangler.toml` 无绑定 → **建议休眠**（不执行）；已提供激活命令与绑定位置（§7）。若坚持本期建库，需先有 D1 绑定配置（worker wrangler 或 apps/web wrangler），否则 `wrangler d1 migrations apply` 无目标。需拍板。
2. **`workers/weather-sync` / `workers/maintenance` 是否本期部署？** 结论：**否**（无 D1 绑定、无 worker wrangler 配置、ARCH-LAYERS-001 隔离）。留待"worker 增量"。
3. **地理种子数据集范围**：仓库无现成 countries/cities 数据，需新建。需确认内容范围（最小可部署集 vs 全量国家/城市、lat/lng/tz 来源、isFeatured 标记）。
4. **`weather.txt` 数据真相**：确认其为 SPEC 提示词（审计基线）非天气数据；本期天气由 `FakeWeatherProvider` 确定性合成（非真实）。若需真实历史天气，须另寻数据源（不在本期）。
5. **ISR / `/api/v1` / `/explore` SSR 何时引入**：本期静态导出下，主页/国家/城市 = SSG；`/explore` = 静态壳 + 客户端装饰地图；`/api/v1` 不实现。引入时机即"切 Next-on-Pages"的触发条件（§1.3）。
6. **`WEATHER_DATA_MAX_AGE_MINUTES` 在静态产物中的体现**：烘焙时固定 `dataUpdatedAt`；`stale` 阈值作为构建期常量写入 ViewModel 的 `freshness`。需确认取值（建议默认 60）。
7. **预览环境 secrets 对 fork PR 的安全**：建议仅对内部 PR 跑真实 `wrangler pages deploy`（暴露 token），fork PR 仅跑 gates/构建、不部署。需在 workflow 中用 `if:` 区分。

---

## 附录：约束符合性对照

| 约束 | 本期设计如何满足 |
|---|---|
| DEP-FREE-001（免费套餐） | 静态导出 Pages，零 D1/KV/Cron/Workers 成本；无外网、无付费特性。 |
| DEP-PAGES-001（Pages 优先） | 部署目标 = Cloudflare Pages；静态导出经官方 `wrangler pages deploy` 路径；回退到 Next-on-Pages 的条件已写明。 |
| DEP-CICD-001（门禁/迁移/fail-closed/复用） | verify→build→dry-run gates→secret-scan→真实 deploy；D1 步骤显式且休眠（有序、不破坏）；`artifactId` 复用、身份不符 fail-closed。 |
| DEP-CONFIG-001（词表/密钥走 Secrets） | 构建期变量子集来自词表；`.env.example` 仅占位无 secret；真实 secret 仅 GitHub Secrets。 |
