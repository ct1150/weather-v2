// apps/web/src/search/search-destinations.ts
//
// Bounded, multilingual, fuzzy destination search (PRD-FR-005, API-VALIDATION-001,
// UX-A11Y-001, ENG-PRIVACY-001).
//
// Design guarantees:
//  - **Bounded**: the query is capped to `maxQueryLength` Unicode scalars (default
//    80) and results are capped to `maxResults` (default 20). Short queries (<2
//    scalars) are rejected as invalid input (API-VALIDATION-001) and return [].
//  - **Multilingual**: each candidate carries multiple name/label variants; the
//    best-matching variant across all locales is used for ranking and display.
//  - **Fuzzy**: exact / prefix / substring / whole-string Levenshtein / token-level
//    matching, so minor typos and partial tokens still resolve.
//  - **Privacy-safe (ENG-PRIVACY-001)**: this is a pure, synchronous,
//    side-effect-free function. The query is never logged, transmitted over the
//    network, or retained — it exists only for the duration of the call on the
//    caller's stack. Results carry only candidate-derived fields.
//  - **Accessible output (UX-A11Y-001)**: the ranked list is plain data the UI
//    renders as a crawlable, labeled list.

export interface SearchCandidate {
  /** Stable city id, e.g. "TYO". */
  readonly cityId: string;
  /** Multilingual display names for the city, best/primary first. */
  readonly names: ReadonlyArray<string>;
  /** Multilingual country names. */
  readonly countryNames: ReadonlyArray<string>;
  readonly countrySlug: string;
  readonly citySlug: string;
  /** Canonical href, e.g. "/jp/tokyo". */
  readonly path: string;
}

export interface SearchResult {
  readonly cityId: string;
  /** Best-matching display name for the query (already localized-ish). */
  readonly name: string;
  readonly countryName: string;
  readonly path: string;
  /** Relevance in [0, 1]; higher is more relevant. */
  readonly score: number;
}

export interface SearchOptions {
  /** Hard cap on returned results (bounds work + payload). Default 20. */
  readonly maxResults?: number;
  /** Minimum relevance to include a candidate. Default 0.4. */
  readonly minScore?: number;
  /** Upper bound on query length in Unicode scalars. Default 80. */
  readonly maxQueryLength?: number;
}

const DEFAULT_MAX_RESULTS = 20;
const DEFAULT_MIN_SCORE = 0.4;
const DEFAULT_MAX_QUERY_LENGTH = 80;
const MIN_QUERY_LENGTH = 2;

/** Normalize a string for matching: trim, collapse whitespace, lowercase. */
function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Classic Levenshtein edit distance (char-based, O(n·m)). */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev: number[] = new Array<number>(n + 1);
  let curr: number[] = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n] ?? 0;
}

/**
 * Relevance of `query` to a single `text` in [0, 1]. Tries, in order, exact,
 * prefix, substring, whole-string fuzzy, then token-level fuzzy, returning the
 * strongest signal.
 */
function relevance(query: string, text: string): number {
  const q = query;
  const t = text;
  if (t.length === 0) return 0;
  if (q === t) return 1;
  if (t.startsWith(q)) return 0.9;
  if (t.includes(q)) return 0.7 + 0.2 * (q.length / t.length);

  // Whole-string fuzzy fallback.
  const dist = levenshtein(q, t);
  const sim = 1 - dist / Math.max(q.length, t.length, 1);
  if (sim >= 0.6) return 0.6 * sim;

  // Token-level fuzzy (handles multi-word labels like "new york").
  const tokens = t.split(/\s+/);
  let best = 0;
  for (const tok of tokens) {
    if (tok === q) best = Math.max(best, 0.85);
    else if (tok.startsWith(q)) best = Math.max(best, 0.75);
    else if (tok.includes(q)) best = Math.max(best, 0.6);
    else {
      const d = levenshtein(q, tok);
      const s = 1 - d / Math.max(q.length, tok.length, 1);
      if (s >= 0.7) best = Math.max(best, 0.5 * s);
    }
  }
  return best;
}

/**
 * Search destinations. Pure and side-effect-free (ENG-PRIVACY-001): the query is
 * never logged, sent, or retained. Returns a relevance-ranked, bounded list.
 */
export function searchDestinations(
  query: string,
  candidates: ReadonlyArray<SearchCandidate>,
  options: SearchOptions = {},
): SearchResult[] {
  const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const maxQueryLength = options.maxQueryLength ?? DEFAULT_MAX_QUERY_LENGTH;

  const normalized = normalize(query).slice(0, maxQueryLength);
  if (normalized.length < MIN_QUERY_LENGTH) return [];

  const scored: SearchResult[] = [];

  for (const c of candidates) {
    const fallbackName: string = c.names.length > 0 ? (c.names[0] ?? c.cityId) : c.cityId;
    let bestNameScore = 0;
    let bestName: string = fallbackName;
    for (const name of c.names) {
      const s = relevance(normalized, normalize(name));
      if (s > bestNameScore) {
        bestNameScore = s;
        bestName = name;
      }
    }

    const fallbackCountry: string = c.countryNames.length > 0 ? (c.countryNames[0] ?? "") : "";
    let bestCountryScore = 0;
    let bestCountry: string = fallbackCountry;
    for (const cn of c.countryNames) {
      const s = relevance(normalized, normalize(cn));
      if (s > bestCountryScore) {
        bestCountryScore = s;
        bestCountry = cn;
      }
    }

    const score = Math.max(bestNameScore, bestCountryScore * 0.7);
    if (score < minScore) continue;

    scored.push({
      cityId: c.cityId,
      name: bestName,
      countryName: bestCountry,
      path: c.path,
      score,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0;
  });

  return scored.slice(0, maxResults);
}
