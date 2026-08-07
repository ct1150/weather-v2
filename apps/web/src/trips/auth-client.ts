export const TRIP_API_BASE = (
  process.env.NEXT_PUBLIC_TRIP_API_URL ?? "https://trip.868656.xyz"
).replace(/\/$/u, "");

export interface TripAuthUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
}

export interface TripMagicLinkResult {
  readonly ok: boolean;
  readonly message?: string;
}

interface AuthErrorPayload {
  readonly message?: string;
  readonly code?: string;
}

interface SessionPayload {
  readonly user?: {
    readonly id?: string;
    readonly email?: string;
    readonly name?: string | null;
  } | null;
}

interface SocialSignInPayload {
  readonly url?: string;
  readonly redirect?: boolean;
}

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${TRIP_API_BASE}/api/auth${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

async function authError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as AuthErrorPayload;
    return payload.message ?? payload.code ?? `HTTP_${response.status}`;
  } catch {
    return `HTTP_${response.status}`;
  }
}

export async function getTripSession(): Promise<TripAuthUser | null> {
  const response = await authFetch("/get-session");
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(await authError(response));
  const payload = (await response.json()) as SessionPayload | null;
  const user = payload?.user;
  if (user?.id === undefined || user.email === undefined) return null;
  return { id: user.id, email: user.email, name: user.name ?? null };
}

export async function signInTripWithGoogle(callbackURL: string): Promise<void> {
  const response = await authFetch("/sign-in/social", {
    method: "POST",
    body: JSON.stringify({
      provider: "google",
      callbackURL,
      disableRedirect: true,
    }),
  });
  if (!response.ok) throw new Error(await authError(response));
  const payload = (await response.json()) as SocialSignInPayload;
  if (typeof payload.url !== "string" || payload.url.length === 0) {
    throw new Error("GOOGLE_REDIRECT_UNAVAILABLE");
  }
  window.location.assign(payload.url);
}

export async function sendTripMagicLink(
  email: string,
  callbackURL: string,
): Promise<TripMagicLinkResult> {
  const response = await authFetch("/sign-in/magic-link", {
    method: "POST",
    body: JSON.stringify({ email, callbackURL }),
  });
  return response.ok ? { ok: true } : { ok: false, message: await authError(response) };
}

export async function signOutTrip(): Promise<void> {
  const response = await authFetch("/sign-out", { method: "POST", body: "{}" });
  if (!response.ok) throw new Error(await authError(response));
}
