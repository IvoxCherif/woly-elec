import { hashPassword } from "@/lib/admin-password";
import { currentClientId, selectAccount, startClientSession } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { acceptByToken, createMemberAccount, invitationPreview } from "@/server/partage";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";
import { ActionError } from "@/server/repo";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

/** Résumé de l'invitation : qui invite, quels compteurs, l'invité a-t-il déjà un compte, est-il connecté ? */
export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params;
  return withDb(async (db) => {
    const p = await invitationPreview(db, token);
    if (!p) return json({ error: "invitation_invalide" }, 404);
    return json({ ...p, connecte: !!(await currentClientId()) });
  });
}

/**
 * Accepter : connecté → { accepter: true } ; sans compte → { name, password } crée l'accès et connecte.
 * Le lien vient de la boîte mail de l'invité : son adresse est confirmée.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params;
  return withDb(async (db) => {
    const key = `invitation:${clientIp(req)}`;
    if (isBlocked(key, 20, 3600_000)) return json({ error: "trop_de_requetes" }, 429);
    recordFailure(key, 3600_000);
    const body = await readJson<{ accepter?: boolean; name?: string; password?: string }>(req);
    try {
      const me = await currentClientId();
      if (me && body?.accepter) {
        const owner = await acceptByToken(db, token, me);
        await selectAccount(owner);
        return json({ ok: true });
      }
      const name = String(body?.name ?? "").trim();
      const password = String(body?.password ?? "");
      if (name.length < 2) return json({ error: "nom_requis" }, 400);
      if (password.length < 8 || password.length > 200) return json({ error: "mot_de_passe_court" }, 400);
      const id = await createMemberAccount(db, token, { name, passwordHash: await hashPassword(password) });
      await startClientSession(id);
      return json({ ok: true });
    } catch (e) {
      if (e instanceof ActionError) return json({ error: e.code }, e.status);
      throw e;
    }
  });
}
