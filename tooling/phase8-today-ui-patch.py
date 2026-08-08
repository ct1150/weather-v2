from pathlib import Path

path = Path("apps/web/src/components/CloudTripControls.tsx")
text = path.read_text()

import_anchor = '''import { TripReplanPanel } from "./TripReplanPanel";
import { TripWeatherIntelligencePanel } from "./TripWeatherIntelligencePanel";
'''
import_new = '''import { TripReplanPanel } from "./TripReplanPanel";
import { TripTodayPanel } from "./TripTodayPanel";
import { TripWeatherIntelligencePanel } from "./TripWeatherIntelligencePanel";
'''
if import_anchor not in text:
    raise SystemExit("CloudTripControls Today import anchor changed unexpectedly")
text = text.replace(import_anchor, import_new, 1)

render_anchor = '''      <TripReplanPanel
        locale={locale}
'''
render_new = '''      <TripTodayPanel
        locale={locale}
        workspace={workspace}
        cloudTripId={metadata?.cloudTripId ?? null}
      />

      <TripReplanPanel
        locale={locale}
'''
if render_anchor not in text:
    raise SystemExit("CloudTripControls Replan render anchor changed unexpectedly")
text = text.replace(render_anchor, render_new, 1)
path.write_text(text)
