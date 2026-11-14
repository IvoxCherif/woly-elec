import { adminIdentifier, isAdminIdentifier } from "@/server/admin-identity";
import { sendEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";
import { SUPPORT_EMAIL } from "@/server/mail";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/**
 * Mot de passe administrateur oublié : si l'identifiant saisi est celui de l'admin, un code à 6 chiffres
 * est envoyé dans la boîte support@wolyelec.com. Réponse identique quel que soit l'identifiant saisi.
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const ipKey = `admin-reset:${clientIp(req)}`;
    if (isBlocked(ipKey, 5, 3600_000)) return json({ error: "trop_de_codes" }, 429);
    recordFailure(ipKey, 3600_000);
    if (!adminIdentifier() || !process.env.ADMIN_PASSWORD_HASH) return json({ error: "non_configure" }, 503);
    const body = await readJson<{ identifiant?: string }>(req);
    if (!isAdminIdentifier(body?.identifiant)) {
      // Journal serveur seulement (sans l'identifiant saisi) : utile si l'admin ne reçoit rien
      console.info("[admin] mot de passe oublié : identifiant différent de celui de l'admin, aucun e-mail envoyé");
      return json({ sent: true });
    }
    const r = await sendEmailCode(db, "admin", SUPPORT_EMAIL);
    console.info(`[admin] mot de passe oublié : code ${r.ok ? `envoyé à ${SUPPORT_EMAIL}` : `non envoyé (${r.error})`}`);
    if (!r.ok) return json({ error: r.error }, r.error === "trop_de_codes" ? 429 : 503);
    return json({ sent: true, demoCode: r.demoCode });
  });
}
