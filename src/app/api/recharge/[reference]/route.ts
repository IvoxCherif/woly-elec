import { currentClientId } from "@/server/auth";
import { json, withDb } from "@/server/http";
import { publicOrigin } from "@/server/ratelimit";
import { publicPurchase, purchaseFor, reconcilePurchase } from "@/server/recharge";

export const runtime = "nodejs";

/** Suivi d'une recharge achetée : revérifie le paiement et l'achat, renvoie le code une fois livré. */
export async function GET(req: Request, { params }: { params: Promise<{ reference: string }> }) {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const { reference } = await params;
    const a = await purchaseFor(db, id, reference);
    if (!a) return json({ error: "achat_introuvable" }, 404);
    if (["en_attente", "paye", "en_cours"].includes(a.statut)) await reconcilePurchase(db, a, publicOrigin(req));
    const now = await purchaseFor(db, id, reference);
    return json(publicPurchase(now ?? a));
  });
}
