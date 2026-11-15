import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { clients, parametres, pushAbonnements } from "@/db/schema";
import { seal, unseal } from "./vault";

/**
 * Notifications push (Web Push, standard des navigateurs) : gratuites, sans fournisseur tiers.
 * Les clés VAPID sont générées une fois puis enregistrées en base (clé privée chiffrée).
 */

const KEY = "push_vapid";
const SUBJECT = "mailto:support@wolyelec.com";

type Vapid = { publicKey: string; privateKey: string };
const g = globalThis as unknown as { __wolyVapid?: Vapid };

export async function vapidKeys(db: DB): Promise<Vapid> {
  if (g.__wolyVapid) return g.__wolyVapid;
  const [row] = await db.select().from(parametres).where(eq(parametres.cle, KEY));
  const v = row?.valeur as { publicKey?: string; privateKey?: string } | undefined;
  const privateKey = unseal("push", v?.privateKey);
  if (v?.publicKey && privateKey) return (g.__wolyVapid = { publicKey: v.publicKey, privateKey });
  // Première utilisation (ou secret serveur changé) : nouvelles clés, les anciens abonnements ne sont plus valables
  const fresh = webpush.generateVAPIDKeys();
  await db.delete(pushAbonnements);
  const stored = { publicKey: fresh.publicKey, privateKey: seal("push", fresh.privateKey) };
  await db.insert(parametres).values({ cle: KEY, valeur: stored }).onConflictDoUpdate({ target: parametres.cle, set: { valeur: stored, updatedAt: new Date() } });
  return (g.__wolyVapid = fresh);
}

export type PushInput = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

/** Enregistre (ou rattache au client) l'abonnement d'un navigateur. */
export async function savePushSubscription(db: DB, clientId: string, sub: PushInput, appareil = "") {
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\/[^\s]{10,2000}$/.test(endpoint) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) throw new Error("abonnement_invalide");
  const values = { clientId, endpoint, p256dh, auth, appareil: appareil.slice(0, 120) };
  await db.insert(pushAbonnements).values(values).onConflictDoUpdate({ target: pushAbonnements.endpoint, set: { clientId, p256dh, auth, appareil: values.appareil } });
}

export async function removePushSubscription(db: DB, clientId: string, endpoint: string) {
  await db.delete(pushAbonnements).where(and(eq(pushAbonnements.clientId, clientId), eq(pushAbonnements.endpoint, endpoint)));
}

export async function pushDeviceCount(db: DB, clientId: string) {
  return (await db.select({ id: pushAbonnements.id }).from(pushAbonnements).where(eq(pushAbonnements.clientId, clientId))).length;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/**
 * Envoie une notification sur tous les appareils du client. Respecte son choix « Notifications push »
 * (sauf force, pour le test). Les abonnements expirés (404 / 410) sont supprimés. Ne lève jamais d'erreur.
 */
export async function sendPush(db: DB, clientId: string, m: PushMessage, opts: { force?: boolean } = {}): Promise<number> {
  try {
    if (!opts.force) {
      const [c] = await db.select({ canaux: clients.canaux }).from(clients).where(eq(clients.id, clientId));
      if (!c?.canaux?.push) return 0;
    }
    const subs = await db.select().from(pushAbonnements).where(eq(pushAbonnements.clientId, clientId));
    if (!subs.length) return 0;
    const { publicKey, privateKey } = await vapidKeys(db);
    const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url ?? "/app", tag: m.tag });
    let delivered = 0;
    const gone: number[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            vapidDetails: { subject: SUBJECT, publicKey, privateKey },
            TTL: 24 * 3600,
            urgency: "high",
          });
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id); // appareil désabonné ou désinstallé
          else console.error(`[push] envoi impossible (${status ?? "réseau"})`);
        }
      }),
    );
    if (gone.length) await db.delete(pushAbonnements).where(inArray(pushAbonnements.id, gone));
    if (delivered) await db.update(pushAbonnements).set({ lastUsedAt: new Date() }).where(eq(pushAbonnements.clientId, clientId));
    return delivered;
  } catch (e) {
    console.error("[push] erreur", (e as Error).message);
    return 0;
  }
}
