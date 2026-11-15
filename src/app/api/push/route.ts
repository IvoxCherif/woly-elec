import { currentClientId } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { pushDeviceCount, removePushSubscription, savePushSubscription, sendPush, vapidKeys, type PushInput } from "@/server/push";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/** Clé publique VAPID et nombre d'appareils abonnés du client connecté. */
export async function GET() {
  return withDb(async (db) => {
    const clientId = await currentClientId();
    if (!clientId) return json({ error: "non_connecte" }, 401);
    return json({ publicKey: (await vapidKeys(db)).publicKey, appareils: await pushDeviceCount(db, clientId) });
  });
}

/** { subscription } : abonne ce navigateur ; { test: true } : envoie une notification de test. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const clientId = await currentClientId();
    if (!clientId) return json({ error: "non_connecte" }, 401);
    const body = await readJson<{ subscription?: PushInput; test?: boolean }>(req);
    if (body?.test) {
      const key = `push-test:${clientIp(req)}`;
      if (isBlocked(key, 10, 3600_000)) return json({ error: "trop_de_requetes" }, 429);
      recordFailure(key, 3600_000);
      const n = await sendPush(db, clientId, { title: "Woly Elec", body: "Les notifications fonctionnent : vous recevrez ici vos alertes avant coupure, vos paiements et vos rappels.", url: "/app/alertes", tag: "test" }, { force: true });
      return json({ envoyees: n });
    }
    try {
      await savePushSubscription(db, clientId, body?.subscription ?? {}, req.headers.get("user-agent") ?? "");
    } catch {
      return json({ error: "abonnement_invalide" }, 400);
    }
    return json({ ok: true, appareils: await pushDeviceCount(db, clientId) });
  });
}

/** { endpoint } : désabonne ce navigateur. */
export async function DELETE(req: Request) {
  return withDb(async (db) => {
    const clientId = await currentClientId();
    if (!clientId) return json({ error: "non_connecte" }, 401);
    const body = await readJson<{ endpoint?: string }>(req);
    if (body?.endpoint) await removePushSubscription(db, clientId, String(body.endpoint));
    return json({ ok: true, appareils: await pushDeviceCount(db, clientId) });
  });
}
