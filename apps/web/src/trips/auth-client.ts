import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";

export const TRIP_API_BASE = (
  process.env.NEXT_PUBLIC_TRIP_API_URL ?? "https://trip.868656.xyz"
).replace(/\/$/u, "");

export const tripAuthClient = createAuthClient({
  baseURL: TRIP_API_BASE,
  fetchOptions: {
    credentials: "include",
  },
  plugins: [magicLinkClient()],
});
