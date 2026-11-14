/**
 * Session administrateur : jeton signé HMAC-SHA256, stocké dans un cookie httpOnly.
 * Format du jeton : `<expiration en ms>.<signature base64url>`.
 * Utilise Web Crypto : fonctionne dans le middleware (edge) comme dans les routes Node.
 */

export const ADMIN_COOKIE = "woly_admin";
export const SESSION_HOURS = 8;

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Le secret doit être long : en dessous de 32 caractères, l'admin reste fermé. */
export function sessionSecret(): string | null {
  const s = process.env.ADMIN_SESSION_SECRET ?? "";
  return s.length >= 32 ? s : null;
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const exp = now + SESSION_HOURS * 3600 * 1000;
  return `${exp}.${await hmac(secret, `admin.${exp}`)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now || !sig) return false;
  return safeEqual(sig, await hmac(secret, `admin.${exp}`));
}
