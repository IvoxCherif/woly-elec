import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionSecret, signValue, verifySessionToken, verifyValue } from "@/lib/admin-session";
import { clientSessionSecret } from "./secrets";
import type { Identity } from "./repo";

export const CLIENT_COOKIE = "woly_session";
export const PENDING_COOKIE = "woly_pending";
export const OAUTH_COOKIE = "woly_oauth";
const CLIENT_TTL = 30 * 24 * 3600 * 1000; // 30 jours
const PENDING_TTL = 30 * 60 * 1000; // 30 minutes pour finir l'inscription après Google

const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

function secretOrThrow() {
  const s = clientSessionSecret();
  if (!s) throw new Error("Secret de session absent");
  return s;
}

export async function currentClientId(): Promise<string | null> {
  const secret = clientSessionSecret();
  if (!secret) return null;
  return verifyValue((await cookies()).get(CLIENT_COOKIE)?.value, secret, "client");
}

export async function startClientSession(clientId: string) {
  (await cookies()).set(CLIENT_COOKIE, await signValue(secretOrThrow(), "client", clientId, CLIENT_TTL), { ...cookieBase, maxAge: CLIENT_TTL / 1000 });
}

export async function endClientSession() {
  const c = await cookies();
  c.set(CLIENT_COOKIE, "", { ...cookieBase, maxAge: 0 });
  c.set(PENDING_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

/** Compte Google vérifié, sans compte Woly Elec : mémorisé 30 min pour finir l'inscription. */
export async function setPendingGoogle(identity: Extract<Identity, { kind: "google" }>) {
  (await cookies()).set(PENDING_COOKIE, await signValue(secretOrThrow(), "pending", JSON.stringify(identity), PENDING_TTL), { ...cookieBase, maxAge: PENDING_TTL / 1000 });
}

export async function pendingGoogle(): Promise<Extract<Identity, { kind: "google" }> | null> {
  const secret = clientSessionSecret();
  if (!secret) return null;
  const v = await verifyValue((await cookies()).get(PENDING_COOKIE)?.value, secret, "pending");
  if (!v) return null;
  try {
    const j = JSON.parse(v);
    return j?.kind === "google" && j.sub && j.email ? j : null;
  } catch {
    return null;
  }
}

/** Adresse e-mail confirmée par le code à 6 chiffres, en attente de la fin de l'inscription (30 min). */
export async function setPendingVerifiedEmail(email: string) {
  (await cookies()).set(PENDING_COOKIE, await signValue(secretOrThrow(), "pending", JSON.stringify({ kind: "email-verifie", email }), PENDING_TTL), { ...cookieBase, maxAge: PENDING_TTL / 1000 });
}

export async function pendingVerifiedEmail(): Promise<string | null> {
  const secret = clientSessionSecret();
  if (!secret) return null;
  const v = await verifyValue((await cookies()).get(PENDING_COOKIE)?.value, secret, "pending");
  try {
    const j = v ? JSON.parse(v) : null;
    return j?.kind === "email-verifie" && typeof j.email === "string" ? j.email : null;
  } catch {
    return null;
  }
}

export async function clearPending() {
  (await cookies()).set(PENDING_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

/** Protection CSRF de la connexion Google : état aléatoire signé, valable 10 minutes. */
export async function setOAuthState(state: string, mode: string) {
  (await cookies()).set(OAUTH_COOKIE, await signValue(secretOrThrow(), "oauth", JSON.stringify({ state, mode }), 600_000), { ...cookieBase, maxAge: 600 });
}

export async function takeOAuthState(): Promise<{ state: string; mode: string } | null> {
  const secret = clientSessionSecret();
  const c = await cookies();
  const raw = c.get(OAUTH_COOKIE)?.value;
  c.set(OAUTH_COOKIE, "", { ...cookieBase, maxAge: 0 });
  if (!secret) return null;
  const v = await verifyValue(raw, secret, "oauth");
  try {
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

export async function isAdmin(): Promise<boolean> {
  const secret = sessionSecret();
  return !!secret && (await verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value, secret));
}

export { normalizeEmail, normalizePhone } from "./phone";
