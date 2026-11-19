import { currentClientId, selectedAccount } from "@/server/auth";
import { json, withDb } from "@/server/http";
import { stateFor } from "@/server/partage";

export const runtime = "nodejs";

/**
 * État du compte affiché : le sien, ou un compte partagé (limité aux compteurs partagés).
 * 401 : non connecté (le navigateur passe en mode démo) ; 403 aucun_acces : plus aucun compte accessible.
 */
export async function GET() {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const state = await stateFor(db, id, await selectedAccount());
    if (state === "aucun_acces") return json({ error: "aucun_acces" }, 403);
    return state ? json(state) : json({ error: "non_connecte" }, 401);
  });
}
