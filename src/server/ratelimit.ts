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
