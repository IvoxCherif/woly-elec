import { getDb } from "@/db";
import { json } from "@/server/http";
import { reconcile } from "@/server/payment";
import { pendingPayments } from "@/server/repo";
import { saspayConfig, verifyWebhook } from "@/server/saspay";
import { reconcilePendingPurchases } from "@/server/recharge";
import { publicOrigin } from "@/server/ratelimit";

export const runtime = "nodejs";

/**
 * Webhook SasPay (événements transaction.*). La signature est vérifiée sur le corps brut.
 * Le webhook sert de signal : les paiements en attente sont revérifiés auprès de SasPay,
 * qui reste la seule source de vérité. Traitement idempotent (un événement peut arriver deux fois).
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const db = await getDb().catch(() => null);
  if (!db) return json({ error: "indisponible" }, 503);
  const { key, webhookSecret } = await saspayConfig(db);
  if (!key || !webhookSecret) {
    console.warn("[paiement] webhook reçu mais SasPay n'est pas configuré");
    return json({ error: "non_configure" }, 503);
  }
  if (!verifyWebhook(raw, req.headers.get("x-webhook-signature"), req.headers.get("x-webhook-timestamp"), webhookSecret)) {
    console.warn("[paiement] webhook refusé : signature invalide ou trop ancienne");
    return json({ error: "signature_invalide" }, 401);
  }

  let event = "";
  try {
    event = String((JSON.parse(raw) as { event?: string }).event ?? "");
  } catch {
    return json({ error: "corps_invalide" }, 400);
  }
  console.log(`[paiement] webhook SasPay reçu : ${event}`);
  if (event === "webhook.test") return json({ ok: true });
  if (event.startsWith("transaction.")) {
    // SasPay attend une réponse en moins de 15 s : quelques vérifications suffisent (les plus récentes d'abord)
    const pending = await pendingPayments(db);
    for (const p of pending.slice(0, 10)) await reconcile(db, key, p);
    // Recharges Woyofal achetées dans l'application : paiement confirmé → achat chez DexPay
    await reconcilePendingPurchases(db, publicOrigin(req), 5);
  }
  return json({ ok: true });
}
