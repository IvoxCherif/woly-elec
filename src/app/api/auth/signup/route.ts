import { PENDING_COOKIE, pendingPhone, startClientSession } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { signup, type SignupInput } from "@/server/repo";
import { cookies } from "next/headers";

export const runtime = "nodejs";

/** Termine l'inscription d'un numéro vérifié par code SMS : compte, compteur, relevé, recharge, essai. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const phone = await pendingPhone();
    if (!phone) return json({ error: "telephone_non_verifie" }, 401);
    const body = await readJson<Omit<SignupInput, "phone">>(req);
    if (!body?.meter) return json({ error: "requete_invalide" }, 400);
    const id = await signup(db, { ...body, phone });
    await startClientSession(id);
    (await cookies()).delete(PENDING_COOKIE);
    return json({ ok: true });
  });
}
