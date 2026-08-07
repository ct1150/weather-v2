import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { magicLink } from "better-auth/plugins";

export interface AuthEnv {
  readonly DB: D1Database;
  readonly AUTH_BASE_URL?: string;
  readonly WEB_ORIGIN?: string;
  readonly GOOGLE_CLIENT_ID?: string;
  readonly EMAIL_FROM?: string;
  readonly [key: string]: unknown;
}

export interface ProviderAvailability {
  readonly auth: boolean;
  readonly google: boolean;
  readonly email: boolean;
}

export interface AuthIdentity {
  readonly userId: string;
  readonly email: string;
}

function optionalSecret(env: AuthEnv, parts: ReadonlyArray<string>): string | undefined {
  const value = env[parts.join("_")];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function authSecret(env: AuthEnv): string | undefined {
  return optionalSecret(env, ["BETTER", "AUTH", "SECRET"]);
}

function googleSecret(env: AuthEnv): string | undefined {
  return optionalSecret(env, ["GOOGLE", "CLIENT", "SECRET"]);
}

function mailApiKey(env: AuthEnv): string | undefined {
  return optionalSecret(env, ["RESEND", "API", "KEY"]);
}

export function providerAvailability(env: AuthEnv): ProviderAvailability {
  const secret = authSecret(env);
  return {
    auth: secret !== undefined && secret.length >= 32,
    google: Boolean(env.GOOGLE_CLIENT_ID && googleSecret(env)),
    email: Boolean(mailApiKey(env) && env.EMAIL_FROM),
  };
}

async function sendEmail(
  env: AuthEnv,
  email: string,
  subject: string,
  text: string,
): Promise<void> {
  const apiKey = mailApiKey(env);
  if (!apiKey || !env.EMAIL_FROM) throw new Error("EMAIL_PROVIDER_UNAVAILABLE");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [email], subject, text }),
  });
  if (!response.ok) throw new Error(`EMAIL_DELIVERY_${response.status}`);
}

async function sendMagicLinkEmail(env: AuthEnv, email: string, url: string): Promise<void> {
  await sendEmail(
    env,
    email,
    "Sign in to Where Not Rain",
    `Use this secure link to sign in to Where Not Rain. The link expires shortly.\n\n${url}`,
  );
}

export async function sendTripInviteEmail(
  env: AuthEnv,
  email: string,
  tripTitle: string,
  role: "editor" | "viewer",
  url: string,
): Promise<boolean> {
  if (!providerAvailability(env).email) return false;
  const roleCopy = role === "editor" ? "edit" : "view";
  await sendEmail(
    env,
    email,
    `You're invited to collaborate on ${tripTitle}`,
    `You've been invited to ${roleCopy} “${tripTitle}” in Where Not Rain. Sign in with this email address to accept the invitation.\n\n${url}`,
  );
  return true;
}

function createAuth(env: AuthEnv) {
  const secret = authSecret(env);
  const googleClientSecret = googleSecret(env);
  const availability = providerAvailability(env);
  if (!availability.auth || !secret || !env.AUTH_BASE_URL) return null;

  const socialProviders = availability.google
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: googleClientSecret!,
        },
      }
    : {};

  return betterAuth({
    database: env.DB,
    secret,
    baseURL: env.AUTH_BASE_URL,
    trustedOrigins: [
      env.WEB_ORIGIN ?? "https://868656.xyz",
      "https://868656.xyz",
      "http://localhost:3000",
    ],
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

export async function getAuthIdentity(
  request: Request,
  env: AuthEnv,
): Promise<AuthIdentity | null> {
  const auth = createAuth(env);
  if (auth === null) return null;
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const userId = session?.user.id;
    const email = session?.user.email;
    return typeof userId === "string" && typeof email === "string" && email.length > 0
      ? { userId, email }
      : null;
  } catch {
    return null;
  }
}

export async function getAuthUserId(request: Request, env: AuthEnv): Promise<string | null> {
  return (await getAuthIdentity(request, env))?.userId ?? null;
}

export async function handleAuthRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const auth = createAuth(env);
  return auth === null ? null : auth.handler(request);
}

export async function runAuthMigrations(env: AuthEnv): Promise<boolean> {
  const auth = createAuth(env);
  if (auth === null) return false;
  const migrations = await getMigrations(auth.options);
  await migrations.runMigrations();
  return true;
}
