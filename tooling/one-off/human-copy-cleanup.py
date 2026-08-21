from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def edit(path: str, replacements: list[tuple[str, str]]) -> None:
    target = ROOT / path
    text = target.read_text()
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new)
        elif new not in text:
            print(f"warning: copy target not found in {path}: {old[:70]!r}")
    target.write_text(text)


# Country page: describe the dot map directly instead of sounding like product documentation.
edit(
    "apps/web/src/components/InstantCountryWeatherExplorer.tsx",
    [
        ("All supported travel destinations at a glance", "City rain outlook at a glance"),
        ("全部已收录旅行地天气一目了然", "城市降雨情况一张图查看"),
        ("全部已收錄旅行地天氣一目了然", "城市降雨情況一張圖查看"),
        ("`${count}/${count} shown`", "`${count} cities`"),
        ("`已显示 ${count}/${count}`", "`共 ${count} 个城市`"),
        ("`已顯示 ${count}/${count}`", "`共 ${count} 個城市`"),
    ],
)

# City detail: remove visible /100 scoring and show a qualitative weather reference instead.
city_path = ROOT / "apps/web/src/components/ChineseCityWeatherPage.tsx"
city = city_path.read_text()
for old, new in [
    ("`查看降雨风险、气温和 7 天旅行评分，再和${country}其他目的地比较后决定行程。`", "`查看未来 7 天的降雨、气温和每天变化，再和${country}其他城市比较。`"),
    ("`查看降雨風險、氣溫和 7 天旅行評分，再和${country}其他目的地比較後決定行程。`", "`查看未來 7 天的降雨、氣溫和每天變化，再和${country}其他城市比較。`"),
    ('score: "旅行评分"', 'score: "天气参考"'),
    ('reason: "评分原因"', 'reason: "主要天气特点"'),
    ('scoreShort: "评分"', 'scoreShort: "天气参考"'),
    ('derived: " · 衍生旅行评分"', 'derived: ""'),
    ('score: "旅行評分"', 'score: "天氣參考"'),
    ('reason: "評分原因"', 'reason: "主要天氣特點"'),
    ('scoreShort: "評分"', 'scoreShort: "天氣參考"'),
    ('derived: " · 衍生旅行評分"', 'derived: ""'),
]:
    if old in city:
        city = city.replace(old, new)

marker = "function formatObservation(value: string, locale: ChineseWeatherLocale): string {"
if "function weatherReferenceLabel(" not in city:
    helper = '''function weatherReferenceLabel(score: ScoreViewModel, locale: ChineseWeatherLocale): string {
  if (score.value === null) return renderScoreValue(score, locale);
  if (locale === "zh-hant") {
    if (score.value >= 75) return "整體較適合戶外安排";
    if (score.value >= 50) return "部分時段需要留意";
    return "建議多看逐日天氣再安排戶外活動";
  }
  if (score.value >= 75) return "整体较适合安排户外活动";
  if (score.value >= 50) return "部分时段需要留意";
  return "建议多看逐日天气再安排户外活动";
}

'''
    city = city.replace(marker, helper + marker)

old_score = '''        <section aria-label={copy.score} className="info-panel h-full">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.score}</p>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-5xl font-bold tracking-[-0.05em] text-foreground">
              {renderScoreValue(score, locale)}
            </span>
            {score.value !== null ? (
              <span className="mb-1 text-sm font-semibold text-muted">/ 100</span>
            ) : null}
          </div>
          {score.reasonCodes.length > 0 ? ('''
new_score = '''        <section aria-label={copy.score} className="info-panel h-full">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{copy.score}</p>
          <p className="mt-3 text-2xl font-bold leading-tight text-foreground">
            {weatherReferenceLabel(score, locale)}
          </p>
          {score.reasonCodes.length > 0 ? ('''
if old_score in city:
    city = city.replace(old_score, new_score)

old_daily = '''                  <span className="min-w-12 text-right text-sm font-bold text-foreground">
                    {renderScoreValue(day.score, locale)}
                    <span className="block text-[9px] uppercase tracking-[0.1em] text-muted">
                      {copy.scoreShort}
                    </span>
                  </span>'''
if old_daily in city:
    city = city.replace(old_daily, "")
city_path.write_text(city)

# Trip dashboard: keep the underlying score model but never make the user decode it.
dashboard_path = ROOT / "apps/web/src/components/TripPlannerDashboard.tsx"
dashboard = dashboard_path.read_text()
old_dial = '''function ScoreDial({ score }: { readonly score: number }): ReactElement {
  const style = {
    "--trip-score": `${score * 3.6}deg`,
  } as CSSProperties;
  return (
    <div className="trip-score-dial" style={style} aria-label={`天气适宜度 ${score} 分`}>
      <span>{score}</span>
      <small>适宜度</small>
    </div>
  );
}'''
new_dial = '''function ScoreDial({ score }: { readonly score: number }): ReactElement {
  const style = {
    "--trip-score": `${score * 3.6}deg`,
  } as CSSProperties;
  const label = score >= 75 ? "天气影响较小" : score >= 50 ? "部分时段需留意" : "建议调整户外安排";
  const shortLabel = score >= 75 ? "较稳" : score >= 50 ? "留意" : "调整";
  return (
    <div className="trip-score-dial" style={style} aria-label={label}>
      <span>{shortLabel}</span>
      <small>天气参考</small>
    </div>
  );
}'''
if old_dial in dashboard:
    dashboard = dashboard.replace(old_dial, new_dial)
for old, new in [
    ('{activity.assessment.score} · {riskCopy(activity.assessment.riskLevel)}', '{riskCopy(activity.assessment.riskLevel)}'),
    ('"实时构建数据" : "预报快照"', '"最新预报" : "已有预报"'),
    ('"Open-Meteo 构建快照" : "内置预报快照"', '"最新天气" : "已有天气"'),
    ('<span>天气决策摘要</span>', '<span>今天的天气提醒</span>'),
    ('Weather-triggered Plan B', '天气变化后的备选安排'),
    ('<p className="eyebrow">逐项天气与约束</p>', '<p className="eyebrow">逐项天气提醒</p>'),
    ('<span className="trip-constraint-badge">固定约束</span>', '<span className="trip-constraint-badge">已固定</span>'),
]:
    if old in dashboard:
        dashboard = dashboard.replace(old, new)
dashboard_path.write_text(dashboard)

# Weather-change panel: hide impact scores and replace model/decision jargon with actions.
weather_panel_path = ROOT / "apps/web/src/components/TripWeatherIntelligencePanel.tsx"
weather_panel = weather_panel_path.read_text()
for old, new in [
    ('intro: "Only meaningful forecast deterioration is surfaced. Small forecast noise stays quiet."', 'intro: "We only flag forecast changes that could affect your plans."'),
    ('impact: "Impact"', 'impact: "Attention"'),
    ('recommendation: "Recommended action"', 'recommendation: "What you can do"'),
    ('createDecision: "Create decision"', 'createDecision: "Save this adjustment"'),
    ('converted: "Decision created"', 'converted: "Saved"'),
    ('baseline: "A fresh baseline was recorded. Future forecast changes will be compared against it."', 'baseline: "Current forecast saved. We will compare later changes with it."'),
    ('newInsight: "New weather change detected."', 'newInsight: "Weather has changed."'),
    ('impact: "影响分"', 'impact: "需要留意"'),
    ('recommendation: "建议动作"', 'recommendation: "可以怎么调整"'),
    ('createDecision: "形成协作决定"', 'createDecision: "保存这个调整"'),
    ('converted: "已形成决定"', 'converted: "已保存"'),
    ('baseline: "已记录最新天气基线，后续预报会与它自动比较。"', 'baseline: "已保存当前预报，之后会用它对比天气变化。"'),
    ('newInsight: "发现新的天气变化。"', 'newInsight: "天气有了新的变化。"'),
    ('impact: "影響分"', 'impact: "需要留意"'),
    ('recommendation: "建議動作"', 'recommendation: "可以怎麼調整"'),
    ('createDecision: "形成協作決定"', 'createDecision: "儲存這個調整"'),
    ('converted: "已形成決定"', 'converted: "已儲存"'),
    ('baseline: "已記錄最新天氣基線，後續預報會與它自動比較。"', 'baseline: "已儲存目前預報，之後會用它比較天氣變化。"'),
    ('newInsight: "發現新的天氣變化。"', 'newInsight: "天氣有了新的變化。"'),
    ('"Rain probability crossed the high-risk threshold"', '"Rain chance is now high enough to affect outdoor plans"'),
    ('"Expected rainfall increased materially"', '"Expected rainfall increased noticeably"'),
    ('"Sustained wind reached an activity-sensitive level"', '"Wind is strong enough to affect some outdoor activities"'),
    ('"Wind gusts reached an activity-sensitive level"', '"Gusts are strong enough to affect some outdoor activities"'),
    ('"Temperature crossed the heat threshold for this travel party"', '"The forecast is hot enough to affect this group"'),
    ('"Temperature crossed the cold threshold for this travel party"', '"The forecast is cold enough to affect this group"'),
    ('"UV crossed the outdoor exposure threshold"', '"UV is high enough to need extra sun protection"'),
    ('"降雨概率进入高风险区间"', '"降雨概率已经高到可能影响户外安排"'),
    ('"预计降水量明显增加"', '"预计降雨量明显增加"'),
    ('"持续风达到影响游玩的阈值"', '"风力已经可能影响部分户外活动"'),
    ('"阵风达到影响游玩的阈值"', '"阵风已经可能影响部分户外活动"'),
    ('"温度超过当前出行成员的高温阈值"', '"高温可能影响当前同行成员"'),
    ('"温度跌破当前出行成员的低温阈值"', '"低温可能影响当前同行成员"'),
    ('"紫外线超过户外暴露阈值"', '"紫外线较强，户外需要加强防晒"'),
    ('"降雨機率進入高風險區間"', '"降雨機率已經高到可能影響戶外安排"'),
    ('"預計降水量明顯增加"', '"預計降雨量明顯增加"'),
    ('"持續風達到影響遊玩的門檻"', '"風力已經可能影響部分戶外活動"'),
    ('"陣風達到影響遊玩的門檻"', '"陣風已經可能影響部分戶外活動"'),
    ('"溫度超過目前出行成員的高溫門檻"', '"高溫可能影響目前同行成員"'),
    ('"溫度跌破目前出行成員的低溫門檻"', '"低溫可能影響目前同行成員"'),
    ('"紫外線超過戶外暴露門檻"', '"紫外線較強，戶外需要加強防曬"'),
]:
    if old in weather_panel:
        weather_panel = weather_panel.replace(old, new)
weather_panel = weather_panel.replace(
    '{copy.impact}: {insight.impactScore}/100',
    '{copy.impact}: {insight.severity === "action" ? copy.action : copy.watch}',
)
weather_panel_path.write_text(weather_panel)

# Activity editor: talk about the user's day, not the internal data model.
edit(
    "apps/web/src/components/StructuredActivityEditor.tsx",
    [
        ('title: "Structured activities"', 'title: "Day activities"'),
        ('"Weather-aware metadata powers concrete Plan B suggestions now and safe replanning later."', '"Mark what is indoors, outdoors or hard to move so weather alternatives stay practical."'),
        ('migrated: "Legacy itinerary text is preserved and upgraded deterministically when you edit."', 'migrated: "Your original itinerary text is kept when you edit these details."'),
        ('addPoi: "Add curated place"', 'addPoi: "Add place"'),
        ('choosePoi: "Choose a curated place"', 'choosePoi: "Choose a place"'),
        ('planB: "Concrete Plan B"', 'planB: "Weather backup"'),
        ('alternatives: "Lower-weather-risk alternatives"', 'alternatives: "Alternatives less affected by weather"'),
        ('"No curated POI catalogue is available for this city yet. Generic Plan B remains available."', '"No suggested places are available for this city yet. You can still add your own backup."'),
        ('title: "结构化活动"', 'title: "当天活动"'),
        ('intro: "室内外、天气敏感度和固定约束会用于当前 Plan B，并作为后续安全重排的基础。"', 'intro: "标记室内外、是否方便调整和预约情况，天气变化时更容易找到合适备选。"'),
        ('migrated: "旧版每行行程会被确定性转换，原文本不会丢失。"', 'migrated: "编辑这些信息时，原来的行程文字会保留。"'),
        ('addPoi: "添加精选 POI"', 'addPoi: "添加地点"'),
        ('choosePoi: "选择一个精选地点"', 'choosePoi: "选择一个地点"'),
        ('planB: "具体 Plan B"', 'planB: "天气备选"'),
        ('alternatives: "低天气风险备选"', 'alternatives: "更不受天气影响的备选"'),
        ('noPoi: "这个城市还没有精选 POI 数据，继续使用通用 Plan B。"', 'noPoi: "这个城市暂时没有推荐地点，你仍可以自己添加备选。"'),
        ('title: "結構化活動"', 'title: "當天活動"'),
        ('intro: "室內外、天氣敏感度和固定約束會用於目前 Plan B，並作為後續安全重排的基礎。"', 'intro: "標記室內外、是否方便調整和預約情況，天氣變化時更容易找到合適備選。"'),
        ('migrated: "舊版每行行程會被確定性轉換，原文字不會遺失。"', 'migrated: "編輯這些資訊時，原來的行程文字會保留。"'),
        ('addPoi: "新增精選 POI"', 'addPoi: "新增地點"'),
        ('choosePoi: "選擇一個精選地點"', 'choosePoi: "選擇一個地點"'),
        ('planB: "具體 Plan B"', 'planB: "天氣備選"'),
        ('alternatives: "低天氣風險備選"', 'alternatives: "較不受天氣影響的備選"'),
        ('noPoi: "這個城市還沒有精選 POI 資料，繼續使用通用 Plan B。"', 'noPoi: "這個城市暫時沒有推薦地點，你仍可以自己新增備選。"'),
    ],
)

# Trip import: replace parser/AI language with a simple review flow.
edit(
    "apps/web/src/components/SmartTripImportForm.tsx",
    [
        ('step2: "Structured preview"', 'step2: "What we found"'),
        ('daysFound: "Days found"', 'daysFound: "Trip days"'),
        ('next: "Next: review only what needs attention"', 'next: "Before you continue"'),
        ('"Recognized cities and day types are filled automatically. Ambiguous days stay unassigned for you to confirm in the workspace."', '"Cities we can match are filled in. Anything uncertain stays blank for you to confirm."'),
        ('step2: "结构化预览"', 'step2: "识别结果"'),
        ('daysFound: "识别天数"', 'daysFound: "行程天数"'),
        ('next: "下一步：只确认尚未识别的部分"', 'next: "继续前确认一下"'),
        ('"可唯一识别的城市和行程类型会自动填入；有歧义的日期会保持空白，让你在工作台确认。"', '"能确定的城市已经填好；不确定的地方会留空，进入工作台后再确认。"'),
        ('step2: "結構化預覽"', 'step2: "辨識結果"'),
        ('daysFound: "辨識天數"', 'daysFound: "行程天數"'),
        ('next: "下一步：只確認尚未辨識的部分"', 'next: "繼續前確認一下"'),
        ('"可唯一辨識的城市與行程類型會自動填入；有歧義的日期會保留空白，讓你在工作台確認。"', '"能確定的城市已經填好；不確定的地方會留空，進入工作台後再確認。"'),
    ],
)

# Import landing pages: user action first, parser mechanics second.
edit(
    "apps/web/src/app/zh-cn/trips/new/page.tsx",
    [
        ('"粘贴 Markdown、ChatGPT 或已整理好的旅行计划，自动识别城市和行程类型并创建天气行程工作台。"', '"粘贴现有旅行计划，先整理好日期和城市，再到天气行程工作台继续确认和调整。"'),
        ('把你现有的计划直接变成天气行程工作台', '把现有行程带进天气工作台'),
        ('粘贴已经整理好的旅行行程。系统会识别\n          D1、Day1、支持城市和行程类型，只把有歧义的日期留给你确认。', '粘贴已经整理好的旅行行程。日期和能确定的城市会先填好，不确定的地方留给你确认。'),
    ],
)
edit(
    "apps/web/src/app/zh-hant/trips/new/page.tsx",
    [
        ('自動辨識城市和行程類型', '先整理日期和城市'),
        ('系統會辨識', '會先整理'),
        ('結構化', '整理後的'),
    ],
)
edit(
    "apps/web/src/app/trips/new/page.tsx",
    [
        ('automatically identify cities and trip types', 'organize dates and matched cities'),
        ('Structured', 'Reviewed'),
    ],
)

# Legacy discovery is noindex, but keep its visible copy human if someone reaches it.
edit(
    "apps/web/src/components/WeatherDiscoveryPlannerV2.tsx",
    [
        ('"Choose a travel window. We rank destinations by overall rain risk and return only the three strongest matches."', '"Choose your dates and compare the three destinations with the least rain in the current forecast."'),
        ('score: "Dry score"', 'score: "Rain outlook"'),
        ('results: "Top 3 least-rain destinations"', 'results: "3 destinations with less rain"'),
        ('"选择出行日期，系统只按整体降雨风险排序，并只给出最值得比较的 3 个目的地。"', '"选择出行日期，直接比较当前预报里雨更少的 3 个目的地。"'),
        ('score: "少雨指数"', 'score: "少雨情况"'),
        ('results: "最少雨的 3 个目的地"', 'results: "雨较少的 3 个目的地"'),
        ('"选择会保存在当前设备。商业链接只在选择后出现，并且不会影响推荐排序。"', '"选择会保存在当前设备。商业链接只在选择后出现，不会影响前面的天气排序。"'),
        ('"選擇出行日期，系統只按整體降雨風險排序，並只給出最值得比較的 3 個目的地。"', '"選擇出行日期，直接比較目前預報裡雨更少的 3 個目的地。"'),
        ('score: "少雨指數"', 'score: "少雨情況"'),
        ('results: "最少雨的 3 個目的地"', 'results: "雨較少的 3 個目的地"'),
        ('"選擇會保存在目前裝置。商業連結只在選擇後出現，並且不會影響推薦排序。"', '"選擇會保存在目前裝置。商業連結只在選擇後出現，不會影響前面的天氣排序。"'),
    ],
)

# Execution mode: hide implementation terms such as IndexedDB, MapLibre and failover mechanics.
edit(
    "apps/web/src/components/TripExecutionWorkspace.tsx",
    [
        ('"Use the same trip document to combine activities, hard constraints, hotel anchors and routing in one execution view. Real routing degrades safely to a local estimate."', '"See today’s activities, fixed bookings, accommodation and route in one place. If live routing is unavailable, an estimated route is still shown."'),
        ('offlineLoaded: "Loaded the most recent offline trip from this device."', 'offlineLoaded: "Loaded the most recent trip saved on this device."'),
        ('mapNote:\n      "Optimization only moves eligible activities. Fixed tickets, transport and required reservations never move. The map keeps Weather V2\'s existing MapLibre + OpenFreeMap stack."', 'mapNote:\n      "Route changes only move activities that are safe to move. Fixed tickets, transport and required reservations stay in place."'),
        ('"复用现有行程数据，把活动、固定约束、酒店锚点和路线放到同一个执行视图。真实道路路线失败时会自动降级为本地估算。"', '"把今天的活动、固定预约、住宿和路线放在同一页查看。实时道路路线暂时不可用时，仍会显示估算路线。"'),
        ('offlineLoaded: "已从本机 IndexedDB 载入最近保存的离线行程。"', 'offlineLoaded: "已载入这台设备最近保存的行程。"'),
        ('mapNote:\n      "路线优化只调整可移动活动；固定门票、交通和必须预约活动不会被移动。地图继续使用 Weather V2 现有 MapLibre + OpenFreeMap 技术栈。"', 'mapNote:\n      "路线调整只移动适合调整的活动；固定门票、交通和必须预约活动会保持原位。"'),
        ('"重用既有行程資料，把活動、固定限制、住宿錨點和路線放到同一個執行視圖。真實道路路線失敗時會自動降級為本機估算。"', '"把今天的活動、固定預約、住宿和路線放在同一頁查看。即時道路路線暫時無法使用時，仍會顯示估算路線。"'),
        ('offlineLoaded: "已從本機 IndexedDB 載入最近儲存的離線行程。"', 'offlineLoaded: "已載入這台裝置最近儲存的行程。"'),
        ('mapNote:\n      "路線最佳化只調整可移動活動；固定門票、交通和必須預約活動不會被移動。地圖繼續使用 Weather V2 現有 MapLibre + OpenFreeMap 技術棧。"', 'mapNote:\n      "路線調整只移動適合調整的活動；固定門票、交通和必須預約活動會保持原位。"'),
    ],
)

# Format touched files using the repo formatter in the workflow.
