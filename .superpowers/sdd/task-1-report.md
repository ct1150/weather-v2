# Task 1 Implementation Report

## 状态

DONE_WITH_CONCERNS

Task 1 的基础解析层与测试已实现，focused tests 和使用仓库共享配置文件的格式检查均通过。Concern 是 brief 指定的原样 Prettier 命令会因既有根配置无法解析未声明的工作区包而失败；该配置修复不在 Task 1 允许修改范围内。

## 修改文件

- 创建 `tooling/docs/requirement-format.mjs`
- 创建 `tooling/docs/requirement-format.test.mjs`
- 创建 `.superpowers/sdd/task-1-report.md`（本报告）

未修改 `apps/`、`workers/`、`packages/` 或后续任务文件；未执行 commit。

## 红灯命令 / 证据

命令：

```bash
node --test tooling/docs/requirement-format.test.mjs
```

在只创建测试、尚未创建实现模块时运行。退出码为 1，关键证据：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/root/test/weather/tooling/docs/requirement-format.mjs'
# tests 1
# pass 0
# fail 1
```

失败原因与 brief 预期一致：生产模块缺失，而非测试语法或断言错误。

## 绿灯命令 / 输出摘要

### Focused tests

命令：

```bash
node --test tooling/docs/requirement-format.test.mjs
```

最终 fresh verification：退出码 0；13 tests，13 pass，0 fail，0 skipped，0 todo。

覆盖内容：行尾与尾随空白规范化、稳定 SHA-256、需求元数据和 Acceptance Criteria、重复/缺失键、ID/heading 不匹配、allowed values、排序去重 digest、release/trace/derived 解析、无效及多行 JSON、canonical arrays。

### Formatting

brief 原样命令：

```bash
pnpm exec prettier --write tooling/docs/requirement-format.mjs tooling/docs/requirement-format.test.mjs
```

退出码 2。错误：

```text
Cannot find package '@wnr/prettier-config' imported from /root/test/weather/prettier.config.js
```

根因证据：`prettier.config.js` 导入 `@wnr/prettier-config`，但根 `package.json` 与 `pnpm-lock.yaml` 根 importer 未声明该工作区包，且 `node_modules/@wnr` 不存在。由于根配置和依赖文件不在 Task 1 允许修改范围内，未修改它们。

使用完全相同的仓库共享配置本体显式完成格式化：

```bash
pnpm exec prettier --config tooling/prettier-config/index.js --write tooling/docs/requirement-format.mjs tooling/docs/requirement-format.test.mjs
```

退出码 0，两个目标文件均完成处理。最终检查：

```bash
pnpm exec prettier --config tooling/prettier-config/index.js --check tooling/docs/requirement-format.mjs tooling/docs/requirement-format.test.mjs
```

退出码 0，输出 `All matched files use Prettier code style!`。

### Locked baseline

命令：

```bash
wc -l weather.txt && sha256sum weather.txt
```

退出码 0；结果为 1,476 行，SHA-256 为 `70e692e5dd1dee3ae167c9b95d7014bc521ec194a6cc14989a88c382c453924d`，与 brief 锁定基线一致。

## 自审

- 所有 brief 要求的导出接口均已提供：`normalizeBlock`、`sha256`、`parseRequirementBlocks`、`parseReleaseRecords`、`parseTraceRecords`、`parseDerivedManifest`、`digestRequirementSelection`。
- 六个 allowed-value Set 使用 brief 的精确值。
- `normalizeBlock` 使用 brief 给定算法：统一 CRLF/CR、移除首尾空行、清除每行尾随空白、固定单个末尾换行。
- requirement metadata 采用严格精确键校验；拒绝重复键、缺失键、未知键、无效 status/kind、重复 requirement ID、heading mismatch，以及无 Acceptance Criteria 的 Hard block。
- selection digest 对 ID 排序并去重，按 `\n---\n` 拼接规范化 block，并产生 `sha256:` 加 64 位小写十六进制。
- JSON comments 必须是单行有效 JSON object；release、trace、derived 使用严格字段和类型/allowed-value 校验。
- derived `ids` 按 ID 严格递增，`sources` 按 path 严格递增，重复项也会被拒绝。
- 测试使用 Node 内建 runner 和真实实现，无 mock；先红后绿，格式化后与最终阶段均复跑通过。
- 未执行后续任务，未修改产品代码，未 commit。

## 未决问题

- 根 `prettier.config.js` 依赖未在根 workspace importer 声明的 `@wnr/prettier-config`，导致 brief 指定的原样 Prettier 命令退出码 2。需要后续获准修改根依赖声明/锁文件或修正根配置导入后，原样命令才能满足“退出码 0”；Task 1 本次使用共享配置文件显式路径验证通过。

## Review Important findings 修复追加（2026-07-17）

### 状态

DONE_WITH_CONCERNS

仅修复 `task-1-review.md` 的两个 Important finding；未执行后续任务，未修改根配置或依赖，未 commit。

### 修复内容

- 在 `requirement-format.test.mjs` 增加 4 个独立回归测试，分别覆盖 derived manifest 顶层键逆序、JSON 内部额外空白、requirement 同行畸形 marker、未闭合 marker。
- `parseDerivedManifest` 现在将原始 payload 与递归 canonical JSON 序列化结果比较：所有 object key 按字典序排列，且 JSON 内部不允许非必要空白；release/trace 解析行为未改变。
- `parseRequirementBlocks` 现在枚举每个 `<!-- requirement` start token，并要求它与完整多行 marker grammar 的匹配数量及起始位置逐一一致；同行畸形与未闭合 marker 不再被当成空文档静默接受。

### 红灯证据

在只加入 4 个回归测试、尚未修改实现时运行：

```bash
node --test tooling/docs/requirement-format.test.mjs
```

退出码 1；17 tests，13 pass，4 fail。四个失败测试均为预期的 `Missing expected exception.`：

```text
not ok 14 - rejects derived manifests with non-canonical key order
not ok 15 - rejects derived manifests with non-canonical whitespace
not ok 16 - rejects malformed same-line requirement markers
not ok 17 - rejects unclosed requirement markers
```

这证明四个测试分别命中 review 指出的缺失校验，而非语法或环境错误。

### 绿灯证据

逐项修复后的中间验证：

```bash
node --test --test-name-pattern='rejects derived manifests with non-canonical' tooling/docs/requirement-format.test.mjs
```

退出码 0；2 tests，2 pass，0 fail。

```bash
node --test --test-name-pattern='requirement markers' tooling/docs/requirement-format.test.mjs
```

退出码 0；2 tests，2 pass，0 fail。

使用显式共享配置格式化：

```bash
pnpm exec prettier --config tooling/prettier-config/index.js --write tooling/docs/requirement-format.mjs tooling/docs/requirement-format.test.mjs
```

退出码 0；实现文件 unchanged，测试文件完成格式化。

最终 fresh focused verification：

```bash
node --test tooling/docs/requirement-format.test.mjs
```

退出码 0；17 tests，17 pass，0 fail，0 skipped，0 todo。

最终显式共享 Prettier config 检查：

```bash
pnpm exec prettier --config tooling/prettier-config/index.js --check tooling/docs/requirement-format.mjs tooling/docs/requirement-format.test.mjs
```

退出码 0；输出 `All matched files use Prettier code style!`。

### Concerns

既有根 workspace Prettier config resolution 问题仍按 review 记录为后续 repository-tooling issue；本修复未触碰根配置或依赖。Task 1 要求的显式共享配置检查已通过，无新增 concern。
