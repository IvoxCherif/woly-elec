import { normalizeEmail } from "@/server/auth";
import { sendEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/**
 * Mot de passe administrateur oublié : envoie un code à 6 chiffres, uniquement à l'adresse ADMIN_EMAIL.
 * Réponse identique quelle que soit l'adresse saisie (on ne révèle pas l'adresse admin).
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const ipKey = `admin-reset:${clientIp(req)}`;
    if (isBlocked(ipKey, 5, 3600_000)) return json({ error: "trop_de_codes" }, 429);
    recordFailure(ipKey, 3600_000);
    const admin = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
    if (!admin || !process.env.ADMIN_PASSWORD_HASH) return json({ error: "non_configure" }, 503);
    const body = await readJson<{ email?: string }>(req);
    const email = normalizeEmail(body?.email ?? "");
    if (email !== admin) return json({ sent: true });
    const r = await sendEmailCode(db, "admin", admin);
    if (!r.ok) return json({ error: r.error }, r.error === "trop_de_codes" ? 429 : 503);
    return json({ sent: true, demoCode: r.demoCode });
  });
}
