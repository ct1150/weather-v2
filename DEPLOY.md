# 部署指南（Deploy Guide）— Where Not Rain / Cloudflare 全家桶

本指南说明如何把 WNR 部署到 Cloudflare（Pages + weather-sync Worker + D1 + KV + Web Analytics）。
日常发布由 GitHub Actions 自动完成，仅需少量**一次性手动前置**。

## 架构一览

- **Cloudflare Pages**：静态导出前端（Next.js `output: export`），构建期烘焙天气数据。
  `weather.txt` 是**不可变规范基线**，仅用于校验，绝不作为运行时数据源。
- **weather-sync Worker**：每小时 Cron 拉取 Open-Meteo（免费、无密钥）写入 D1，并把健康状态写 KV。
- **D1（`wnr-weather`）**：`weather_snapshots` / `sync_runs` 等表，迁移文件 `packages/db/migrations/0001_weather.sql`。
- **KV（`wnr-weather-sync`）**：`sync-health` 键（最近成功时间 / provider / status）。
- **Web Analytics**：前端 `CloudflareAnalytics` 组件，受 `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED` + token 控制。

## 一、前置条件（一次性）

### 1. Cloudflare 资源（本地执行，沙箱无法代跑）

在已登录 `wrangler` 的机器上运行（每个命令会返回一段 ID）：

```bash
wrangler d1 create wnr-weather --env production
wrangler d1 create wnr-weather --env preview
wrangler kv namespace create wnr-weather-sync --env production
wrangler kv namespace create wnr-weather-sync --env preview
```

把返回的 **4 个 ID** 填进 `workers/weather-sync/wrangler.toml` 的占位符：

- `<WNR-WEATHER-PRODUCTION-D1-ID>` / `<WNR-WEATHER-PREVIEW-D1-ID>`
- `<WNR-WEATHER-SYNC-PRODUCTION-KV-ID>` / `<WNR-WEATHER-SYNC-PREVIEW-KV-ID>`

> ⚠️ **Pages 项目也必须一次性创建**（否则 `wrangler pages deploy` 会在非交互 CI 里交互式询问而失败）：
>
> ```bash
> wrangler pages project create where-not-rain --production-branch main
> ```
>
> 项目是 account 级、与 D1/KV 独立；创建一次即可，`pages deploy` 后续会复用该已存在项目（不再询问）。
> 本仓库的 `where-not-rain` 项目已于 2026-07-23 创建，CI 直接复用即可。

> 若由协作 AI 在沙箱执行，需先在沙箱 WSL 环境导出 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ACCOUNT_ID`，
> 否则 `wrangler` 无法认证（GitHub Secrets 仅作用于 CI，不会注入本地沙箱）。

### 2. GitHub Secrets（仓库 Settings → Secrets and variables → Actions）

- `CLOUDFLARE_API_TOKEN`（Account 级，建议权限：Cloudflare Pages:Edit、D1:Edit、Workers Scripts:Edit、Workers KV:Edit）
- `CLOUDFLARE_ACCOUNT_ID`
- 可选：`NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_ENABLED`（`true`/`false`）、`NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN`、
  `WORKER_PREVIEW_URL`、`WORKER_PRODUCTION_URL`（仅用于冒烟探测，缺失则跳过探测）

## 二、CI/CD 流程

- **Push 到 `main`** → production 部署：
  `d1 migrations apply 0001` → `wrangler deploy --env production`（含每小时 Cron `0 * * * *`）→ `pages deploy`
- **开 PR** → preview 部署：
  仅 `d1 migrations apply 0001` + `wrangler deploy --env preview`（无 Cron）+ `pages deploy --branch preview`
- **质量门（fail-closed）**：format / lint / typecheck / 单测（352 例，0 失败）/ docs / contract 任一不过则整 job 失败。

## 三、验证

- Pages 站点：`https://<project>.pages.dev`
- Worker 健康：`GET <worker-url>`（scheduled 触发后写 KV `sync-health`）
- 本地冒烟：`node tooling/deploy/sync-smoke.mjs --url <worker-url>`

## 四、回滚 / 排错

- 部署失败优先看 Actions 日志；缺 Secret 会报 `secret not found`。
- D1/KV ID 填错会报 binding 错误 → 核对 `workers/weather-sync/wrangler.toml`。
- 数据回滚见 `workers/maintenance`（含 `rollback` 脚本与测试）。

## 五、沙箱限制（给协作 AI 看）

- 本沙箱默认无 Cloudflare 网络/令牌：第 1 步的 `wrangler` 建资源与 `wrangler deploy` 无法在此执行，
  需在用户自有环境完成；代码质量门（测试/构建）可在沙箱内独立验证。

## 六、种子数据（tourist cities）

生产 D1 在 `0001_weather.sql` 迁移之后，`countries` / `cities` 表默认是空的。
워ker 只同步 `status='active'` 的城市，因此首次上线前必须先灌入地理种子数据，
否则没有任何城市可供同步（精选城市激活门槛会失败）。

种子文件位于 **`packages/db/seeds/0001_cities_jp_kr_sea.sql`**，独立于 `migrations/`，
**不会**被 CI 自动应用（CI 只执行 `d1 migrations apply 0001`，且明确禁止 `0002`）。

### 覆盖范围

- **9 个国家**：日本、韩国、泰国、越南、新加坡、马来西亚、印度尼西亚、菲律宾、柬埔寨
- **32 个城市**：其中 11 座 `is_featured=1`（东京、首尔、济州岛、曼谷、普吉岛、新加坡、吉隆坡、巴厘岛、胡志明市、长滩岛、暹粒）
- 每个国家/城市都写入 `en` + `zh` 两条翻译（`country_translations` / `city_translations`）

### 手动执行（在已登录 `wrangler` 的机器上）

```bash
# 生产库
pnpm --filter @wnr/weather-sync seed:prod

# 预览库
pnpm --filter @wnr/weather-sync seed:preview
```

- 命令走 `workers/weather-sync/wrangler.toml` 解析 `wnr-weather` 的 D1 id（production / preview 各自解析）。
- 全部 `INSERT` 使用 **`INSERT OR IGNORE`**，命令**幂等**：重复执行不会报错、不会重复插入，可安全多次运行或在 CI 失败后重试。
- 插入顺序保证外键正确：先 `countries` → `country_translations`，再 `countries` → `cities` → `city_translations`。

### 重置（仅演示 / 空库时）

```bash
# 注意：下面两条会清空所有地理数据，仅用于本地空库或演示重置，生产环境慎用
pnpm --filter @wnr/weather-sync exec wrangler d1 execute wnr-weather --env production --command "DELETE FROM cities; DELETE FROM countries;"
# 之后重新跑 seed:prod
```

> 真实生产环境请勿随意 `DELETE`，种子本身幂等且可重复执行，无需重置。
