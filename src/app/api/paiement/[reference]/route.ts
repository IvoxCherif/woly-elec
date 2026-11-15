import { currentClientId } from "@/server/auth";
import { json, withDb } from "@/server/http";
import { reconcile } from "@/server/payment";
import { buildState, paymentByReference } from "@/server/repo";
import { saspayConfig } from "@/server/saspay";

export const runtime = "nodejs";

/** Statut d'un paiement du client connecté, revérifié auprès de SasPay tant qu'il est en attente. */
export async function GET(_req: Request, { params }: { params: Promise<{ reference: string }> }) {
  return withDb(async (db) => {
    const clientId = await currentClientId();
    if (!clientId) return json({ error: "non_connecte" }, 401);
    const { reference } = await params;
    const p = await paymentByReference(db, reference);
    if (!p || p.clientId !== clientId) return json({ error: "paiement_introuvable" }, 404);
    let statut = p.statut;
    if (statut === "en_attente") {
      const { key } = await saspayConfig(db);
      if (key) statut = await reconcile(db, key, p);
    }
    return json({ statut, montant: p.montant, libelle: p.libelle, reference: p.reference, state: await buildState(db, clientId) });
  });
}
