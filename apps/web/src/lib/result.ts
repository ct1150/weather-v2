// apps/web/src/lib/result.ts
//
// Shared application-layer result type. Use cases return ApplicationResult<T>
// instead of throwing for expected failures, so the read path stays free of
// unhandled exceptions (ARCH-LAYERS-001 / design.md "MVP stack"). Every error
// carries a stable code; the API adapter maps that code through its owned table.

/** A typed, serializable application error. */
export interface ApplicationError {
  readonly code: string;
  readonly message: string;
  readonly requestId?: string;
}

/**
 * The closed result union returned by every use case. `ok: true` carries the
 * value; `ok: false` carries a typed error. Exactly one branch is present.
 */
export type ApplicationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApplicationError };

/** Construct a successful result. */
export function ok<T>(value: T): ApplicationResult<T> {
  return { ok: true, value };
}

/** Construct a failed result with a stable error code. */
export function fail(code: string, message: string, requestId?: string): ApplicationResult<never> {
  const error: { code: string; message: string; requestId?: string } = { code, message };
  if (requestId !== undefined) error.requestId = requestId;
  return { ok: false, error };
}
