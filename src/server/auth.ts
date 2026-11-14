import "server-only";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, sessionSecret, signValue, verifySessionToken, verifyValue } from "@/lib/admin-session";
import { clientSessionSecret } from "./secrets";

export const CLIENT_COOKIE = "woly_session";
export const PENDING_COOKIE = "woly_pending";
const CLIENT_TTL = 30 * 24 * 3600 * 1000; // 30 jours
const PENDING_TTL = 30 * 60 * 1000; // 30 minutes pour finir l'inscription

const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export async function currentClientId(): Promise<string | null> {
  const secret = clientSessionSecret();
  if (!secret) return null;
  return verifyValue((await cookies()).get(CLIENT_COOKIE)?.value, secret, "client");
}

export async function startClientSession(clientId: string) {
  const secret = clientSessionSecret();
  if (!secret) throw new Error("Secret de session absent");
  (await cookies()).set(CLIENT_COOKIE, await signValue(secret, "client", clientId, CLIENT_TTL), { ...cookieBase, maxAge: CLIENT_TTL / 1000 });
}

export async function endClientSession() {
  const c = await cookies();
  c.set(CLIENT_COOKIE, "", { ...cookieBase, maxAge: 0 });
  c.set(PENDING_COOKIE, "", { ...cookieBase, maxAge: 0 });
}

/** Téléphone vérifié par code SMS, en attente de la fin de l'inscription. */
export async function setPendingPhone(phone: string) {
  const secret = clientSessionSecret();
  if (!secret) throw new Error("Secret de session absent");
  (await cookies()).set(PENDING_COOKIE, await signValue(secret, "pending", phone, PENDING_TTL), { ...cookieBase, maxAge: PENDING_TTL / 1000 });
}

export async function pendingPhone(): Promise<string | null> {
  const secret = clientSessionSecret();
  if (!secret) return null;
  return verifyValue((await cookies()).get(PENDING_COOKIE)?.value, secret, "pending");
}

export async function isAdmin(): Promise<boolean> {
  const secret = sessionSecret();
  return !!secret && (await verifySessionToken((await cookies()).get(ADMIN_COOKIE)?.value, secret));
}

/** Numéro sénégalais normalisé : +221 suivi de 9 chiffres (77, 78, 76, 75, 70, 33…). */
export function normalizePhone(input: string): string | null {
  let d = String(input).replace(/\D/g, "");
  if (d.startsWith("00221")) d = d.slice(5);
  else if (d.startsWith("221") && d.length === 12) d = d.slice(3);
  return /^[37]\d{8}$/.test(d) ? `+221${d}` : null;
}
