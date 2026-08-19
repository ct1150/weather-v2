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
path.write_text(patched, encoding="utf-8")
print("Phase 2.5 codemod patched for current contracts, Wrangler and explicit events")
