import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { normalizeEmail } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/** Vérifie dès la première étape de l'inscription que l'adresse n'a pas déjà un compte. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const key = `check:${clientIp(req)}`;
    if (isBlocked(key, 30, 15 * 60_000)) return json({ error: "trop_de_requetes" }, 429);
    recordFailure(key, 15 * 60_000);
    const body = await readJson<{ email?: string }>(req);
    const email = normalizeEmail(body?.email ?? "");
    if (!email) return json({ error: "email_invalide" }, 400);
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.email, email));
    return json({ disponible: !c });
  });
}
