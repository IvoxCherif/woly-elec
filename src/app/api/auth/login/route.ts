import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { verifyPassword } from "@/lib/admin-password";
import { deviceId, normalizeEmail, setPending2fa } from "@/server/auth";
import { sendEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";
import { clientIp, isBlocked, loginFailed, loginLocked, loginSucceeded, maskEmail, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

const IP_WINDOW = 10 * 60_000;
// Empreinte factice : la vérification prend le même temps, que le compte existe ou non
const DUMMY = "scrypt:00000000000000000000000000000000:" + "0".repeat(128);

/**
 * Connexion, étape 1 : e-mail et mot de passe.
 * 5 erreurs (sur cet appareil ou pour cette adresse) → connexion bloquée 10 minutes.
 * Identifiants corrects → un code à 6 chiffres est envoyé par e-mail (étape 2 : /api/auth/login-code).
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const body = await readJson<{ email?: string; password?: string }>(req);
    const email = normalizeEmail(body?.email ?? "");
    const password = String(body?.password ?? "");
    const keys = [`mail:${email}`, `dev:${await deviceId()}`];
    const ipKey = `login-ip:${clientIp(req)}`;
    const wait = loginLocked(...keys) ?? isBlocked(ipKey, 30, IP_WINDOW);
    if (wait) return json({ error: "bloque", minutes: wait }, 429);
    if (!email || !password || password.length > 200) return json({ error: "identifiants" }, 401);

    const [c] = await db.select({ id: clients.id, hash: clients.motDePasseHash, google: clients.googleId }).from(clients).where(eq(clients.email, email));
    const ok = await verifyPassword(password, c?.hash ?? DUMMY);
    if (!c || !c.hash || !ok) {
      recordFailure(ipKey, IP_WINDOW);
      const left = loginFailed(...keys);
      if (left === 0) return json({ error: "bloque", minutes: 10 }, 429);
      // Compte créé avec Google, sans mot de passe : on l'indique pour orienter vers le bon bouton
      if (c && !c.hash && c.google) return json({ error: "compte_google", essais: left }, 401);
      return json({ error: "identifiants", essais: left }, 401);
    }
    loginSucceeded(...keys);
    const sent = await sendEmailCode(db, "connexion", email);
    if (!sent.ok) return json({ error: sent.error }, sent.error === "trop_de_codes" ? 429 : 503);
    await setPending2fa({ clientId: c.id, email, via: "email" });
    return json({ etape: "code", email: maskEmail(email), demoCode: sent.demoCode });
  });
}
