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
