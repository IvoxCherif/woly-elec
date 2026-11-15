import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import { adminPushAbonnements, clients, parametres, pushAbonnements } from "@/db/schema";
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
  await db.delete(adminPushAbonnements);
  const stored = { publicKey: fresh.publicKey, privateKey: seal("push", fresh.privateKey) };
  await db.insert(parametres).values({ cle: KEY, valeur: stored }).onConflictDoUpdate({ target: parametres.cle, set: { valeur: stored, updatedAt: new Date() } });
  return (g.__wolyVapid = fresh);
}

export type PushInput = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

function parseSub(sub: PushInput) {
  const endpoint = String(sub?.endpoint ?? "");
  const p256dh = String(sub?.keys?.p256dh ?? "");
  const auth = String(sub?.keys?.auth ?? "");
  if (!/^https:\/\/[^\s]{10,2000}$/.test(endpoint) || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) throw new Error("abonnement_invalide");
  return { endpoint, p256dh, auth };
}

/** Enregistre (ou rattache au client) l'abonnement d'un navigateur. */
export async function savePushSubscription(db: DB, clientId: string, sub: PushInput, appareil = "") {
  const { endpoint, p256dh, auth } = parseSub(sub);
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
    if (!subs.length) {
      if (opts.force) console.log("[push] test demandé mais aucun téléphone abonné pour ce client");
      return 0;
    }
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
          else console.error(`[push] envoi refusé par le service de notifications (${status ?? "réseau"}) ${(e as { body?: string }).body ?? (e as Error).message}`.slice(0, 300));
        }
      }),
    );
    console.log(`[push] « ${m.title} » : ${delivered}/${subs.length} téléphone(s) atteint(s)${gone.length ? `, ${gone.length} désabonné(s)` : ""}`);
    if (gone.length) await db.delete(pushAbonnements).where(inArray(pushAbonnements.id, gone));
    if (delivered) await db.update(pushAbonnements).set({ lastUsedAt: new Date() }).where(eq(pushAbonnements.clientId, clientId));
    return delivered;
  } catch (e) {
    console.error("[push] erreur", (e as Error).message);
    return 0;
  }
}

// ——— Notifications de l'administrateur (nouveaux clients, paiements, support) ———

export type AdminEvent = "inscription" | "paiement" | "support" | "loterie";
export type AdminPrefs = Record<AdminEvent, boolean>;
const PREFS_KEY = "admin_notifs";
const DEFAULT_PREFS: AdminPrefs = { inscription: true, paiement: true, support: true, loterie: true };

export async function adminPrefs(db: DB): Promise<AdminPrefs> {
  const [row] = await db.select().from(parametres).where(eq(parametres.cle, PREFS_KEY));
  return { ...DEFAULT_PREFS, ...((row?.valeur as Partial<AdminPrefs> | undefined) ?? {}) };
}

export async function saveAdminPrefs(db: DB, p: Partial<AdminPrefs>) {
  const cur = await adminPrefs(db);
  const next = { ...cur };
  for (const k of Object.keys(DEFAULT_PREFS) as AdminEvent[]) if (typeof p[k] === "boolean") next[k] = p[k] as boolean;
  await db.insert(parametres).values({ cle: PREFS_KEY, valeur: next }).onConflictDoUpdate({ target: parametres.cle, set: { valeur: next, updatedAt: new Date() } });
  return next;
}

export async function saveAdminSubscription(db: DB, sub: PushInput, appareil = "") {
  const v = { ...parseSub(sub), appareil: appareil.slice(0, 120) };
  await db.insert(adminPushAbonnements).values(v).onConflictDoUpdate({ target: adminPushAbonnements.endpoint, set: { p256dh: v.p256dh, auth: v.auth, appareil: v.appareil } });
}

export async function removeAdminSubscription(db: DB, endpoint: string) {
  await db.delete(adminPushAbonnements).where(eq(adminPushAbonnements.endpoint, endpoint));
}

export async function adminDevices(db: DB, endpoint?: string) {
  const rows = await db.select({ endpoint: adminPushAbonnements.endpoint }).from(adminPushAbonnements);
  return { appareils: rows.length, inscrit: !!endpoint && rows.some((r) => r.endpoint === endpoint) };
}

/** Envoie une notification sur les téléphones de l'administrateur si ce type d'événement est activé. Ne lève jamais d'erreur. */
export async function sendAdminPush(db: DB, event: AdminEvent | "test", m: PushMessage): Promise<number> {
  try {
    if (event !== "test" && !(await adminPrefs(db))[event]) return 0;
    const subs = await db.select().from(adminPushAbonnements);
    if (!subs.length) return 0;
    const { publicKey, privateKey } = await vapidKeys(db);
    const payload = JSON.stringify({ title: m.title, body: m.body, url: m.url ?? "/admin", tag: m.tag });
    let delivered = 0;
    const gone: number[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { vapidDetails: { subject: SUBJECT, publicKey, privateKey }, TTL: 24 * 3600, urgency: "normal" });
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(s.id);
          else console.error(`[push-admin] envoi refusé (${status ?? "réseau"})`);
        }
      }),
    );
    console.log(`[push-admin] « ${m.title} » : ${delivered}/${subs.length} téléphone(s)`);
    if (gone.length) await db.delete(adminPushAbonnements).where(inArray(adminPushAbonnements.id, gone));
    if (delivered) await db.update(adminPushAbonnements).set({ lastUsedAt: new Date() });
    return delivered;
  } catch (e) {
    console.error("[push-admin] erreur", (e as Error).message);
    return 0;
  }
}
