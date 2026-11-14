import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { currentClientId, normalizeEmail } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { SUPPORT_EMAIL, sendMail, supportAckMail, supportNotifyMail } from "@/server/mail";
import { createSupportRequest } from "@/server/repo";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/**
 * Demande de support ou réclamation : enregistrée en base, transmise à support@wolyelec.com
 * (réponse directe au client via « Répondre ») et accusé de réception envoyé au client.
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const ipKey = `support:${clientIp(req)}`;
    if (isBlocked(ipKey, 5, 3600_000)) return json({ error: "trop_de_demandes" }, 429);
    const body = await readJson<{ nom?: string; email?: string; categorie?: string; sujet?: string; message?: string }>(req);
    if (!body) return json({ error: "requete_invalide" }, 400);

    const clientId = await currentClientId();
    let email = normalizeEmail(body.email ?? "");
    let nom = String(body.nom ?? "");
    if (clientId) {
      const [c] = await db.select({ email: clients.email, nom: clients.nom }).from(clients).where(eq(clients.id, clientId));
      email = email ?? c?.email ?? null;
      nom = nom || c?.nom || "";
    }
    if (!email) return json({ error: "email_invalide" }, 400);

    const d = await createSupportRequest(db, { clientId, nom, email, categorie: body.categorie ?? "question", sujet: body.sujet ?? "", message: body.message ?? "" });
    recordFailure(ipKey, 3600_000);
    const [notified] = await Promise.all([
      sendMail({ to: SUPPORT_EMAIL, replyTo: email, ...supportNotifyMail({ ...d, client: !!clientId }) }),
      sendMail({ to: email, ...supportAckMail(d.reference, d.sujet) }),
    ]);
    return json({ ok: true, reference: d.reference, emailEnvoye: notified.sent });
  });
}
