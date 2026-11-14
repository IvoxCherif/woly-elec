import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { hashPassword } from "@/lib/admin-password";
import { normalizeEmail, startClientSession } from "@/server/auth";
import { checkEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";

export const runtime = "nodejs";

/** Mot de passe oublié : code reçu par e-mail + nouveau mot de passe, puis connexion. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const body = await readJson<{ email?: string; code?: string; password?: string }>(req);
    const email = normalizeEmail(body?.email ?? "");
    const password = String(body?.password ?? "");
    if (!email || !body?.code) return json({ error: "requete_invalide" }, 400);
    if (password.length < 8 || password.length > 200) return json({ error: "mot_de_passe_court" }, 400);
    if (!(await checkEmailCode(db, "reinitialisation", email, body.code))) return json({ error: "code_invalide" }, 401);
    const [c] = await db
      .update(clients)
      .set({ motDePasseHash: await hashPassword(password), emailVerifie: true })
      .where(eq(clients.email, email))
      .returning({ id: clients.id });
    if (!c) return json({ error: "code_invalide" }, 401);
    await startClientSession(c.id);
    return json({ ok: true });
  });
}
