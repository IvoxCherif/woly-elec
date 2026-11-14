import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { verifyPassword } from "@/lib/admin-password";
import { normalizeEmail, startClientSession } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { clearFailures, clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

const WINDOW = 15 * 60_000;
// Empreinte factice : la vérification prend le même temps, que le compte existe ou non
const DUMMY = "scrypt:00000000000000000000000000000000:" + "0".repeat(128);

/** Connexion par e-mail et mot de passe. 10 échecs par IP et 5 par adresse sur 15 minutes. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const body = await readJson<{ email?: string; password?: string }>(req);
    const email = normalizeEmail(body?.email ?? "");
    const password = String(body?.password ?? "");
    if (!email || !password || password.length > 200) return json({ error: "identifiants" }, 401);

    const ipKey = `ip:${clientIp(req)}`;
    const mailKey = `mail:${email}`;
    const wait = isBlocked(ipKey, 10, WINDOW) ?? isBlocked(mailKey, 5, WINDOW);
    if (wait) return json({ error: "bloque", minutes: wait }, 429);

    const [c] = await db.select({ id: clients.id, hash: clients.motDePasseHash, google: clients.googleId }).from(clients).where(eq(clients.email, email));
    const ok = await verifyPassword(password, c?.hash ?? DUMMY);
    if (!c || !c.hash || !ok) {
      recordFailure(ipKey, WINDOW);
      recordFailure(mailKey, WINDOW);
      // Compte créé avec Google, sans mot de passe : on l'indique pour orienter vers le bon bouton
      if (c && !c.hash && c.google) return json({ error: "compte_google" }, 401);
      return json({ error: "identifiants" }, 401);
    }
    clearFailures(mailKey);
    await startClientSession(c.id);
    return json({ ok: true });
  });
}
