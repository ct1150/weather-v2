export interface ParsedTripDay {
  readonly dayNumber: number;
  readonly heading: string;
  readonly scheduleRows: ReadonlyArray<{ readonly time: string; readonly activity: string }>;
}

export interface ParsedTripMarkdown {
  readonly title: string;
  readonly days: ReadonlyArray<ParsedTripDay>;
}

const DAY_HEADING = /^#{1,3}\s*D(?:ay)?\s*(\d+)[^\n]*$/iu;

function cleanCell(value: string): string {
  return value
    .trim()
    .replace(/^\*\*|\*\*$/gu, "")
    .trim();
}

export function parseTripMarkdown(markdown: string): ParsedTripMarkdown {
  const lines = markdown.replace(/\r\n/gu, "\n").split("\n");
  const titleLine = lines.find((line) => /^#\s+\S/u.test(line));
  const title = titleLine?.replace(/^#\s+/u, "").trim() ?? "未命名旅行";
  const days: Array<{
    dayNumber: number;
    heading: string;
    scheduleRows: Array<{ time: string; activity: string }>;
  }> = [];
  let current: (typeof days)[number] | null = null;

  for (const line of lines) {
    const match = line.trim().match(DAY_HEADING);
    if (match !== null) {
      const dayNumber = Number(match[1]);
      if (Number.isFinite(dayNumber)) {
        current = { dayNumber, heading: line.replace(/^#{1,3}\s*/u, "").trim(), scheduleRows: [] };
        days.push(current);
      }
      continue;
    }
    if (current === null || !line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1).map(cleanCell);
    if (cells.length < 2) continue;
    if (/^(时间|time)$/iu.test(cells[0] ?? "")) continue;
    if (/^-{3,}$/u.test((cells[0] ?? "").replace(/\s/gu, ""))) continue;
    const [time, activity] = cells;
    if (time !== undefined && activity !== undefined && time.length > 0 && activity.length > 0) {
      current.scheduleRows.push({ time, activity });
    }
  }

  return { title, days };
}
