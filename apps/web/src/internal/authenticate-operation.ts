// apps/web/src/internal/authenticate-operation.ts
//
// Strongly authenticated internal operation guard (API-INTERNAL-001,
// ENG-SECURITY-001, ENG-BOT-001 L4). Internal routes are default-deny and live
// outside the public /api/v1 namespace. Every request is verified for:
//   - presence of all required signed headers,
//   - a timestamp within a short clock-skew window,
//   - a constant-time HMAC signature over method/path/timestamp/nonce/body,
//   - a single-use nonce (replay protection within a bounded window),
//   - rate-limit budget (L4 internal: 10 req/min plus strong auth),
//   - authorization for the named operation.
//
// The guard is test-first and internal-only: there is no external auth provider
// wiring, no network call, and no secret ever leaves the process (audit events
// carry only stable codes, never the secret, body, or raw signature).
//
// This module is framework-free; the caller performs the actual operation only
// after a successful, authorized decision is returned.

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { type ApplicationResult, fail, ok } from "../lib/result";

export type InternalOperation = string;
export type InternalPrincipal = string;

export interface InternalAuthRequest {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body: string;
  /** Current time in milliseconds since the Unix epoch. */
  readonly now: number;
}

export interface AuthDecision {
  readonly principal: InternalPrincipal;
  readonly operation: InternalOperation;
  readonly requestId: string;
}

/** A recorded, sanitized audit event (never contains the secret/body/signature). */
export interface AuditEvent {
  readonly requestId: string;
  readonly principal: InternalPrincipal | null;
  readonly operation: InternalOperation | null;
  readonly decision: "allow" | "deny";
  /** Stable reason code (e.g. "signature_mismatch") — no sensitive detail. */
  readonly reason: string;
  readonly at: number;
}

export interface AuditSink {
  record(event: AuditEvent): void;
}

/** Records observed nonces; returns false on replay (nonce already seen). */
export interface NonceStore {
  observe(nonce: string, expiresAt: number): boolean;
}

/** Returns true when the key is within budget, false when rate-limited. */
export interface RateLimiter {
  allow(key: string, now: number): boolean;
}

export interface AuthDependencies {
  /** Deployment secret used for HMAC verification; never logged or returned. */
  readonly secret: string;
  /** Authorization decision for a (principal, operation) pair. */
  readonly authorize: (principal: InternalPrincipal, operation: InternalOperation) => boolean;
  /** Single-use nonce tracker. */
  readonly nonceStore: NonceStore;
  /** Maximum allowed clock skew in milliseconds (e.g. 5 * 60 * 1000). */
  readonly maxClockSkewMs: number;
  /** Replay window: how long a nonce stays recorded (e.g. 5 * 60 * 1000). */
  readonly replayWindowMs: number;
  /** Optional L4 rate limiter keyed by principal. */
  readonly rateLimiter?: RateLimiter | null;
  /** Optional audit sink; receives sanitized decision events only. */
  readonly audit?: AuditSink | null;
  /** Optional pre-generated request id (correlation). */
  readonly requestId?: string;
}

const HEADER_SIGNATURE = "x-wnr-signature";
const HEADER_TIMESTAMP = "x-wnr-timestamp";
const HEADER_NONCE = "x-wnr-nonce";
const HEADER_PRINCIPAL = "x-wnr-principal";
const HEADER_OPERATION = "x-wnr-operation";

/** Build the canonical signing string verified by {@link verifySignature}. */
export function buildSigningString(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodyDigest: string,
): string {
  return `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyDigest}`;
}

/** SHA-256 hex digest of a request body (used inside the signing string). */
export function digestBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

/** Compute the expected hex HMAC-SHA256 signature for a request. */
export function signRequest(
  secret: string,
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body: string,
): string {
  const signing = buildSigningString(method, path, timestamp, nonce, digestBody(body));
  return createHmac("sha256", secret).update(signing).digest("hex");
}

/** Build the signed header set for a request (used by tests/clients). */
export function buildSignedHeaders(
  secret: string,
  method: string,
  path: string,
  timestampIso: string,
  nonce: string,
  body: string,
  principal: InternalPrincipal,
  operation: InternalOperation,
): Record<string, string> {
  return {
    [HEADER_SIGNATURE]: signRequest(secret, method, path, timestampIso, nonce, body),
    [HEADER_TIMESTAMP]: timestampIso,
    [HEADER_NONCE]: nonce,
    [HEADER_PRINCIPAL]: principal,
    [HEADER_OPERATION]: operation,
  };
}

/** Constant-time comparison that first rejects mismatched lengths. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Verify an internal operation request. Returns an authorized decision on
 * success, or a typed failure (UNAUTHORIZED / FORBIDDEN / RATE_LIMITED) before
 * any caller-side work begins. Audit events are recorded with sanitized fields
 * only.
 */
export function authenticateInternalOperation(
  request: InternalAuthRequest,
  deps: AuthDependencies,
): ApplicationResult<AuthDecision> {
  const requestId = deps.requestId ?? randomUUID();

  const audit = (decision: "allow" | "deny", reason: string, principal: InternalPrincipal | null, operation: InternalOperation | null): void => {
    deps.audit?.record({ requestId, principal, operation, decision, reason, at: request.now });
  };

  // Step 1: all required signed headers must be present.
  const signature = request.headers[HEADER_SIGNATURE];
  const timestamp = request.headers[HEADER_TIMESTAMP];
  const nonce = request.headers[HEADER_NONCE];
  const principal = request.headers[HEADER_PRINCIPAL];
  const operation = request.headers[HEADER_OPERATION];

  if (!signature || !timestamp || !nonce || !principal || !operation) {
    audit("deny", "missing_credentials", principal ?? null, operation ?? null);
    return fail("UNAUTHORIZED", "internal authentication is absent or invalid", requestId);
  }

  // Step 2: timestamp within the allowed clock-skew window.
  const tsMs = Date.parse(timestamp);
  if (!Number.isFinite(tsMs) || Math.abs(tsMs - request.now) > deps.maxClockSkewMs) {
    audit("deny", "timestamp_out_of_window", principal, operation);
    return fail("UNAUTHORIZED", "request timestamp is missing or outside the allowed skew", requestId);
  }

  // Step 3: constant-time signature verification (method/path/timestamp/nonce/body).
  const expected = signRequest(deps.secret, request.method, request.path, timestamp, nonce, request.body);
  if (!safeEqual(expected, signature)) {
    audit("deny", "signature_mismatch", principal, operation);
    return fail("UNAUTHORIZED", "request signature is invalid", requestId);
  }

  // Step 4: single-use nonce (replay protection). Replayed nonces are rejected
  // before authorization or any caller work.
  const nonceAccepted = deps.nonceStore.observe(nonce, request.now + deps.replayWindowMs);
  if (!nonceAccepted) {
    audit("deny", "replay_detected", principal, operation);
    return fail("UNAUTHORIZED", "nonce has already been used (replay)", requestId);
  }

  // Step 5: L4 rate limit (10 req/min plus strong authentication).
  if (deps.rateLimiter && !deps.rateLimiter.allow(principal, request.now)) {
    audit("deny", "rate_limited", principal, operation);
    return fail("RATE_LIMITED", "internal rate limit exceeded", requestId);
  }

  // Step 6: authorization for the named operation (only after all auth passes).
  if (!deps.authorize(principal, operation)) {
    audit("deny", "unauthorized_operation", principal, operation);
    return fail("FORBIDDEN", "principal is not authorized for this operation", requestId);
  }

  audit("allow", "authorized", principal, operation);
  return ok({ principal, operation, requestId });
}

/** In-memory nonce store for tests and single-process deployments. */
export function createMemoryNonceStore(): NonceStore {
  const seen = new Set<string>();
  return {
    observe(nonce: string, expiresAt: number): boolean {
      if (seen.has(nonce)) return false;
      seen.add(nonce);
      // Best-effort eviction hint: ignore expiry for the in-memory test store.
      void expiresAt;
      return true;
    },
  };
}
