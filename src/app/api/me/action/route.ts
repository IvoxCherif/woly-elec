import type { Action } from "@/lib/actions";
import { currentClientId } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { applyAction, buildState } from "@/server/repo";

export const runtime = "nodejs";

/** Applique une action du compte (relevé, recharge, compteur…) et renvoie l'état à jour. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const action = await readJson<Action>(req);
    if (!action || typeof action.type !== "string") return json({ error: "requete_invalide" }, 400);
    await applyAction(db, id, action);
    return json(await buildState(db, id));
  });
}
