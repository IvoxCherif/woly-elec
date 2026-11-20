import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as t from "@/db/schema";
import { isoDate } from "@/lib/format";
import { ActionError, applyAction } from "./repo";
import { billPayment, clientFees, dexpayConfig, DexpayError, inquiryMeter, payRecharge, type BillPayment } from "./dexpay";
import { checkoutStatus, createCheckout, paymentMode, saspayConfig, SaspayError } from "./saspay";
import { meterAccess } from "./partage";
import { sendAdminPush, sendPush } from "./push";

/**
 * Recharges Woyofal achetées dans l'application.
 * 1. le client paie par SasPay (recharge + frais de service) ;
 * 2. une fois le paiement confirmé par SasPay, Woly Elec achète la recharge chez DexPay (clé d'idempotence = l'achat) ;
 * 3. le code de 20 chiffres est remis au client (écran, notification, alerte) et la recharge est enregistrée.
 * En cas d'échec après paiement, l'achat passe « à rembourser » et l'administrateur est prévenu.
 */

export const RECHARGE_MIN = 1000;
export const RECHARGE_MAX = 200_000;

type Achat = typeof t.achatsRecharge.$inferSelect;

/** La vente est-elle ouverte aux clients ? (activée dans l'admin, clé DexPay et paiement SasPay en place) */
export async function rechargeOffer(db: DB): Promise<{ fraisPct: number; fraisFixe: number } | null> {
  const c = await dexpayConfig(db);
  if (!c.enabled || !c.key) return null;
  if ((await paymentMode(db)) !== "saspay") return null;
  return { fraisPct: c.fraisPct, fraisFixe: c.fraisFixe };
}

async function requireOffer(db: DB) {
  const offer = await rechargeOffer(db);
  if (!offer) throw new ActionError("recharge_indisponible", 503);
  return offer;
}

async function allowedMeter(db: DB, clientId: string, meterId: string) {
  const acc = await meterAccess(db, clientId, meterId);
  if (!acc || acc.role === "consulter") throw new ActionError("compteur_introuvable", 404);
  const [m] = await db.select().from(t.compteurs).where(eq(t.compteurs.id, meterId));
  return { meter: m, ownerId: acc.ownerId };
}

/** Vérifie le compteur chez Senelec (via DexPay) avant le paiement : nom du titulaire et statut. */
export async function checkMeter(db: DB, clientId: string, meterId: string) {
  await requireOffer(db);
  const { meter } = await allowedMeter(db, clientId, meterId);
  try {
    const info = await inquiryMeter(await dexpayConfig(db), meter.numero);
    if (!info) throw new ActionError("compteur_inconnu_senelec", 404);
    return { ...info, numero: meter.numero };
  } catch (e) {
    if (e instanceof DexpayError) throw new ActionError("verification_impossible", 503);
    throw e;
  }
}

/** Démarre l'achat : enregistre la commande et crée la page de paiement SasPay. */
export async function startPurchase(db: DB, clientId: string, input: { meterId?: unknown; montant?: unknown }, origin: string) {
  const offer = await requireOffer(db);
  const montant = Math.round(Number(input.montant));
  if (!Number.isFinite(montant) || montant < RECHARGE_MIN || montant > RECHARGE_MAX) throw new ActionError("montant_invalide");
  const { meter, ownerId } = await allowedMeter(db, clientId, String(input.meterId ?? ""));
  const info = await checkMeter(db, clientId, meter.id);
  if (info.statut && info.statut.toUpperCase() !== "ACTIVE") throw new ActionError("compteur_inactif");

  const frais = clientFees(montant, offer);
  const reference = `WR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const [achat] = await db
    .insert(t.achatsRecharge)
    .values({ reference, clientId, titulaireId: ownerId, compteurId: meter.id, numeroCompteur: meter.numero, nomSenelec: info.nom, montant, frais, total: montant + frais })
    .returning();

  const { key } = await saspayConfig(db);
  const [me] = await db.select({ nom: t.clients.nom, email: t.clients.email, tel: t.clients.telephone }).from(t.clients).where(eq(t.clients.id, clientId));
  try {
    const session = await createCheckout(key!, {
      amount: achat.total,
      description: `Recharge Woyofal ${montant.toLocaleString("fr-FR")} F · compteur ${meter.numero}`,
      email: me?.email ?? "",
      name: me?.nom || "Client Woly Elec",
      phone: me?.tel ?? undefined,
      returnUrl: `${origin}/app/recharger/retour?ref=${reference}`,
      metadata: { kind: "recharge_woyofal", reference },
    });
    await db.update(t.achatsRecharge).set({ checkoutId: session.id }).where(eq(t.achatsRecharge.id, achat.id));
    return { reference, url: session.checkout_url, total: achat.total };
  } catch (e) {
    await db.update(t.achatsRecharge).set({ statut: "annule", erreur: "page_paiement_impossible" }).where(eq(t.achatsRecharge.id, achat.id));
    if (e instanceof SaspayError) throw new ActionError("paiement_indisponible", 503);
    throw e;
  }
}

const spaced = (token: string) => token.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");

/** Code reçu : achat livré, recharge enregistrée sur le compteur, client prévenu. Idempotent. */
async function deliver(db: DB, a: Achat, p: BillPayment) {
  const token = String(p.token ?? "").replace(/\D/g, "");
  const [done] = await db
    .update(t.achatsRecharge)
    .set({ statut: "livre", token, dexpayRef: p.reference, fraisDexpay: p.fee_amount ?? null, livreAt: new Date(), erreur: null })
    .where(and(eq(t.achatsRecharge.id, a.id), inArray(t.achatsRecharge.statut, ["paye", "en_cours"])))
    .returning();
  if (!done) return;
  console.log(`[recharge] livrée : ${a.reference} · ${a.montant} F`);
  if (a.titulaireId && a.compteurId) {
    // La recharge s'ajoute à l'historique du compteur (kWh estimés par le moteur) ; le code y est gardé
    await applyAction(db, a.titulaireId, { type: "recharge", meterId: a.compteurId, date: isoDate(new Date()), amount: a.montant, vendor: "Woly Elec", tokens: token.length === 20 ? [token] : [] }).catch((e) =>
      console.error("[recharge] enregistrement de la recharge impossible", (e as Error).message),
    );
  }
  const titre = "Votre recharge est prête";
  const message = `Code à taper sur le compteur ${a.numeroCompteur} : ${spaced(token)} (${a.montant.toLocaleString("fr-FR")} F). Après l'avoir tapé, faites un relevé.`;
  for (const id of new Set([a.clientId, a.titulaireId].filter(Boolean) as string[])) {
    await db.insert(t.alertes).values({ clientId: id, compteurId: a.compteurId, type: "recharge_achetee", ton: "ok", icone: "check", titre, message, canal: "push" });
    await sendPush(db, id, { title: titre, body: message, url: `/app/recharger/retour?ref=${a.reference}`, tag: `achat-${a.reference}` }, { force: true });
  }
}

async function fail(db: DB, a: Achat, reason: string) {
  const [row] = await db
    .update(t.achatsRecharge)
    .set({ statut: "a_rembourser", erreur: reason.slice(0, 300) })
    .where(and(eq(t.achatsRecharge.id, a.id), inArray(t.achatsRecharge.statut, ["paye", "en_cours"])))
    .returning();
  if (!row) return;
  console.error(`[recharge] échec après paiement : ${a.reference} (${reason})`);
  await sendAdminPush(db, "paiement", { title: "Recharge à rembourser", body: `${a.reference} · ${a.total.toLocaleString("fr-FR")} F · ${reason}`, url: "/admin/recharges", tag: `achat-${a.reference}` });
  if (a.clientId)
    await sendPush(db, a.clientId, { title: "Recharge non délivrée", body: `Votre paiement de ${a.total.toLocaleString("fr-FR")} F est bien reçu mais la recharge n'a pas pu être achetée. Notre équipe vous rembourse ou vous envoie le code rapidement.`, url: `/app/recharger/retour?ref=${a.reference}`, tag: `achat-${a.reference}` }, { force: true });
}

/** Achat chez DexPay (une seule fois par commande, grâce à la clé d'idempotence). */
async function buy(db: DB, a: Achat, origin: string, idempotencyKey = a.id) {
  const [claimed] = await db.update(t.achatsRecharge).set({ statut: "en_cours" }).where(and(eq(t.achatsRecharge.id, a.id), eq(t.achatsRecharge.statut, "paye"))).returning();
  if (!claimed) return;
  const c = await dexpayConfig(db);
  try {
    const p = await payRecharge(c, { numero: a.numeroCompteur, amount: a.montant, idempotencyKey, callBackURL: `${origin}/api/recharge/webhook`, customData: a.reference });
    await db.update(t.achatsRecharge).set({ dexpayRef: p.reference }).where(eq(t.achatsRecharge.id, a.id));
    if (p.status === "completed" && p.token) await deliver(db, claimed, p);
    else if (p.status === "failed" || p.status === "refunded") await fail(db, claimed, p.failure_reason || `dexpay_${p.status}`);
    // processing / initiated : le code arrivera par webhook ou à la prochaine vérification
  } catch (e) {
    if (e instanceof DexpayError) {
      if (e.code === "INSUFFICIENT_BALANCE") await sendAdminPush(db, "paiement", { title: "Solde DexPay insuffisant", body: "Rechargez votre solde DexPay : des clients attendent leur recharge.", url: "/admin/recharges", tag: "dexpay-solde" });
      // Erreur réseau ou serveur : on garde la commande « en cours », la même clé d'idempotence évitera un double débit
      if (e.status >= 500 || e.status === 0) return;
      await fail(db, claimed, e.code);
    } else console.error("[recharge] DexPay injoignable", (e as Error).message); // réessai plus tard
  }
}

/**
 * Revérifie une commande et la fait avancer : paiement SasPay → achat DexPay → code.
 * Seuls les statuts lus chez SasPay et DexPay comptent (jamais le navigateur ni le contenu des webhooks).
 */
export async function reconcilePurchase(db: DB, a: Achat, origin: string): Promise<Achat["statut"]> {
  if (a.statut === "en_attente") {
    if (!a.checkoutId) return a.statut;
    const { key } = await saspayConfig(db);
    if (!key) return a.statut;
    try {
      const s = await checkoutStatus(key, a.checkoutId);
      if (s.status === "PAID" && s.transaction_status === "SUCCESS") {
        const [paid] = await db
          .update(t.achatsRecharge)
          .set({ statut: "paye", payeAt: new Date(), transactionId: s.transaction_id ?? null })
          .where(and(eq(t.achatsRecharge.id, a.id), eq(t.achatsRecharge.statut, "en_attente")))
          .returning();
        if (paid) {
          await sendAdminPush(db, "paiement", { title: "Recharge vendue", body: `${a.montant.toLocaleString("fr-FR")} F · compteur ${a.numeroCompteur} · frais ${a.frais.toLocaleString("fr-FR")} F`, url: "/admin/recharges", tag: `achat-${a.reference}` });
          await buy(db, paid, origin);
        }
      } else if (s.status === "EXPIRED" || s.status === "CANCELLED") {
        await db.update(t.achatsRecharge).set({ statut: "annule" }).where(and(eq(t.achatsRecharge.id, a.id), eq(t.achatsRecharge.statut, "en_attente")));
      }
    } catch (e) {
      console.error("[recharge] vérification SasPay impossible", (e as Error).message);
    }
  } else if (a.statut === "paye") {
    await buy(db, a, origin);
  } else if (a.statut === "en_cours" && a.dexpayRef) {
    try {
      const p = await billPayment(await dexpayConfig(db), a.dexpayRef);
      if (p.status === "completed" && p.token) await deliver(db, a, p);
      else if (p.status === "failed" || p.status === "refunded") await fail(db, a, p.failure_reason || `dexpay_${p.status}`);
    } catch (e) {
      console.error("[recharge] vérification DexPay impossible", (e as Error).message);
    }
  }
  const [now] = await db.select().from(t.achatsRecharge).where(eq(t.achatsRecharge.id, a.id));
  return now?.statut ?? a.statut;
}

/** Commandes à faire avancer (webhooks SasPay / DexPay, tâche planifiée). */
export async function reconcilePendingPurchases(db: DB, origin: string, limit = 10) {
  const rows = await db
    .select()
    .from(t.achatsRecharge)
    .where(and(inArray(t.achatsRecharge.statut, ["en_attente", "paye", "en_cours"]), gte(t.achatsRecharge.createdAt, new Date(Date.now() - 3 * 86400_000))))
    .orderBy(desc(t.achatsRecharge.createdAt))
    .limit(limit);
  for (const a of rows) await reconcilePurchase(db, a, origin);
  return rows.length;
}

/** Commande vue par le client (la sienne, ou celle du compteur dont il est titulaire). */
export async function purchaseFor(db: DB, clientId: string, reference: string) {
  const [a] = await db.select().from(t.achatsRecharge).where(eq(t.achatsRecharge.reference, reference));
  if (!a || (a.clientId !== clientId && a.titulaireId !== clientId)) return null;
  return a;
}

export const publicPurchase = (a: Achat) => ({
  reference: a.reference,
  statut: a.statut,
  montant: a.montant,
  frais: a.frais,
  total: a.total,
  numeroCompteur: a.numeroCompteur,
  token: a.statut === "livre" ? spaced(a.token ?? "") : null,
  date: a.createdAt.toISOString(),
});

export async function myPurchases(db: DB, clientId: string) {
  const rows = await db.select().from(t.achatsRecharge).where(eq(t.achatsRecharge.clientId, clientId)).orderBy(desc(t.achatsRecharge.createdAt)).limit(20);
  return rows.filter((a) => a.statut !== "annule").map(publicPurchase);
}

// ——— Administration ———

export async function adminPurchases(db: DB) {
  const rows = await db
    .select({ a: t.achatsRecharge, nom: t.clients.nom, email: t.clients.email })
    .from(t.achatsRecharge)
    .leftJoin(t.clients, eq(t.clients.id, t.achatsRecharge.clientId))
    .orderBy(desc(t.achatsRecharge.createdAt))
    .limit(200);
  return rows.map(({ a, nom, email }) => ({ ...publicPurchase(a), token: a.token ? spaced(a.token) : null, client: nom || email || "—", nomSenelec: a.nomSenelec, fraisDexpay: a.fraisDexpay, erreur: a.erreur, dexpayRef: a.dexpayRef }));
}

/** Relancer une commande bloquée, ou la marquer remboursée (remboursement fait à la main). */
export async function adminPurchaseAction(db: DB, reference: string, action: "relancer" | "rembourse", origin: string) {
  const [a] = await db.select().from(t.achatsRecharge).where(eq(t.achatsRecharge.reference, reference));
  if (!a) throw new ActionError("achat_introuvable", 404);
  if (action === "rembourse") {
    if (a.statut !== "a_rembourser") throw new ActionError("statut_invalide");
    await db.update(t.achatsRecharge).set({ statut: "rembourse" }).where(eq(t.achatsRecharge.id, a.id));
    return;
  }
  if (a.statut === "a_rembourser") {
    // Nouvel essai d'achat après un échec définitif chez DexPay : nouvelle clé d'idempotence
    // (l'ancienne renverrait le même échec). À faire seulement si DexPay n'a pas livré de code.
    const [again] = await db.update(t.achatsRecharge).set({ statut: "paye", erreur: null }).where(eq(t.achatsRecharge.id, a.id)).returning();
    await buy(db, again, origin, `${a.id}-r${Date.now()}`);
    return;
  }
  await reconcilePurchase(db, a, origin);
}
