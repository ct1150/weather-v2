import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../../.github/workflows/refresh-production-weather-after-deploy.yml", import.meta.url),
  "utf8",
);

describe("production weather post-deploy refresh guard", () => {
  it("runs only after a successful main push Deploy", () => {
    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("- Deploy");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it("waits for the propagated Open-Meteo Worker before refreshing", () => {
    expect(workflow).toContain('/health');
    expect(workflow).toContain('\"provider\":\"open-meteo\"');
    expect(workflow).toContain('/internal/sync');
    expect(workflow).toContain("report.activated !== true");
  });
});
