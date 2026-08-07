import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";

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

const authClient = createAuthClient({
  baseURL: TRIP_API_BASE,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [magicLinkClient()],
});

export async function getTripSession(): Promise<TripAuthUser | null> {
  const result = await authClient.getSession();
  const user = result.data?.user;
  return user === undefined || user === null
    ? null
    : { id: user.id, email: user.email, name: user.name ?? null };
}

export async function signInTripWithGoogle(callbackURL: string): Promise<void> {
  await authClient.signIn.social({ provider: "google", callbackURL });
}

export async function sendTripMagicLink(
  email: string,
  callbackURL: string,
): Promise<TripMagicLinkResult> {
  const result = await authClient.signIn.magicLink({ email, callbackURL });
  return result.error
    ? {
        ok: false,
        message: result.error.message ?? String(result.error.code ?? "SIGN_IN_FAILED"),
      }
    : { ok: true };
}

export async function signOutTrip(): Promise<void> {
  await authClient.signOut();
}
