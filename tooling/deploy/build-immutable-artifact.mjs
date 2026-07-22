// tooling/deploy/build-immutable-artifact.mjs
//
// Build an immutable, self-contained web artifact for a workspace and write a
// non-empty artifact identity. The artifact is the deployable surface (source +
// config), copied verbatim so its identity is a pure function of its bytes. The
// production promotion later REUSES this exact artifact; it is never rebuilt.
//
// Self-contained: it only shells out to the locked package manager to build the
// workspace and copies local files. No network, no Cloudflare API.

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  computeArtifactId,
  DeploymentError,
  isMain,
  statSyncSafe,
  parseArgs,
} from "./deploy-core.mjs";

/**
 * Ordered list of workspace files/dirs that make up the deployable artifact.
 *
 * Extended for the static-export phase (docs/08, T01): `next.config.mjs` is the
 * Next.js build configuration that drives `next build` -> `out/`, and `public`
 * is the static asset surface copied verbatim into the export. Both are part of
 * the immutable, content-addressed surface so the artifact identity reflects any
 * change to build behavior or served assets.
 */
const ARTIFACT_SURFACE = [
  "src",
  "package.json",
  "tsconfig.json",
  "vitest.config.ts",
  "wrangler.toml",
  "next.config.mjs",
  "public",
];

/** Run the workspace's locked build; throws (fail-closed) on any build error. */
function buildWorkspace(workspace, rootDir) {
  const pkgPath = join(rootDir, workspace, "package.json");
  if (!existsSync(pkgPath)) {
    throw new DeploymentError(`workspace not found: ${pkgPath}`, "missing_workspace");
  }
  const name = JSON.parse(readFileSync(pkgPath, "utf8")).name;
  execSync(`pnpm --filter ${JSON.stringify(name)} build`, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

/**
 * Build the workspace, copy its deployable surface into `outputDir`, and return
 * a deterministic artifact identity written to `identityFile` (when given).
 */
export function buildImmutableArtifact({
  workspace,
  outputDir,
  identityFile,
  rootDir = process.cwd(),
}) {
  const root = resolve(rootDir);
  buildWorkspace(workspace, root); // throws on failure -> fail closed

  const out = resolve(root, outputDir);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  const wsDir = resolve(root, workspace);
  for (const entry of ARTIFACT_SURFACE) {
    const src = join(wsDir, entry);
    if (!statSyncSafe(src)) continue;
    cpSync(src, join(out, entry), { recursive: true });
  }

  const artifactId = computeArtifactId(out);
  if (identityFile) {
    const idPath = resolve(root, identityFile);
    mkdirSync(dirname(idPath), { recursive: true });
    writeFileSync(idPath, artifactId, "utf8");
  }
  return { artifactId, outputDir: out };
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2), {
    string: ["workspace", "output-dir", "identity-file"],
  });
  if (!args.workspace || !args["output-dir"] || !args["identity-file"]) {
    console.error(
      "usage: build-immutable-artifact --workspace <dir> --output-dir <dir> --identity-file <file>",
    );
    process.exit(2);
  }
  try {
    const { artifactId } = buildImmutableArtifact({
      workspace: args.workspace,
      outputDir: args["output-dir"],
      identityFile: args["identity-file"],
    });
    console.log(`[build-immutable-artifact] artifact ${artifactId} -> ${args["output-dir"]}`);
    console.log(artifactId);
  } catch (e) {
    console.error(`[build-immutable-artifact] FAILED: ${e.message}`);
    process.exit(1);
  }
}
