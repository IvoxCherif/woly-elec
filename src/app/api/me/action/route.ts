import type { Action } from "@/lib/actions";
import { currentClientId, selectedAccount } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { checkMemberAction, resolveAccess, stateFor } from "@/server/partage";
import { applyAction } from "@/server/repo";

export const runtime = "nodejs";

/**
 * Applique une action (relevé, recharge, compteur…) et renvoie l'état à jour.
 * Les préférences personnelles (user.update) s'appliquent toujours à la personne connectée ;
 * les autres actions vont au compte affiché, selon les droits du membre (consulter / gérer).
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const action = await readJson<Action>(req);
    if (!action || typeof action.type !== "string") return json({ error: "requete_invalide" }, 400);
    const wanted = await selectedAccount();
    if (action.type === "user.update") await applyAction(db, id, action);
    else {
      const r = await resolveAccess(db, id, wanted);
      if (!r) return json({ error: "aucun_acces" }, 403);
      const target = checkMemberAction(r, action as { type: string; meterId?: string });
      await applyAction(db, target, action);
    }
    const state = await stateFor(db, id, wanted);
    if (state === "aucun_acces") return json({ error: "aucun_acces" }, 403);
    return json(state);
  });
}
