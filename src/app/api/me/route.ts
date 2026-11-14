import { currentClientId } from "@/server/auth";
import { json, withDb } from "@/server/http";
import { buildState } from "@/server/repo";

export const runtime = "nodejs";

/** État complet du compte connecté. 401 : non connecté (le navigateur passe en mode démo). */
export async function GET() {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const state = await buildState(db, id);
    return state ? json(state) : json({ error: "non_connecte" }, 401);
  });
}
