import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";

export interface AuthEnv {
  readonly DB: D1Database;
  readonly BETTER_AUTH_SECRET?: string;
  readonly AUTH_BASE_URL?: string;
  readonly WEB_ORIGIN?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly RESEND_API_KEY?: string;
  readonly EMAIL_FROM?: string;
}

export interface ProviderAvailability {
  readonly auth: boolean;
  readonly google: boolean;
  readonly email: boolean;
}

export function providerAvailability(env: AuthEnv): ProviderAvailability {
  return {
    auth: typeof env.BETTER_AUTH_SECRET === "string" && env.BETTER_AUTH_SECRET.length >= 32,
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    email: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM),
  };
}

async function sendMagicLinkEmail(env: AuthEnv, email: string, url: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new Error("EMAIL_PROVIDER_UNAVAILABLE");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [email],
      subject: "Sign in to Where Not Rain",
      text: `Use this secure link to sign in to Where Not Rain. The link expires shortly.\n\n${url}`,
    }),
  });
  if (!response.ok) throw new Error(`EMAIL_DELIVERY_${response.status}`);
}

export function createAuth(env: AuthEnv) {
  const availability = providerAvailability(env);
  if (!availability.auth || !env.BETTER_AUTH_SECRET || !env.AUTH_BASE_URL) return null;

  const socialProviders = availability.google
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {};

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.AUTH_BASE_URL,
    trustedOrigins: [env.WEB_ORIGIN ?? "https://868656.xyz", "https://868656.xyz", "http://localhost:3000"],
    socialProviders,
    plugins: [
      magicLink({
        expiresIn: 10 * 60,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => sendMagicLinkEmail(env, email, url),
      }),
    ],
    advanced: {
      database: {
        generateId: "uuid",
        defaultFindManyLimit: 50,
      },
    },
  });
}
