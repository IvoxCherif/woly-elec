import { and, eq } from "drizzle-orm";
import { compteurs } from "@/db/schema";
import { currentClientId } from "@/server/auth";
import { readMeterPhoto } from "@/server/claude";
import { json, readJson, withDb } from "@/server/http";
import { recordIaCall } from "@/server/repo";
import { isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

const TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type ImageType = (typeof TYPES)[number];

/**
 * Lecture d'un relevé en photo : le navigateur envoie l'image réduite (JPEG, ≤ 1600 px),
 * Claude lit le nombre affiché. Rien n'est enregistré : le client vérifie la valeur avant d'enregistrer son relevé.
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const clientId = await currentClientId();
    if (!clientId) return json({ error: "non_connecte" }, 401);
    const key = `photo:${clientId}`;
    if (isBlocked(key, 30, 3600_000)) return json({ error: "trop_de_photos" }, 429);

    const body = await readJson<{ meterId?: string; image?: string }>(req);
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body?.image ?? ""));
    if (!m || !body?.meterId) return json({ error: "photo_invalide" }, 400);
    if (m[2].length > 5_000_000) return json({ error: "photo_trop_lourde" }, 413);
    const [meter] = await db.select({ id: compteurs.id }).from(compteurs).where(and(eq(compteurs.id, body.meterId), eq(compteurs.clientId, clientId)));
    if (!meter) return json({ error: "compteur_introuvable" }, 404);

    recordFailure(key, 3600_000); // compte chaque photo envoyée
    const r = await readMeterPhoto(m[2], m[1] as ImageType);
    if (r.usage) await recordIaCall(db, { clientId, meterId: meter.id, ...r.usage, statut: r.ok ? "ok" : "refus" });
    if (!r.ok) return json({ error: r.reason === "non_configure" ? "photo_indisponible" : "lecture_impossible" }, 503);
    return json(r.reading);
  });
}
