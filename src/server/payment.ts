import "server-only";
import type { DB } from "@/db";
import { settlePayment } from "./repo";
import { checkoutStatus, SaspayError } from "./saspay";

type PaymentRow = { id: string; checkoutId: string | null; statut: string; createdAt: Date };

/**
 * Revérifie un paiement en attente auprès de SasPay et applique le résultat.
 * Seul le statut lu chez SasPay compte (jamais le retour du navigateur ni le contenu du webhook).
 */
export async function reconcile(db: DB, key: string, p: PaymentRow): Promise<"confirme" | "echec" | "annule" | "en_attente"> {
  if (p.statut !== "en_attente") return p.statut as "confirme" | "echec" | "annule";
  if (!p.checkoutId) {
    // Session jamais créée (erreur SasPay au lancement) : abandon après 1 heure
    if (Date.now() - p.createdAt.getTime() > 3600_000) await settlePayment(db, p.id, "echec");
    return Date.now() - p.createdAt.getTime() > 3600_000 ? "echec" : "en_attente";
  }
  try {
    const s = await checkoutStatus(key, p.checkoutId);
    if (s.status === "PAID" && s.transaction_status === "SUCCESS") {
      if (await settlePayment(db, p.id, "confirme", s.transaction_id)) console.log(`[paiement] confirmé par SasPay : paiement ${p.id}`);
      return "confirme";
    }
    if (s.status === "EXPIRED" || s.status === "CANCELLED") {
      if (await settlePayment(db, p.id, "annule", s.transaction_id)) console.log(`[paiement] abandonné (${s.status}) : paiement ${p.id}`);
      return "annule";
    }
    console.log(`[paiement] toujours en attente chez SasPay (${s.status}/${s.transaction_status ?? "—"}) : paiement ${p.id}`);
    return "en_attente"; // paiement en cours, ou échec que le client peut réessayer sur la page SasPay
  } catch (e) {
    if (e instanceof SaspayError) console.error(`[paiement] vérification SasPay impossible : ${e.status} ${e.code}`);
    else console.error("[paiement] SasPay injoignable", (e as Error).message);
    return "en_attente";
  }
}
