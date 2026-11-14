import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { normalizeEmail } from "@/server/auth";
import { sendEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/**
 * Envoie un code à 6 chiffres par e-mail.
 * - usage « verification » : inscription (l'adresse ne doit pas déjà avoir un compte)
 * - usage « reinitialisation » : mot de passe oublié (réponse identique que le compte existe ou non)
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const ipKey = `code:${clientIp(req)}`;
    if (isBlocked(ipKey, 15, 3600_000)) return json({ error: "trop_de_codes" }, 429);
    const body = await readJson<{ email?: string; usage?: string }>(req);
    const email = normalizeEmail(body?.email ?? "");
    if (!email) return json({ error: "email_invalide" }, 400);
    const usage = body?.usage === "reinitialisation" ? "reinitialisation" : "verification";
    recordFailure(ipKey, 3600_000);

    const [c] = await db.select({ id: clients.id, hash: clients.motDePasseHash }).from(clients).where(eq(clients.email, email));
    if (usage === "verification" && c) return json({ error: "email_pris" }, 409);
    // Mot de passe oublié : on n'indique pas si l'adresse existe ; aucun code si pas de compte
    if (usage === "reinitialisation" && !c) return json({ sent: true });

    const r = await sendEmailCode(db, usage, email);
    if (!r.ok) return json({ error: r.error }, r.error === "trop_de_codes" ? 429 : 503);
    return json({ sent: true, demoCode: r.demoCode });
  });
}
