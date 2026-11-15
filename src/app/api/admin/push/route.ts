import { isAdmin } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { adminDevices, adminPrefs, removeAdminSubscription, saveAdminPrefs, saveAdminSubscription, sendAdminPush, vapidKeys, type AdminPrefs, type PushInput } from "@/server/push";

export const runtime = "nodejs";

/** Clé publique, nombre de téléphones de l'administrateur, ce téléphone est-il inscrit (?endpoint=), préférences. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return json({ error: "non_autorise" }, 401);
  const endpoint = new URL(req.url).searchParams.get("endpoint") ?? undefined;
  return withDb(async (db) => json({ publicKey: (await vapidKeys(db)).publicKey, ...(await adminDevices(db, endpoint)), prefs: await adminPrefs(db) }));
}

/** { subscription } : inscrit ce téléphone ; { test: true } : notification de test ; { prefs } : types de notifications. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return json({ error: "non_autorise" }, 401);
  return withDb(async (db) => {
    const body = await readJson<{ subscription?: PushInput; test?: boolean; prefs?: Partial<AdminPrefs> }>(req);
    if (body?.test) {
      const n = await sendAdminPush(db, "test", { title: "Woly Elec · Admin", body: "Les notifications fonctionnent : nouveaux clients, abonnements et demandes de support arriveront ici.", url: "/admin", tag: "admin-test" });
      return json({ envoyees: n });
    }
    if (body?.prefs) return json({ ok: true, prefs: await saveAdminPrefs(db, body.prefs) });
    try {
      await saveAdminSubscription(db, body?.subscription ?? {}, req.headers.get("user-agent") ?? "");
    } catch {
      return json({ error: "abonnement_invalide" }, 400);
    }
    return json({ ok: true, ...(await adminDevices(db)) });
  });
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return json({ error: "non_autorise" }, 401);
  return withDb(async (db) => {
    const body = await readJson<{ endpoint?: string }>(req);
    if (body?.endpoint) await removeAdminSubscription(db, String(body.endpoint));
    return json({ ok: true, ...(await adminDevices(db)) });
  });
}
