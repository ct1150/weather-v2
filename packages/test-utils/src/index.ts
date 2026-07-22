// @wnr/test-utils — fast-check generators, fixtures, and fake Cloudflare bindings.
//
// These fakes implement the narrow ports used by packages/workers tests. The D1 fake
// wraps the built-in `node:sqlite` DatabaseSync in the Cloudflare D1 async API shape, so
// repository / migration / resolver / sync tests exercise REAL SQL against an in-memory
// database without any external service. No real provider, KV, or Cloudflare binding is
// ever contacted.

import { DatabaseSync } from "node:sqlite";

/**
 * Parameter value accepted by node:sqlite prepared statements. Duplicated locally to avoid
 * depending on the exact exported alias name across @types/node versions.
 */
type SqlInputValue = null | number | bigint | string | Uint8Array;

/** Narrow D1 prepared-statement port (a subset of the Cloudflare D1 API). */
export interface D1PreparedStatementLike {
  bind(...values: ReadonlyArray<unknown>): D1PreparedStatementLike;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<{ readonly results: ReadonlyArray<T> }>;
  run(): Promise<{ readonly meta: { readonly changes: number; readonly lastRowId: number } }>;
  raw<T = unknown>(): Promise<ReadonlyArray<ReadonlyArray<T>>>;
}

/** Narrow D1 database port (a subset of the Cloudflare D1 API). */
export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
  exec(query: string): Promise<unknown>;
  batch(statements: ReadonlyArray<D1PreparedStatementLike>): Promise<ReadonlyArray<unknown>>;
}

class SqliteStmt implements D1PreparedStatementLike {
  private readonly db: DatabaseSync;
  private readonly query: string;
  private params: ReadonlyArray<SqlInputValue> = [];

  constructor(db: DatabaseSync, query: string) {
    this.db = db;
    this.query = query;
  }

  bind(...values: ReadonlyArray<unknown>): SqliteStmt {
    this.params = values as ReadonlyArray<SqlInputValue>;
    return this;
  }

  async first<T = unknown>(column?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.query);
    const row = stmt.get(...this.params) as Record<string, unknown> | undefined;
    if (row == null) return null;
    if (column != null) return (row[column] as T) ?? null;
    return row as T;
  }

  async all<T = unknown>(): Promise<{ readonly results: ReadonlyArray<T> }> {
    const stmt = this.db.prepare(this.query);
    const rows = stmt.all(...this.params) as unknown as ReadonlyArray<T>;
    return { results: rows };
  }

  async run(): Promise<{ readonly meta: { readonly changes: number; readonly lastRowId: number } }> {
    const stmt = this.db.prepare(this.query);
    const res = stmt.run(...this.params);
    const changes = Number(res.changes.toString());
    const lastRowId = Number(res.lastInsertRowid.toString());
    return { meta: { changes, lastRowId } };
  }

  async raw<T = unknown>(): Promise<ReadonlyArray<ReadonlyArray<T>>> {
    const stmt = this.db.prepare(this.query);
    const rows = stmt.all(...this.params) as unknown as ReadonlyArray<Record<string, unknown>>;
    return rows.map((r) => Object.values(r)) as unknown as ReadonlyArray<ReadonlyArray<T>>;
  }
}

/** D1-shaped adapter over an in-memory `node:sqlite` database. */
export class SqliteD1 implements D1DatabaseLike {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  prepare(query: string): SqliteStmt {
    return new SqliteStmt(this.db, query);
  }

  async exec(query: string): Promise<void> {
    this.db.exec(query);
  }

  async batch(statements: ReadonlyArray<SqliteStmt>): Promise<ReadonlyArray<unknown>> {
    const out: unknown[] = [];
    for (const s of statements) out.push(await s.run());
    return out;
  }
}

/** Create an in-memory D1 fake backed by `node:sqlite`. */
export function createInMemoryD1(): D1DatabaseLike {
  return new SqliteD1(new DatabaseSync(":memory:"));
}

/** In-memory KV fake (read-only on the user path; workers write immutable values). */
export class FakeKv {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  list(): ReadonlyMap<string, string> {
    return this.store;
  }
}

interface LockRow {
  holder: string | null;
  token: number;
  acquiredAt: number | null;
  expiresAt: number | null;
}

/**
 * Owner-aware fenced lock fake with a strictly monotonic, never-reused fencing token.
 * Mirrors the D1 `sync_locks` contract: acquisition is conditional on unheld/expired
 * state, every successful acquisition increments the token, and release clears the
 * owner without resetting the high-water mark.
 */
export class FakeFenceLock {
  private readonly rows = new Map<string, LockRow>();

  async acquire(
    key: string,
    holder: string,
    ttlMs: number,
    nowMs: number,
  ): Promise<{ readonly acquired: boolean; readonly token: number }> {
    const existing = this.rows.get(key);
    if (existing != null && existing.holder != null && existing.expiresAt != null && existing.expiresAt > nowMs) {
      return { acquired: false, token: existing.token };
    }
    const token = (existing?.token ?? 0) + 1;
    this.rows.set(key, { holder, token, acquiredAt: nowMs, expiresAt: nowMs + ttlMs });
    return { acquired: true, token };
  }

  async release(key: string, holder: string, token: number): Promise<boolean> {
    const existing = this.rows.get(key);
    if (existing == null) return false;
    if (existing.holder !== holder || existing.token !== token) return false;
    this.rows.set(key, { holder: null, token, acquiredAt: null, expiresAt: null });
    return true;
  }

  getToken(key: string): number {
    return this.rows.get(key)?.token ?? 0;
  }
}

/** Configurable fake for a port that returns a single value or null. */
export class FakeValue<T> {
  private value: T | null;

  constructor(initial: T | null = null) {
    this.value = initial;
  }

  async read(): Promise<T | null> {
    return this.value;
  }

  set(value: T | null): void {
    this.value = value;
  }
}

/** Fake manifest hint reader (returns the exact D1-published identity or null). */
export class FakeManifestHint<T> extends FakeValue<T> {}

/** Fake immutable-core reader (returns the worker-published CoreData or null). */
export class FakeImmutableCore<T> extends FakeValue<T> {}

/** Fake publication-authority reader (returns { active, publicationTokenHighWater }). */
export class FakePublicationAuthority<T> extends FakeValue<T> {}
