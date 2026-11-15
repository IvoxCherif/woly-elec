import { json, readJson, withDb } from "@/server/http";
import { meterNumberTaken } from "@/server/repo";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/** Vérifie pendant l'inscription qu'un compteur n'est pas déjà enregistré sur Woly Elec. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const key = `check-meter:${clientIp(req)}`;
    if (isBlocked(key, 30, 15 * 60_000)) return json({ error: "trop_de_requetes" }, 429);
    recordFailure(key, 15 * 60_000);
    const body = await readJson<{ numero?: string }>(req);
    const numero = String(body?.numero ?? "");
    if (numero.replace(/\D/g, "").length < 8) return json({ error: "compteur_invalide" }, 400);
    return json({ disponible: !(await meterNumberTaken(db, numero)) });
  });
}
