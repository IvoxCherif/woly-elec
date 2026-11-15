import { eq } from "drizzle-orm";
import { clients } from "@/db/schema";
import { currentClientId } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { clientIp, isBlocked, publicOrigin, recordFailure } from "@/server/ratelimit";
import { attachCheckout, createPendingPayment, priceOrder, settlePayment, paymentByReference } from "@/server/repo";
import { createCheckout, paymentMode, saspayConfig, SaspayError } from "@/server/saspay";

export const runtime = "nodejs";

/**
 * Lance un paiement en ligne SasPay : le prix est calculé par le serveur, un paiement « en attente » est créé,
 * puis le client est redirigé vers la page de paiement hébergée (Wave, Orange Money, Free Money, carte).
 * L'abonnement n'est activé qu'après confirmation par SasPay (webhook ou vérification du statut).
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const clientId = await currentClientId();
    if (!clientId) return json({ error: "non_connecte" }, 401);
    if ((await paymentMode(db)) !== "saspay") return json({ error: "paiement_en_ligne_inactif" }, 409);
    const ipKey = `paiement:${clientIp(req)}`;
    if (isBlocked(ipKey, 15, 3600_000)) return json({ error: "trop_de_requetes" }, 429);

    const body = await readJson<{ pack?: string; cycle?: string; meters?: number }>(req);
    const order = await priceOrder(db, clientId, { pack: body?.pack, cycle: body?.cycle, meters: body?.meters ?? 1 });
    const [c] = await db.select({ nom: clients.nom, email: clients.email, tel: clients.telephone }).from(clients).where(eq(clients.id, clientId));
    const { key } = await saspayConfig(db);
    if (!key) return json({ error: "paiement_en_ligne_inactif" }, 409);

    recordFailure(ipKey, 3600_000);
    const reference = await createPendingPayment(db, clientId, order);
    try {
      const session = await createCheckout(key, {
        amount: order.amount,
        description: `Woly Elec · ${order.libelle} · ${reference}`,
        email: c?.email || "support@wolyelec.com",
        name: c?.nom || c?.email || "Client Woly Elec",
        phone: c?.tel ?? "",
        returnUrl: `${publicOrigin(req)}/app/abonnement/retour?ref=${encodeURIComponent(reference)}`,
        metadata: { reference, client: clientId },
      });
      if (!session.id || !session.checkout_url?.startsWith("https://")) throw new SaspayError(502, "reponse_invalide");
      await attachCheckout(db, reference, session.id);
      console.log(`[paiement] session SasPay créée : ${reference} (${order.amount} F)`);
      return json({ url: session.checkout_url, reference });
    } catch (e) {
      const p = await paymentByReference(db, reference);
      if (p) await settlePayment(db, p.id, "echec");
      console.error("[paiement] création de la session SasPay impossible", e instanceof SaspayError ? `${e.status} ${e.code}` : (e as Error).message);
      return json({ error: "paiement_indisponible" }, 502);
    }
  });
}
