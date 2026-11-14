import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { normalizePhone, setPendingPhone, startClientSession } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { verifyOtp } from "@/server/otp";

export const runtime = "nodejs";

/**
 * Vérifie le code reçu par SMS.
 * - compte existant → session ouverte (« connecte »)
 * - nouveau numéro → téléphone mémorisé 30 min pour finir l'inscription (« nouveau »)
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const body = await readJson<{ phone?: string; code?: string }>(req);
    const phone = normalizePhone(body?.phone ?? "");
    if (!phone || !body?.code) return json({ error: "requete_invalide" }, 400);
    if (!(await verifyOtp(db, phone, body.code))) return json({ error: "code_invalide" }, 401);
    const [c] = await db.select({ id: clients.id }).from(clients).where(eq(clients.telephone, phone));
    if (c) {
      await startClientSession(c.id);
      return json({ status: "connecte" });
    }
    await setPendingPhone(phone);
    return json({ status: "nouveau" });
  });
}
