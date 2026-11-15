import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionSecret, signValue, verifySessionToken, verifyValue } from "@/lib/admin-session";
import { clientSessionSecret } from "./secrets";
import type { Identity } from "./repo";

export const CLIENT_COOKIE = "woly_session";
export const PENDING_COOKIE = "woly_pending";
export const OAUTH_COOKIE = "woly_oauth";
export const TWOFA_COOKIE = "woly_2fa";
export const DEVICE_COOKIE = "woly_dev";
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

// ——— Connexion en deux étapes : identifiants (ou Google), puis code à 6 chiffres reçu par e-mail ———

export type Pending2fa = { clientId: string; email: string; via: "email" | "google" };

export async function setPending2fa(p: Pending2fa) {
  (await cookies()).set(TWOFA_COOKIE, await signValue(secretOrThrow(), "2fa", JSON.stringify(p), 10 * 60_000), { ...cookieBase, maxAge: 600 });
}

export async function pending2fa(): Promise<Pending2fa | null> {
  const secret = clientSessionSecret();
  if (!secret) return null;
  const v = await verifyValue((await cookies()).get(TWOFA_COOKIE)?.value, secret, "2fa");
  try {
    const j = v ? JSON.parse(v) : null;
    return j?.clientId && j.email ? (j as Pending2fa) : null;
  } catch {
    return null;
  }
}

export async function clearPending2fa() {
  (await cookies()).set(TWOFA_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

/** Identifiant aléatoire de l'appareil (cookie d'un an) : les erreurs de connexion sont comptées par appareil. */
export async function deviceId(): Promise<string> {
  const c = await cookies();
  let id = c.get(DEVICE_COOKIE)?.value;
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    id = crypto.randomUUID();
    c.set(DEVICE_COOKIE, id, { ...cookieBase, maxAge: 365 * 24 * 3600 });
  }
  return id;
}

export async function isAdmin(): Promise<boolean> {
  const secret = sessionSecret();
  return !!secret && (await verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value, secret));
}

export { normalizeEmail, normalizePhone } from "./phone";
