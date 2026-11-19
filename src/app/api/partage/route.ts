import { currentClientId, selectAccount } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { publicOrigin } from "@/server/ratelimit";
import { ActionError } from "@/server/repo";
import {
  acceptById,
  createReadLink,
  declineInvitation,
  inviteMember,
  leaveAccount,
  resolveAccess,
  revokeMember,
  revokeReadLink,
  sharingOverview,
  updateMember,
} from "@/server/partage";
import { isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/** Page « Partage » : mes membres invités, mes liens de lecture, les comptes partagés avec moi. */
export async function GET() {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    return json(await sharingOverview(db, id));
  });
}

type Body = { action?: string; id?: string | number; email?: string; role?: string; compteurIds?: string[] | null; compteurId?: string };

export async function POST(req: Request) {
  return withDb(async (db) => {
    const id = await currentClientId();
    if (!id) return json({ error: "non_connecte" }, 401);
    const b = (await readJson<Body>(req)) ?? {};
    try {
      switch (b.action) {
        case "inviter": {
          const key = `invite:${id}`;
          if (isBlocked(key, 20, 3600_000)) return json({ error: "trop_de_requetes" }, 429);
          recordFailure(key, 3600_000);
          return json({ ok: true, ...(await inviteMember(db, id, b, publicOrigin(req))) });
        }
        case "modifier":
          await updateMember(db, id, String(b.id), { role: b.role, compteurIds: b.compteurIds });
          break;
        case "retirer":
          await revokeMember(db, id, String(b.id));
          break;
        case "accepter": {
          const owner = await acceptById(db, String(b.id), id);
          await selectAccount(owner); // on ouvre directement le compte partagé
          break;
        }
        case "refuser":
          await declineInvitation(db, String(b.id), id);
          break;
        case "quitter":
          await leaveAccount(db, id, String(b.id));
          await selectAccount(id);
          break;
        case "compte": {
          // Changer de compte affiché : seulement vers un compte accessible
          const r = await resolveAccess(db, id, String(b.id));
          if (!r || r.accountId !== String(b.id)) return json({ error: "acces_refuse" }, 403);
          await selectAccount(r.accountId);
          break;
        }
        case "lien":
          return json({ ok: true, token: await createReadLink(db, id, String(b.compteurId)) });
        case "lien_retirer":
          await revokeReadLink(db, id, Number(b.id));
          break;
        default:
          return json({ error: "requete_invalide" }, 400);
      }
    } catch (e) {
      if (e instanceof ActionError) return json({ error: e.code }, e.status);
      throw e;
    }
    return json({ ok: true, ...(await sharingOverview(db, id)) });
  });
}
