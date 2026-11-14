import { normalizeEmail, setPendingVerifiedEmail } from "@/server/auth";
import { checkEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";

export const runtime = "nodejs";

/** Inscription : vérifie le code reçu par e-mail, puis mémorise l'adresse confirmée (30 min). */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const body = await readJson<{ email?: string; code?: string }>(req);
    const email = normalizeEmail(body?.email ?? "");
    if (!email || !body?.code) return json({ error: "requete_invalide" }, 400);
    if (!(await checkEmailCode(db, "verification", email, body.code))) return json({ error: "code_invalide" }, 401);
    await setPendingVerifiedEmail(email);
    return json({ ok: true });
  });
}
