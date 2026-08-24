from pathlib import Path

sheet_path = Path("apps/web/src/components/CountryCompareSheet.tsx")
sheet = sheet_path.read_text()


def sheet_once(old: str, new: str) -> None:
    global sheet
    if old not in sheet:
        raise SystemExit(f"sheet anchor not found: {old[:140]!r}")
    sheet = sheet.replace(old, new, 1)


sheet_once(
    'import type { ReactElement } from "react";\n',
    'import type { ReactElement } from "react";\nimport { CountryCompareTripAction } from "./CountryCompareTripAction";\n',
)
sheet_once(
    '''  locale,\n  items,\n  maxItems,''',
    '''  locale,\n  countryName,\n  items,\n  maxItems,''',
)
sheet_once(
    '''  readonly locale: CountryCompareLocale;\n  readonly items: ReadonlyArray<CountryCompareItem>;''',
    '''  readonly locale: CountryCompareLocale;\n  readonly countryName: string;\n  readonly items: ReadonlyArray<CountryCompareItem>;''',
)
sheet_once(
    '''                        <a\n                          href={item.detailHref}\n                          className="inline-flex rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground focus-ring"\n                        >\n                          {copy.details} →\n                        </a>''',
    '''                        <a\n                          href={item.detailHref}\n                          className="inline-flex rounded-full border border-border px-3 py-2 text-xs font-bold text-foreground focus-ring"\n                        >\n                          {copy.details} →\n                        </a>\n                        <CountryCompareTripAction\n                          locale={locale}\n                          cityId={item.id}\n                          cityName={item.name}\n                          countryName={countryName}\n                          dates={item.days.map((day) => day.localDate)}\n                        />''',
)
sheet_path.write_text(sheet)

explorer_path = Path("apps/web/src/components/InstantCountryWeatherExplorer.tsx")
explorer = explorer_path.read_text()
old = '''      <CountryCompareSheet\n        locale={locale}\n        items={compareSummaries.map((summary): CountryCompareItem => ({'''
new = '''      <CountryCompareSheet\n        locale={locale}\n        countryName={country.name}\n        items={compareSummaries.map((summary): CountryCompareItem => ({'''
if old not in explorer:
    raise SystemExit("explorer anchor not found")
explorer_path.write_text(explorer.replace(old, new, 1))

test_path = Path("apps/web/src/components/country-weather-explorer.test.tsx")
test = test_path.read_text()
old = '''    expect(within(dialog).getByText("Rain outlook")).toBeTruthy();\n    expect(window.location.pathname).toBe("/jp");'''
new = '''    expect(within(dialog).getByText("Rain outlook")).toBeTruthy();\n    expect(within(dialog).getAllByRole("button", { name: "Choose & plan" })).toHaveLength(2);\n    expect(window.location.pathname).toBe("/jp");'''
if old not in test:
    raise SystemExit("test anchor not found")
test_path.write_text(test.replace(old, new, 1))
