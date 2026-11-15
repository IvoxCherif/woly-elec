import "server-only";

/** Limite simple en mémoire (un seul conteneur) : `max` échecs par clé sur `windowMs`. */
const buckets = new Map<string, { count: number; since: number }>();

export function isBlocked(key: string, max: number, windowMs: number): number | null {
  const b = buckets.get(key);
  if (!b || Date.now() - b.since > windowMs) return null;
  return b.count >= max ? Math.ceil((b.since + windowMs - Date.now()) / 60000) : null;
}

export function recordFailure(key: string, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.since > windowMs) buckets.set(key, { count: 1, since: now });
  else b.count += 1;
}

export const clearFailures = (key: string) => buckets.delete(key);

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "inconnue";

/** Adresse publique du site (derrière Traefik : en-têtes X-Forwarded-*). */
export function publicOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}

// ——— Connexion : 5 erreurs → bloqué 10 minutes ———

export const LOGIN_MAX_FAILS = 5;
export const LOGIN_LOCK_MS = 10 * 60_000;
const locks = new Map<string, { fails: number; lockedUntil: number }>();

/** Minutes restantes si l'une des clés est bloquée, sinon null. */
export function loginLocked(...keys: string[]): number | null {
  const now = Date.now();
  let wait = 0;
  for (const k of keys) {
    const l = locks.get(k);
    if (l && l.lockedUntil > now) wait = Math.max(wait, l.lockedUntil - now);
  }
  return wait ? Math.ceil(wait / 60_000) : null;
}

/** Enregistre une erreur ; à la 5e, bloque 10 minutes. Renvoie le nombre d'essais restants (0 = bloqué). */
export function loginFailed(...keys: string[]): number {
  const now = Date.now();
  let left: number = LOGIN_MAX_FAILS;
  for (const k of keys) {
    const l = locks.get(k);
    const cur = !l || (l.lockedUntil && l.lockedUntil <= now) ? { fails: 0, lockedUntil: 0 } : l;
    cur.fails += 1;
    if (cur.fails >= LOGIN_MAX_FAILS) cur.lockedUntil = now + LOGIN_LOCK_MS;
    locks.set(k, cur);
    left = Math.min(left, Math.max(0, LOGIN_MAX_FAILS - cur.fails));
  }
  return left;
}

export function loginSucceeded(...keys: string[]) {
  for (const k of keys) locks.delete(k);
}

/** Masque une adresse pour l'afficher : « ch•••@gmail.com ». */
export const maskEmail = (email: string) => email.replace(/^(.{1,2})[^@]*(@.*)$/, "$1•••$2");
