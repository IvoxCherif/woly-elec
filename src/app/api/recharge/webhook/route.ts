import { getDb } from "@/db";
import { dexpayConfig, verifyDexpayWebhook } from "@/server/dexpay";
import { json } from "@/server/http";
import { publicOrigin } from "@/server/ratelimit";
import { reconcilePendingPurchases } from "@/server/recharge";

export const runtime = "nodejs";

/**
 * Webhook DexPay (bill_payment.completed…) : signature vérifiée sur le corps brut, puis les achats en cours
 * sont revérifiés auprès de DexPay, qui reste la seule source de vérité. Traitement idempotent.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const db = await getDb().catch(() => null);
  if (!db) return json({ error: "indisponible" }, 503);
  const c = await dexpayConfig(db);
  if (!c.key) return json({ error: "non_configure" }, 503);
  if (c.webhookSecret && !verifyDexpayWebhook(raw, req.headers.get("x-dexpay-signature"), c.webhookSecret)) {
    console.warn("[recharge] webhook DexPay refusé : signature invalide");
    return json({ error: "signature_invalide" }, 401);
  }
  console.log("[recharge] webhook DexPay reçu");
  await reconcilePendingPurchases(db, publicOrigin(req));
  return json({ ok: true });
}
