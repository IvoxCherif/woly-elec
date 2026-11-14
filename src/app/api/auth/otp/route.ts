import { normalizePhone } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { requestOtp } from "@/server/otp";

export const runtime = "nodejs";

/** Envoie un code de connexion à 6 chiffres au numéro donné. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const body = await readJson<{ phone?: string }>(req);
    const phone = normalizePhone(body?.phone ?? "");
    if (!phone) return json({ error: "telephone_invalide" }, 400);
    const r = await requestOtp(db, phone);
    if (!r.ok) return json({ error: r.error }, r.error === "trop_de_codes" ? 429 : 503);
    return json({ sent: true, demoCode: r.demoCode });
  });
}
