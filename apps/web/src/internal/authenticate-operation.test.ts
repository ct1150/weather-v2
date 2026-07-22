// apps/web/src/internal/authenticate-operation.test.ts
//
// Tests for the strongly authenticated internal operation guard
// (API-INTERNAL-001, ENG-SECURITY-001, ENG-BOT-001 L4): missing/malformed/
// expired/replayed/incorrectly-signed/unauthorized requests are rejected before
// any caller-side work, signatures use constant-time comparison, rate limits
// apply, and audit events are sanitized (no secret/body/signature).

import { describe, expect, it, vi } from "vitest";

import {
  authenticateInternalOperation,
  buildSignedHeaders,
  createMemoryNonceStore,
  type AuditEvent,
  type AuthDependencies,
  type InternalAuthRequest,
} from "./authenticate-operation";

const SECRET = "unit-test-internal-secret";
const NOW = Date.parse("2026-07-20T00:00:00Z");
const PRINCIPAL = "svc-sync";
const OPERATION = "weather.sync";
const PATH = "/internal/sync";

function makeDeps(overrides: Partial<AuthDependencies> = {}): {
  deps: AuthDependencies;
  authorize: ReturnType<typeof vi.fn>;
  auditEvents: AuditEvent[];
  rateLimiter: ReturnType<typeof vi.fn>;
} {
  const authorize = vi.fn((p: string, o: string): boolean => p === PRINCIPAL && o === OPERATION);
  const rateLimiterFn = vi.fn((): boolean => true);
  const auditEvents: AuditEvent[] = [];
  const deps: AuthDependencies = {
    secret: SECRET,
    authorize,
    nonceStore: createMemoryNonceStore(),
    maxClockSkewMs: 5 * 60 * 1000,
    replayWindowMs: 5 * 60 * 1000,
    audit: { record: (e) => auditEvents.push(e) },
    rateLimiter: { allow: rateLimiterFn },
    ...overrides,
  };
  return { deps, authorize, auditEvents, rateLimiter: rateLimiterFn };
}

function makeRequest(headers: Record<string, string>, body = "{}"): InternalAuthRequest {
  return { method: "POST", path: PATH, headers, body, now: NOW };
}

describe("authenticate operation — success", () => {
  it("accepts a correctly signed, fresh, single-use request", () => {
    const { deps, authorize, auditEvents } = makeDeps();
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-1",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    const res = authenticateInternalOperation(makeRequest(headers), deps);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.principal).toBe(PRINCIPAL);
      expect(res.value.operation).toBe(OPERATION);
    }
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(auditEvents.at(-1)?.decision).toBe("allow");
    expect(auditEvents.at(-1)?.reason).toBe("authorized");
  });
});

describe("authenticate operation — rejection before work", () => {
  it("rejects a missing signature without calling authorize", () => {
    const { deps, authorize, auditEvents } = makeDeps();
    const res = authenticateInternalOperation(
      makeRequest({
        "x-wnr-timestamp": new Date(NOW).toISOString(),
        "x-wnr-nonce": "n",
        "x-wnr-principal": PRINCIPAL,
        "x-wnr-operation": OPERATION,
      }),
      deps,
    );
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("UNAUTHORIZED");
    expect(authorize).not.toHaveBeenCalled();
    expect(auditEvents.at(-1)?.reason).toBe("missing_credentials");
  });

  it("rejects a tampered body (signature mismatch) without calling authorize", () => {
    const { deps, authorize } = makeDeps();
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-2",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    const res = authenticateInternalOperation(makeRequest(headers, '{"changed":true}'), deps);
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("UNAUTHORIZED");
    expect(authorize).not.toHaveBeenCalled();
  });

  it("rejects an expired timestamp", () => {
    const { deps, authorize } = makeDeps();
    const expired = new Date(NOW - 10 * 60 * 1000).toISOString(); // beyond 5m skew
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      expired,
      "nonce-3",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    const res = authenticateInternalOperation(makeRequest(headers), deps);
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("UNAUTHORIZED");
    expect(authorize).not.toHaveBeenCalled();
  });

  it("rejects a timestamp too far in the future", () => {
    const { deps, authorize } = makeDeps();
    const future = new Date(NOW + 10 * 60 * 1000).toISOString();
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      future,
      "nonce-4",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    const res = authenticateInternalOperation(makeRequest(headers), deps);
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("UNAUTHORIZED");
    expect(authorize).not.toHaveBeenCalled();
  });

  it("rejects a replayed nonce", () => {
    const { deps, authorize } = makeDeps();
    const first = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-5",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    expect(authenticateInternalOperation(makeRequest(first), deps).ok).toBe(true);
    const replay = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-5",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    const res = authenticateInternalOperation(makeRequest(replay), deps);
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("UNAUTHORIZED");
    expect(authorize).toHaveBeenCalledTimes(1); // only the first call reached authorize
  });

  it("rejects an unauthorized operation with FORBIDDEN", () => {
    const { deps } = makeDeps();
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-6",
      "{}",
      PRINCIPAL,
      "weather.delete-everything",
    );
    const res = authenticateInternalOperation(makeRequest(headers), deps);
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("FORBIDDEN");
  });

  it("rejects when the L4 rate limit is exceeded", () => {
    const { deps, authorize } = makeDeps({ rateLimiter: { allow: () => false } });
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-7",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    const res = authenticateInternalOperation(makeRequest(headers), deps);
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("RATE_LIMITED");
    expect(authorize).not.toHaveBeenCalled(); // rate check precedes authorize
  });

  it("rejects a wrong-length signature via constant-time comparison", () => {
    const { deps, authorize } = makeDeps();
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-8",
      "{}",
      PRINCIPAL,
      OPERATION,
    );
    const bad = { ...headers, "x-wnr-signature": "short" };
    const res = authenticateInternalOperation(makeRequest(bad), deps);
    expect(res.ok).toBe(false);
    expect(res.ok ? null : res.error.code).toBe("UNAUTHORIZED");
    expect(authorize).not.toHaveBeenCalled();
  });
});

describe("authenticate operation — audit sanitization", () => {
  it("records only sanitized fields and never the secret or body", () => {
    const { deps, auditEvents } = makeDeps();
    const headers = buildSignedHeaders(
      SECRET,
      "POST",
      PATH,
      new Date(NOW).toISOString(),
      "nonce-9",
      "SECRET-BODY-PAYLOAD",
      PRINCIPAL,
      OPERATION,
    );
    authenticateInternalOperation(makeRequest(headers, "SECRET-BODY-PAYLOAD"), deps);
    expect(auditEvents.length).toBeGreaterThan(0);
    const event = auditEvents[0] as Record<string, unknown>;
    expect(Object.keys(event).sort()).toEqual([
      "at",
      "decision",
      "operation",
      "principal",
      "reason",
      "requestId",
    ]);
    expect(event.secret).toBeUndefined();
    expect(event.body).toBeUndefined();
    expect(event.signature).toBeUndefined();
    expect(JSON.stringify(event)).not.toContain(SECRET);
    expect(JSON.stringify(event)).not.toContain("SECRET-BODY-PAYLOAD");
  });
});
