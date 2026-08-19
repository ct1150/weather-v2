from pathlib import Path

path = Path(__file__).with_name("opc_analytics_phase25.py")
text = path.read_text(encoding="utf-8")
start_marker = "# Retention static contract now requires analytics ownership of all actions.\n"
end_marker = "# ---------------------------------------------------------------------------\n# CI/CD and production validation\n"
start = text.index(start_marker)
end = text.index(end_marker, start)
replacement = """# Retention static contract now requires analytics ownership of all actions.
contract = "apps/web/src/components/discovery-retention-contract.test.ts"
replace_once(
    contract,
    '''  it("does not duplicate planner result-click analytics from the retention layer", () => {
''',
    '''  it("tracks bounded save, reopen, share and calendar actions", () => {
    expect(companion).toContain('event: "search_saved"');
    expect(companion).toContain('event: "saved_search_opened"');
    expect(companion).toContain('event: "saved_search_removed"');
    expect(companion).toContain('event: "share_link_copied"');
    expect(companion).toContain('event: "calendar_reminder_downloaded"');
    expect(companion).toContain("retentionEventFields");
  });

  it("does not duplicate planner result-click analytics from the retention layer", () => {
''',
)

"""
patched = text[:start] + replacement + text[end:]
patched = patched.replace(
    '    "traces": { "enabled": true, "head_sampling_rate": 0.01 },\n',
    "",
)
old_grouped = '''    case "search_saved":
    case "saved_search_opened":
    case "saved_search_removed":
    case "share_link_copied": {
      const context = parseDiscoveryRetentionContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({ ...common, ...context.value, event });
    }
'''
new_explicit = '''    case "search_saved": {
      const context = parseDiscoveryRetentionContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({ ...common, ...context.value, event: "search_saved" });
    }

    case "saved_search_opened": {
      const context = parseDiscoveryRetentionContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({
        ...common,
        ...context.value,
        event: "saved_search_opened",
      });
    }

    case "saved_search_removed": {
      const context = parseDiscoveryRetentionContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({
        ...common,
        ...context.value,
        event: "saved_search_removed",
      });
    }

    case "share_link_copied": {
      const context = parseDiscoveryRetentionContext(obj);
      if (!context.ok) return context;
      return okV<AnalyticsEvent>({ ...common, ...context.value, event: "share_link_copied" });
    }
'''
if patched.count(old_grouped) != 1:
    raise RuntimeError("grouped retention event validator block not found exactly once")
patched = patched.replace(old_grouped, new_explicit, 1)
old_projection = '''export interface AnalyticsEngineProjection {
  readonly indexes: readonly [string];
  readonly blobs: ReadonlyArray<string>;
  readonly doubles: ReadonlyArray<number>;
}
'''
new_projection = '''export interface AnalyticsEngineProjection {
  readonly indexes: [string];
  readonly blobs: string[];
  readonly doubles: number[];
}
'''
if patched.count(old_projection) != 1:
    raise RuntimeError("Analytics Engine projection interface not found exactly once")
patched = patched.replace(old_projection, new_projection, 1)
old_dependency = '''export interface ProductAnalyticsDependencies {
  readonly webOrigin: string;
  readonly now: () => Date;
  readonly writeDataPoint: (point: {
    readonly indexes: ReadonlyArray<string>;
    readonly blobs: ReadonlyArray<string>;
    readonly doubles: ReadonlyArray<number>;
  }) => void;
}
'''
new_dependency = '''export interface ProductAnalyticsDependencies {
  readonly webOrigin: string;
  readonly now: () => Date;
  readonly writeDataPoint: (point: {
    indexes: string[];
    blobs: string[];
    doubles: number[];
  }) => void;
}
'''
if patched.count(old_dependency) != 1:
    raise RuntimeError("Product analytics dependency type not found exactly once")
patched = patched.replace(old_dependency, new_dependency, 1)
old_max_travel = '''    max_travel_minutes: reachability.maxTravelMinutes,
'''
new_max_travel = '''    max_travel_minutes:
      reachability.maxTravelMinutes as DiscoveryFunnelContext["max_travel_minutes"],
'''
if patched.count(old_max_travel) != 1:
    raise RuntimeError("discovery funnel max travel projection not found exactly once")
patched = patched.replace(old_max_travel, new_max_travel, 1)
old_workflow_loop = '''for workflow in [".github/workflows/pr-ci.yml", ".github/workflows/deploy.yml"]:
'''
new_workflow_loop = '''for workflow in [".github/workflows/deploy.yml"]:
'''
if patched.count(old_workflow_loop) != 1:
    raise RuntimeError("workflow patch loop not found exactly once")
patched = patched.replace(old_workflow_loop, new_workflow_loop, 1)
path.write_text(patched, encoding="utf-8")
print("Phase 2.5 codemod patched for current contracts and Worker bindings")
