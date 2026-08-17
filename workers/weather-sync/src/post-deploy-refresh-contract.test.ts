import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deployWorkflow = readFileSync(
  new URL("../../../.github/workflows/deploy.yml", import.meta.url),
  "utf8",
);
const productionSmokeWorkflow = readFileSync(
  new URL("../../../.github/workflows/production-smoke.yml", import.meta.url),
  "utf8",
);

describe("production weather deploy refresh guard", () => {
  it("keeps deployment on main and refreshes weather in the same release runner", () => {
    expect(deployWorkflow).toContain("branches: [main]");
    expect(deployWorkflow).toContain("workflow_dispatch:");
    expect(deployWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(deployWorkflow).toContain('WEATHER_PRIMARY_PROVIDER: "open-meteo"');

    const deployIndex = deployWorkflow.indexOf("- name: Deploy weather-sync Worker");
    const secretIndex = deployWorkflow.indexOf("- name: Configure weather-sync trigger secret");
    const refreshIndex = deployWorkflow.indexOf("- name: Refresh production weather snapshot");

    expect(deployIndex).toBeGreaterThan(-1);
    expect(secretIndex).toBeGreaterThan(deployIndex);
    expect(refreshIndex).toBeGreaterThan(secretIndex);
  });

  it("uses the protected sync endpoint and requires an activated snapshot", () => {
    expect(deployWorkflow).toContain("/internal/sync");
    expect(deployWorkflow).toContain('authorization: Bearer $SYNC_TRIGGER_TOKEN');
    expect(deployWorkflow).toContain("--retry 3 --retry-all-errors");
    expect(deployWorkflow).toContain(`grep -Fq '\"activated\":true'`);
  });

  it("runs consolidated production verification only after a successful main Deploy", () => {
    expect(productionSmokeWorkflow).toContain("workflows: [Deploy]");
    expect(productionSmokeWorkflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(productionSmokeWorkflow).toContain(
      "github.event.workflow_run.head_branch == 'main'",
    );
    expect(productionSmokeWorkflow).toContain("ref: main");
  });
});
