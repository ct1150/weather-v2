from pathlib import Path

editor = Path("apps/web/src/components/StructuredActivityEditor.tsx")
text = editor.read_text()
anchor = '''        <p className="mt-1 text-[11px] text-muted">{copy.migrated}</p>
'''
insert = '''        <p className="mt-1 text-[11px] text-muted">{copy.migrated}</p>
        <p className="mt-2 text-[10px] text-muted" data-poi-attribution="openstreetmap">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            © OpenStreetMap contributors · ODbL
          </a>
        </p>
'''
if 'data-poi-attribution="openstreetmap"' not in text:
    if anchor not in text:
        raise SystemExit("structured editor attribution anchor changed unexpectedly")
    text = text.replace(anchor, insert, 1)
editor.write_text(text)

contract = Path("apps/web/src/components/trip-activity-phase7-contract.test.ts")
test = contract.read_text()
old = '''    expect(poi).toContain("findWeatherFallbacks");
  });
'''
new = '''    expect(poi).toContain("findWeatherFallbacks");
    expect(editor).toContain('data-poi-attribution="openstreetmap"');
    expect(editor).toContain("https://www.openstreetmap.org/copyright");
    expect(editor).toContain("© OpenStreetMap contributors · ODbL");
  });
'''
if old not in test:
    raise SystemExit("Phase 7 POI contract anchor changed unexpectedly")
contract.write_text(test.replace(old, new, 1))
