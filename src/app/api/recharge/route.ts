import { currentClientId } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { isBlocked, publicOrigin, recordFailure } from "@/server/ratelimit";
import { ActionError } from "@/server/repo";
import { checkMeter, myPurchases, rechargeOffer, RECHARGE_MAX, RECHARGE_MIN, startPurchase } from "@/server/recharge";

export const runtime = "nodejs";

/** Vente de recharges Woyofal : disponible ? frais ? dernières recharges achetées par le client. */
export async function GET() {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const offre = await rechargeOffer(db);
    return json({ offre: offre && { ...offre, min: RECHARGE_MIN, max: RECHARGE_MAX }, achats: offre ? await myPurchases(db, id) : [] });
  });
}

/** { action: "verifier", meterId } : nom du titulaire chez Senelec ; { action: "acheter", meterId, montant } : page de paiement. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const key = `recharge:${id}`;
    if (isBlocked(key, 30, 3600_000)) return json({ error: "trop_de_requetes" }, 429);
    recordFailure(key, 3600_000);
    const b = await readJson<{ action?: string; meterId?: string; montant?: number }>(req);
    try {
      if (b?.action === "verifier") return json(await checkMeter(db, id, String(b.meterId ?? "")));
      if (b?.action === "acheter") return json(await startPurchase(db, id, b, publicOrigin(req)));
      return json({ error: "requete_invalide" }, 400);
    } catch (e) {
      if (e instanceof ActionError) return json({ error: e.code }, e.status);
      throw e;
    }
  });
}
