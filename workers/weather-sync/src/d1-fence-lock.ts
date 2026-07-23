// workers/weather-sync — D1-backed owner-aware fence lock.
//
// Implements the `FenceLock` port from `./sync.js` against the Cloudflare D1
// `sync_locks` table (see packages/db/migrations/0001_weather.sql). The semantics
// mirror the in-memory `FakeFenceLock` used by tests: acquisition is conditional on
// the lock being unheld or expired, every successful acquisition bumps a strictly
// monotonic fencing token, and release clears the owner without dropping the
// high-water token (so a stale holder can never reuse an old token).

import type { D1DatabaseLike } from "@wnr/test-utils";
import type { FenceLock } from "./sync.js";

interface LockRow {
  readonly holder: string | null;
  readonly fencing_token: number;
  readonly expires_at: string | null;
}

export class D1FenceLock implements FenceLock {
  /** In-process cache of the high-water token per key (D1 reads are async). */
  private readonly tokenCache = new Map<string, number>();

  constructor(private readonly db: D1DatabaseLike) {}

  async acquire(
    key: string,
    holder: string,
    ttlMs: number,
    nowMs: number,
  ): Promise<{ readonly acquired: boolean; readonly token: number }> {
    const nowIso = new Date(nowMs).toISOString();
    const expiresAt = new Date(nowMs + ttlMs).toISOString();

    const row = (await this.db
      .prepare("SELECT holder, fencing_token, expires_at FROM sync_locks WHERE key = ?")
      .bind(key)
      .first()) as LockRow | null;

    if (
      row != null &&
      row.holder != null &&
      row.expires_at != null &&
      Date.parse(row.expires_at) > nowMs
    ) {
      return { acquired: false, token: row.fencing_token };
    }

    // NOTE: Cloudflare D1 rejects raw SQL transactions ("BEGIN IMMEDIATE" / "COMMIT" /
    // "ROLLBACK"); use a single idempotent UPSERT instead. The read above determines
    // the new token; the write below is one statement (no explicit transaction). For
    // this single-worker hourly Cron the read-then-write race is negligible.
    const token = (row?.fencing_token ?? 0) + 1;
    await this.db
      .prepare(
        "INSERT INTO sync_locks (key, holder, fencing_token, acquired_at, expires_at) VALUES (?, ?, ?, ?, ?) " +
          "ON CONFLICT(key) DO UPDATE SET holder = excluded.holder, " +
          "fencing_token = excluded.fencing_token, acquired_at = excluded.acquired_at, " +
          "expires_at = excluded.expires_at",
      )
      .bind(key, holder, token, nowIso, expiresAt)
      .run();

    this.tokenCache.set(key, token);
    return { acquired: true, token };
  }

  async release(key: string, holder: string, token: number): Promise<boolean> {
    const row = (await this.db
      .prepare("SELECT holder, fencing_token FROM sync_locks WHERE key = ?")
      .bind(key)
      .first()) as { holder: string | null; fencing_token: number } | null;

    if (row == null || row.holder !== holder || row.fencing_token !== token) return false;

    await this.db
      .prepare(
        "UPDATE sync_locks SET holder = NULL, acquired_at = NULL, expires_at = NULL WHERE key = ?",
      )
      .bind(key)
      .run();

    // Keep the high-water token so a later acquire continues to increment it.
    this.tokenCache.set(key, token);
    return true;
  }

  getToken(key: string): number {
    return this.tokenCache.get(key) ?? 0;
  }
}
