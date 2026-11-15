import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as t from "@/db/schema";
import type { Action } from "@/lib/actions";
import type { AlertItem, Meter, Objective, Recharge, State, StoredReading, Usage, User } from "@/lib/demo";
import { randomInt } from "node:crypto";
import { addDays, alertThreshold, amountForKwh, autonomyDays, DEFAULT_TARIFF, kwhForAmount, setActiveTariff, tariffFromJson, tariffToJson, tierIndexFor, type TariffJson } from "@/lib/engine";
import { ddmmyyyy, isoDate } from "@/lib/format";
import { normalizePhone } from "./phone";
import { alertMail, mailEnabled, renewalMail, sendMail } from "./mail";
import { annualPrice, IA_QUOTA_PER_METER, monthlyPrice, PACKS, PAYMENT_METHODS, TRIAL_DAYS, type Pack } from "@/lib/pricing";
import { computeStats } from "@/lib/stats";
import { paymentMode } from "./saspay";
import { sendAdminPush, sendPush } from "./push";
import { TEMPLATES } from "@/lib/templates";

export class ActionError extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

const todayLocal = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
const num = (v: unknown, min: number, max: number, code = "valeur_invalide") => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new ActionError(code);
  return n;
};
const str = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const formatPhone = (p: string | null) => (p ? p.replace(/^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/, "+221 $1 $2 $3 $4") : "");
const initialsOf = (name: string) =>
  name.replace(/^(M\.|Mme|Mlle)\s*/i, "").split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase() || "WE";
const OBJECTIVES: Objective[] = ["mois", "coupure", "economiser"];
const USAGES: Usage[] = ["Ménage", "Commerce", "Location", "Parties communes"];

// ——— Tarif actif ———

export async function loadActiveTariff(db: DB): Promise<TariffJson> {
  const [row] = await db.select().from(t.tarifs).where(eq(t.tarifs.active, true)).orderBy(desc(t.tarifs.id)).limit(1);
  const json = (row?.config as TariffJson | undefined) ?? tariffToJson(DEFAULT_TARIFF);
  setActiveTariff(tariffFromJson(json));
  return json;
}

// ——— Numéro de compteur : un même compteur ne peut être enregistré qu'une fois sur Woly Elec ———

/** Chiffres seuls : « 0145 6789-012 » et « 01456789012 » désignent le même compteur. */
export const meterDigits = (numero: string) => numero.replace(/\D/g, "");

/** true si un compteur portant ce numéro existe déjà (tous comptes confondus). */
export async function meterNumberTaken(db: DB, numero: string): Promise<boolean> {
  const digits = meterDigits(numero);
  if (!digits) return false;
  const [row] = await db
    .select({ id: t.compteurs.id })
    .from(t.compteurs)
    .where(sql`regexp_replace(${t.compteurs.numero}, '[^0-9]', '', 'g') = ${digits}`)
    .limit(1);
  return !!row;
}

// ——— Assistant IA : offre effective (VIP), quota et consommation ———

const QUOTA_KEY = "ia_quota";

/** Quota général de questions IA par compteur et par mois (réglable dans l'administration). */
export async function globalIaQuota(db: DB): Promise<number> {
  const [row] = await db.select().from(t.parametres).where(eq(t.parametres.cle, QUOTA_KEY));
  const v = Number(row?.valeur);
  return row && Number.isInteger(v) && v >= 0 ? v : IA_QUOTA_PER_METER;
}

export async function setGlobalIaQuota(db: DB, value: number) {
  const v = Math.round(num(value, 0, 10_000, "quota_invalide"));
  await db.insert(t.parametres).values({ cle: QUOTA_KEY, valeur: v }).onConflictDoUpdate({ target: t.parametres.cle, set: { valeur: v, updatedAt: new Date() } });
}

/** Quota applicable à un client : son quota propre s'il en a un, sinon le quota général. */
export async function iaQuotaFor(db: DB, clientId: string): Promise<number> {
  const [c] = await db.select({ q: t.clients.quotaIa }).from(t.clients).where(eq(t.clients.id, clientId));
  return c?.q ?? (await globalIaQuota(db));
}

/** Abonnement effectif : un client VIP a Woly Elec IA actif, sans paiement. */
export async function effectiveSub(db: DB, clientId: string) {
  const [[sub], [c]] = await Promise.all([
    db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId)),
    db.select({ vip: t.clients.vip }).from(t.clients).where(eq(t.clients.id, clientId)),
  ]);
  if (c?.vip) return { offre: "ia", statut: "actif", vip: true };
  return { offre: sub?.offre ?? "ia", statut: sub?.statut ?? "expire", vip: false };
}

/** Trace un appel à l'API Claude (tokens et coût) pour le suivi de consommation. */
export async function recordIaCall(db: DB, v: { clientId: string; meterId: string; model: string; inputTokens: number; outputTokens: number; costUsd: number; statut: "ok" | "refus" }) {
  await db.insert(t.iaAppels).values({ clientId: v.clientId, compteurId: v.meterId, modele: v.model, tokensEntree: v.inputTokens, tokensSortie: v.outputTokens, coutUsd: v.costUsd, statut: v.statut });
}

// ——— État complet du compte client (même forme que le mode démo) ———

export async function buildState(db: DB, clientId: string, today = todayLocal()): Promise<State | null> {
  const [c] = await db.select().from(t.clients).where(eq(t.clients.id, clientId));
  if (!c) return null;
  const tariff = await loadActiveTariff(db);
  const todayIso = isoDate(today);
  await db.update(t.clients).set({ lastSeenAt: new Date() }).where(eq(t.clients.id, clientId));

  let [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId));
  if (sub && ((sub.statut === "essai" && sub.essaiFin < todayIso) || (sub.statut === "actif" && sub.renouvellement && sub.renouvellement < todayIso))) {
    [sub] = await db.update(t.abonnements).set({ statut: "expire", updatedAt: new Date() }).where(eq(t.abonnements.clientId, clientId)).returning();
  }

  const meters = await db.select().from(t.compteurs).where(eq(t.compteurs.clientId, clientId)).orderBy(asc(t.compteurs.createdAt));
  const ids = meters.map((m) => m.id);
  const [readings, recharges, usage] = ids.length
    ? await Promise.all([
        db.select().from(t.releves).where(and(inArray(t.releves.compteurId, ids), gte(t.releves.date, isoDate(addDays(today, -120))))).orderBy(asc(t.releves.date)),
        db.select().from(t.recharges).where(and(inArray(t.recharges.compteurId, ids), gte(t.recharges.date, isoDate(addDays(today, -400))))).orderBy(desc(t.recharges.date)),
        db.select().from(t.iaUsage).where(and(inArray(t.iaUsage.compteurId, ids), eq(t.iaUsage.mois, todayIso.slice(0, 7)))),
      ])
    : [[], [], []];
  const [appliances, alerts, allPayments, chat, payMode] = await Promise.all([
    db.select().from(t.appareils).where(eq(t.appareils.clientId, clientId)).orderBy(asc(t.appareils.createdAt)),
    db.select().from(t.alertes).where(eq(t.alertes.clientId, clientId)).orderBy(desc(t.alertes.createdAt)).limit(60),
    db.select().from(t.paiements).where(eq(t.paiements.clientId, clientId)).orderBy(desc(t.paiements.createdAt)),
    db.select().from(t.iaMessages).where(eq(t.iaMessages.clientId, clientId)).orderBy(desc(t.iaMessages.id)).limit(40),
    paymentMode(db),
  ]);
  const payments = allPayments.filter((p) => p.statut === "confirme" || p.statut === "simule");
  const pending = allPayments.find((p) => p.statut === "en_attente" && p.createdAt > addDays(new Date(), -1));

  const iaQuota = c.quotaIa ?? (await globalIaQuota(db));
  const user: User = {
    name: c.nom || "Client Woly Elec",
    initials: initialsOf(c.nom),
    phone: formatPhone(c.telephone),
    email: c.email ?? "",
    lang: c.langue === "Wolof" ? "Wolof" : "Français",
    channels: c.canaux,
    relances: c.relances,
    rechargeDay: c.jourRecharge,
    objective: (OBJECTIVES.includes(c.objectif as Objective) ? c.objectif : "mois") as Objective,
    household: c.foyer,
    budget: c.budget,
    consent: c.consentement,
  };

  return {
    version: 1,
    mode: "server",
    tariff,
    scenario: "essai",
    user,
    subscription: {
      pack: (c.vip ? "ia" : (sub?.offre ?? "ia")) as Pack,
      status: (c.vip ? "actif" : (sub?.statut ?? "expire")) as State["subscription"]["status"],
      vip: c.vip || undefined,
      cycle: (sub?.cycle ?? "mensuel") as State["subscription"]["cycle"],
      trialStart: sub?.essaiDebut ?? todayIso,
      trialEnd: sub?.essaiFin ?? todayIso,
      renewsAt: sub?.renouvellement ?? undefined,
      year: sub?.annee ?? 1,
      payments: payments.map((p) => ({ id: p.reference, date: isoDate(p.createdAt), label: p.libelle, method: p.moyen as (typeof PAYMENT_METHODS)[number], amount: p.montant })),
    },
    meters: meters.map(
      (m): Meter => ({ id: m.id, name: m.nom, number: m.numero, usage: m.typeUsage as Usage, phase: m.typeCompteur === "tri" ? "tri" : "mono", site: m.site, occupant: m.occupant ?? undefined, debt: m.retenueDette }),
    ),
    selectedMeterId: meters[0]?.id ?? "",
    readings: readings.map(
      (r): StoredReading => ({ id: r.id, meterId: r.compteurId, date: r.date, balanceKwh: r.soldeKwh, monthKwh: r.consoMoisKwh, yesterdayKwh: r.consoVeilleKwh, source: r.source as StoredReading["source"] }),
    ),
    recharges: recharges.map(
      (r): Recharge => ({ id: r.id, meterId: r.compteurId, date: r.date, amount: r.montantFcfa, kwh: r.kwhRecus, tokens: r.tokens, vendor: r.revendeur, tier: r.tranche, firstOfMonth: r.premiereDuMois }),
    ),
    appliances: appliances.map((a) => ({ id: a.id, name: a.nom, watts: a.puissanceWatts, hoursPerDay: a.heuresParJour, daysPerWeek: a.joursParSemaine })),
    alerts: alerts.map(
      (a): AlertItem => ({ id: a.id, meterId: a.compteurId ?? "", tone: a.ton as AlertItem["tone"], icon: a.icone ?? undefined, title: a.titre, body: a.message, date: isoDate(a.createdAt), read: a.lue, channel: a.canal as AlertItem["channel"] }),
    ),
    iaUsed: Object.fromEntries(usage.map((u) => [u.compteurId, u.requetes])),
    iaQuota,
    paymentMode: payMode,
    pendingPayment: pending ? { reference: pending.reference, amount: pending.montant, label: pending.libelle } : undefined,
    chat: chat.reverse().map((m) => ({ role: m.role === "u" ? "u" : "a", text: m.texte })),
  };
}

// ——— Inscription ———

/** Identité vérifiée : e-mail + mot de passe (empreinte scrypt) ou compte Google. */
export type Identity = { kind: "email"; email: string; passwordHash: string } | { kind: "google"; sub: string; email: string; name?: string };

export type SignupInput = {
  identity: Identity;
  name?: string;
  meter: { number: string; name?: string; usage?: string; phase?: string };
  reading?: { balanceKwh: number; monthKwh: number; yesterdayKwh: number };
  lastRecharge?: { date: string; amount: number; kwh?: number };
  prefs?: { rechargeDay?: number; objective?: string; whatsapp?: boolean; consent?: boolean };
};

export async function signup(db: DB, input: SignupInput, today = todayLocal()): Promise<string> {
  if (!input.prefs?.consent) throw new ActionError("consentement_requis");
  const number = str(input.meter?.number, 40);
  const digits = number.replace(/\D/g, "");
  if (digits.length < 8) throw new ActionError("compteur_invalide");
  if (await meterNumberTaken(db, number)) throw new ActionError("compteur_deja_utilise", 409);
  const id = input.identity;
  const email = id.email.trim().toLowerCase();
  const [exists] = await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.email, email));
  if (exists) throw new ActionError("deja_inscrit", 409);
  if (id.kind === "google") {
    const [g] = await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.googleId, id.sub));
    if (g) throw new ActionError("deja_inscrit", 409);
  }
  await loadActiveTariff(db);
  const todayIso = isoDate(today);

  const newId = await db.transaction(async (tx) => {
    // Une seule période d'essai par adresse e-mail (ou compte Google) et par numéro de compteur
    const keys = [`email:${email}`, `compteur:${digits}`, ...(id.kind === "google" ? [`google:${id.sub}`] : [])];
    const used = await tx.select().from(t.essais).where(inArray(t.essais.cle, keys));
    const trialAllowed = used.length === 0;
    await tx.insert(t.essais).values(keys.map((cle) => ({ cle }))).onConflictDoNothing();

    const p = input.prefs ?? {};
    const [c] = await tx
      .insert(t.clients)
      .values({
        email,
        motDePasseHash: id.kind === "email" ? id.passwordHash : null,
        googleId: id.kind === "google" ? id.sub : null,
        emailVerifie: true, // Google garantit l'adresse ; sinon elle a été confirmée par le code à 6 chiffres
        nom: str(input.name || (id.kind === "google" ? id.name : ""), 80),
        canaux: { push: true, whatsapp: p.whatsapp !== false, sms: true, email: true },
        jourRecharge: [1, 5, 10, 15, 20, 25].includes(Number(p.rechargeDay)) ? Number(p.rechargeDay) : 1,
        objectif: OBJECTIVES.includes(p.objective as Objective) ? (p.objective as string) : "mois",
        consentement: true,
      })
      .returning({ id: t.clients.id });

    const [m] = await tx
      .insert(t.compteurs)
      .values({
        clientId: c.id,
        numero: number,
        nom: str(input.meter.name, 60) || "Mon compteur",
        typeUsage: USAGES.includes(input.meter.usage as Usage) ? (input.meter.usage as string) : "Ménage",
        typeCompteur: input.meter.phase === "tri" ? "tri" : "mono",
        site: str(input.meter.name, 60),
      })
      .returning({ id: t.compteurs.id });

    await tx.insert(t.abonnements).values({
      clientId: c.id,
      offre: "ia",
      statut: trialAllowed ? "essai" : "expire",
      essaiDebut: todayIso,
      essaiFin: isoDate(addDays(today, trialAllowed ? TRIAL_DAYS : 0)),
    });

    if (input.reading) {
      await tx.insert(t.releves).values({
        compteurId: m.id,
        date: todayIso,
        soldeKwh: num(input.reading.balanceKwh, 0, 100000),
        consoMoisKwh: num(input.reading.monthKwh, 0, 100000),
        consoVeilleKwh: num(input.reading.yesterdayKwh, 0, 1000),
        source: "manuel",
      });
    }
    const r = input.lastRecharge;
    if (r && isDate(r.date) && Number(r.amount) > 0 && r.date <= todayIso) {
      const amount = num(r.amount, 100, 10_000_000);
      const res = kwhForAmount(amount, { boughtMonthKwh: 0, firstRechargeOfMonth: true, phase: input.meter.phase === "tri" ? "tri" : "mono" });
      const kwh = Number(r.kwh) > 0 && Number(r.kwh) < amount / 50 ? Number(r.kwh) : res.kwh;
      await tx.insert(t.recharges).values({ compteurId: m.id, date: r.date, montantFcfa: Math.round(amount), kwhRecus: Math.round(kwh * 10) / 10, tranche: res.parts.at(-1)?.tier ?? 1, premiereDuMois: true, revendeur: "" });
    }
    await tx.insert(t.alertes).values({
      clientId: c.id,
      compteurId: m.id,
      type: "bienvenue",
      ton: trialAllowed ? "ok" : "warn",
      icone: trialAllowed ? "check" : "clock",
      titre: trialAllowed ? "Bienvenue sur Woly Elec" : "Essai déjà utilisé",
      message: trialAllowed
        ? `Votre essai gratuit de ${TRIAL_DAYS} jours commence aujourd'hui. Faites un relevé chaque jour pour des prévisions plus précises.`
        : "Ce numéro ou ce compteur a déjà bénéficié d'un essai gratuit. Abonnez-vous pour activer vos alertes et votre montant exact.",
      canal: "push",
    });
    return c.id;
  });
  const [sub] = await db.select({ statut: t.abonnements.statut }).from(t.abonnements).where(eq(t.abonnements.clientId, newId));
  await sendAdminPush(db, "inscription", {
    title: "Nouvel utilisateur",
    body: `${str(input.name || (id.kind === "google" ? id.name : ""), 80) || email} · ${email} · compteur ${number}${sub?.statut === "essai" ? " · essai gratuit" : " · sans essai (compteur déjà essayé)"}`,
    url: "/admin/utilisateurs",
    tag: "inscription",
  });
  return newId;
}

// ——— Alertes automatiques après un relevé (seuils 5, 3, 1 jour, moins d'un jour) ———

async function maybeAlert(db: DB, clientId: string, meterId: string) {
  const state = await buildState(db, clientId);
  if (!state) return;
  const s = computeStats(state, meterId, todayLocal());
  if (!s.last) return;
  const days = autonomyDays(s.last.balanceKwh, s.avg3 || s.avg7);
  const th = alertThreshold(days);
  if (th === null) return;
  const type = `alerte_${th}j`;
  const [recent] = await db
    .select({ id: t.alertes.id })
    .from(t.alertes)
    .where(and(eq(t.alertes.compteurId, meterId), eq(t.alertes.type, type), gte(t.alertes.createdAt, addDays(new Date(), -3))))
    .limit(1);
  if (recent) return;
  const tpl = TEMPLATES.find((x) => x.id === (th >= 5 ? "a5" : th === 3 ? "a3" : "a1"))!;
  const [custom] = await db.select().from(t.modelesMessages).where(eq(t.modelesMessages.id, tpl.id));
  const message = (custom?.texte ?? tpl.text).replace("{jours}", String(Math.max(1, Math.floor(days)))).replace("{lien}", "wolyelec.com/app");
  const ch = state.user.channels;
  const titre = th === 0 ? "Moins d'un jour d'électricité" : `Il vous reste environ ${th} jour${th > 1 ? "s" : ""}`;
  // Canaux branchés : notification push (gratuite) et e-mail. WhatsApp et SMS : en attente d'un fournisseur.
  const pushed = ch.push ? await sendPush(db, clientId, { title: `${titre} · ${s.meter.name}`, body: message, url: "/app/plan", tag: `alerte-${meterId}` }) : 0;
  let canal = pushed ? "push" : th <= 1 && ch.sms ? "sms" : ch.whatsapp ? "whatsapp" : "push";
  let statut = pushed || canal === "push" ? "remis" : "en_attente";
  if (ch.email && state.user.email && mailEnabled()) {
    const { sent } = await sendMail({ to: state.user.email, ...alertMail(`${titre} sur « ${s.meter.name} »`, message) });
    if (!pushed) {
      canal = "email";
      statut = sent ? "remis" : "echec";
    }
  }
  await db.insert(t.alertes).values({
    clientId,
    compteurId: meterId,
    type,
    ton: th <= 1 ? "red" : "warn",
    icone: th <= 1 ? "bolt" : "warn",
    titre,
    message,
    canal,
    statut,
  });
}

// ——— Actions du compte client ———

async function ownedMeter(db: DB, clientId: string, meterId: string) {
  const [m] = await db.select().from(t.compteurs).where(and(eq(t.compteurs.id, meterId), eq(t.compteurs.clientId, clientId)));
  if (!m) throw new ActionError("compteur_introuvable", 404);
  return m;
}

// ——— Abonnement : prix d'une commande et activation ———

export type Order = { pack: Pack; cycle: "mensuel" | "annuel"; meters: number; amount: number; libelle: string };

/** Calcule le prix côté serveur (jamais le montant envoyé par le navigateur). */
export async function priceOrder(db: DB, clientId: string, a: { pack: unknown; cycle: unknown; meters: unknown }): Promise<Order> {
  const pack: Pack = a.pack === "simple" ? "simple" : "ia";
  const cycle = a.cycle === "annuel" ? "annuel" : "mensuel";
  const [{ n }] = await db.select({ n: count() }).from(t.compteurs).where(eq(t.compteurs.clientId, clientId));
  const meters = Math.max(Number(n), Math.round(num(a.meters, 1, 200)));
  const [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId));
  const amount = cycle === "mensuel" ? monthlyPrice(pack, meters) : annualPrice(pack, meters, sub?.annee ?? 1);
  return { pack, cycle, meters, amount, libelle: `${PACKS[pack].name} · ${meters} compteur${meters > 1 ? "s" : ""} · ${cycle === "mensuel" ? "1 mois" : "12 mois"}` };
}

/** Active ou prolonge l'abonnement payé : la nouvelle période part de la fin de la période en cours si elle n'est pas finie. */
async function extendSubscription(db: DB, clientId: string, o: { pack: Pack; cycle: "mensuel" | "annuel" }, today: Date) {
  const [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId));
  const todayIso = isoDate(today);
  const stillRunning = sub?.statut === "actif" && sub.renouvellement && sub.renouvellement > todayIso;
  const until = stillRunning ? new Date(`${sub.renouvellement}T00:00:00`) : new Date(today);
  if (o.cycle === "mensuel") until.setMonth(until.getMonth() + 1);
  else until.setFullYear(until.getFullYear() + 1);
  // Renouvellement d'un abonnement annuel : on passe à l'année suivante (prix × 12 au lieu de × 11)
  const annee = sub && sub.statut === "actif" && sub.cycle === "annuel" && o.cycle === "annuel" ? sub.annee + 1 : (sub?.annee ?? 1);
  await db.update(t.abonnements).set({ offre: o.pack, statut: "actif", cycle: o.cycle, annee, renouvellement: isoDate(until), updatedAt: new Date() }).where(eq(t.abonnements.clientId, clientId));
}

/** Paiement en ligne en attente : créé avant la redirection vers la page de paiement SasPay. */
export async function createPendingPayment(db: DB, clientId: string, o: Order) {
  const reference = `WE-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  await db.insert(t.paiements).values({ clientId, reference, libelle: o.libelle, moyen: "SasPay", montant: o.amount, statut: "en_attente", offre: o.pack, cycle: o.cycle, compteurs: o.meters });
  return reference;
}

export async function attachCheckout(db: DB, reference: string, checkoutId: string) {
  await db.update(t.paiements).set({ checkoutId }).where(eq(t.paiements.reference, reference));
}

export async function paymentByReference(db: DB, reference: string) {
  const [p] = await db.select().from(t.paiements).where(eq(t.paiements.reference, reference));
  return p ?? null;
}

/** Paiements en ligne encore en attente (pour la vérification déclenchée par un webhook). */
export async function pendingPayments(db: DB, since = addDays(new Date(), -3)) {
  return db
    .select()
    .from(t.paiements)
    .where(and(eq(t.paiements.statut, "en_attente"), gte(t.paiements.createdAt, since)))
    .orderBy(desc(t.paiements.createdAt))
    .limit(30);
}

/**
 * Applique le résultat confirmé par SasPay. Idempotent : seul le passage « en_attente » → « confirme »
 * active l'abonnement, un webhook reçu deux fois ou une double vérification n'a pas d'effet.
 */
export async function settlePayment(db: DB, paymentId: string, outcome: "confirme" | "echec" | "annule", transactionId?: string | null, today = todayLocal()): Promise<boolean> {
  const [p] = await db
    .update(t.paiements)
    .set({ statut: outcome, transactionId: transactionId ?? null, confirmeAt: outcome === "confirme" ? new Date() : null })
    .where(and(eq(t.paiements.id, paymentId), eq(t.paiements.statut, "en_attente")))
    .returning();
  if (!p) return false;
  if (outcome === "confirme") {
    await extendSubscription(db, p.clientId, { pack: p.offre === "simple" ? "simple" : "ia", cycle: p.cycle === "annuel" ? "annuel" : "mensuel" }, today);
    const message = `${p.libelle} · ${p.montant.toLocaleString("fr-FR")} F. Merci, votre abonnement est actif.`;
    await db.insert(t.alertes).values({ clientId: p.clientId, type: "abonnement", ton: "ok", icone: "check", titre: "Paiement reçu", message, canal: "push" });
    await sendPush(db, p.clientId, { title: "Paiement reçu", body: message, url: "/app/abonnement", tag: "paiement" });
    const [c] = await db.select({ nom: t.clients.nom, email: t.clients.email }).from(t.clients).where(eq(t.clients.id, p.clientId));
    const renouvellement = (await db.select({ id: t.paiements.id }).from(t.paiements).where(and(eq(t.paiements.clientId, p.clientId), eq(t.paiements.statut, "confirme")))).length > 1;
    await sendAdminPush(db, "paiement", {
      title: renouvellement ? "Abonnement renouvelé" : "Nouvel abonnement",
      body: `${c?.nom || c?.email || "Client"} · ${p.libelle} · ${p.montant.toLocaleString("fr-FR")} F`,
      url: "/admin/paiement",
      tag: `paiement-${p.reference}`,
    });
  }
  return true;
}

/** Paiements en ligne pour l'administration. */
export async function adminPayments(db: DB, limit = 100) {
  const rows = await db
    .select({ p: t.paiements, nom: t.clients.nom, email: t.clients.email })
    .from(t.paiements)
    .leftJoin(t.clients, eq(t.clients.id, t.paiements.clientId))
    .orderBy(desc(t.paiements.createdAt))
    .limit(limit);
  return rows.map(({ p, nom, email }) => ({ reference: p.reference, client: nom || email || "—", libelle: p.libelle, moyen: p.moyen, montant: p.montant, statut: p.statut, date: p.createdAt.toISOString() }));
}

export async function applyAction(db: DB, clientId: string, a: Action, today = todayLocal()): Promise<void> {
  const todayIso = isoDate(today);
  await loadActiveTariff(db);
  switch (a.type) {
    case "reading": {
      await ownedMeter(db, clientId, a.meterId);
      if (!isDate(a.date) || a.date > todayIso) throw new ActionError("date_invalide");
      const values = { soldeKwh: num(a.balanceKwh, 0, 100000), consoMoisKwh: num(a.monthKwh, 0, 100000), consoVeilleKwh: num(a.yesterdayKwh, 0, 1000) };
      await db
        .insert(t.releves)
        .values({ compteurId: a.meterId, date: a.date, source: "manuel", ...values })
        .onConflictDoUpdate({ target: [t.releves.compteurId, t.releves.date], set: values });
      await maybeAlert(db, clientId, a.meterId);
      return;
    }
    case "recharge": {
      const m = await ownedMeter(db, clientId, a.meterId);
      if (!isDate(a.date) || a.date > todayIso) throw new ActionError("date_invalide");
      const amount = num(a.amount, 100, 10_000_000, "montant_invalide");
      const month = await db
        .select({ kwh: t.recharges.kwhRecus })
        .from(t.recharges)
        .where(and(eq(t.recharges.compteurId, a.meterId), gte(t.recharges.date, `${a.date.slice(0, 7)}-01`), lt(t.recharges.date, isoDate(new Date(Number(a.date.slice(0, 4)), Number(a.date.slice(5, 7)), 1)))));
      const bought = month.reduce((s, r) => s + r.kwh, 0);
      const res = kwhForAmount(amount, { boughtMonthKwh: bought, firstRechargeOfMonth: month.length === 0, phase: m.typeCompteur === "tri" ? "tri" : "mono", debt: m.retenueDette });
      const kwh = Number(a.kwh) > 0 && Number(a.kwh) < amount / 50 ? Number(a.kwh) : res.kwh;
      const tokens = (Array.isArray(a.tokens) ? a.tokens : []).map((x) => String(x).replace(/\D/g, "")).filter((x) => x.length === 20).slice(0, 3);
      await db.insert(t.recharges).values({
        compteurId: a.meterId,
        date: a.date,
        montantFcfa: Math.round(amount),
        kwhRecus: Math.round(kwh * 10) / 10,
        tokens,
        revendeur: str(a.vendor, 40),
        tranche: res.parts.at(-1)?.tier ?? tierIndexFor(bought),
        premiereDuMois: month.length === 0,
      });
      await db.insert(t.alertes).values({
        clientId,
        compteurId: a.meterId,
        type: "recharge",
        ton: "ok",
        icone: "check",
        titre: "Recharge enregistrée",
        message: `${Math.round(amount).toLocaleString("fr-FR")} F · environ ${Math.round(kwh)} kWh reçus. Mettez à jour votre solde après avoir saisi les codes.`,
        canal: "push",
      });
      return;
    }
    case "meter.add": {
      const sub = await effectiveSub(db, clientId);
      if (sub.statut !== "actif") throw new ActionError("abonnement_requis", 402);
      const number = str(a.meter.number, 40);
      if (number.replace(/\D/g, "").length < 8 || !str(a.meter.name)) throw new ActionError("compteur_invalide");
      if (await meterNumberTaken(db, number)) throw new ActionError("compteur_deja_utilise", 409);
      await db.insert(t.compteurs).values({
        clientId,
        nom: str(a.meter.name, 60),
        numero: number,
        typeUsage: USAGES.includes(a.meter.usage) ? a.meter.usage : "Ménage",
        typeCompteur: a.meter.phase === "tri" ? "tri" : "mono",
        site: str(a.meter.site, 60),
        occupant: str(a.meter.occupant, 60) || null,
        retenueDette: Math.round(num(a.meter.debt ?? 0, 0, 1_000_000)),
      });
      return;
    }
    case "meter.remove": {
      await ownedMeter(db, clientId, a.id);
      const [{ n }] = await db.select({ n: count() }).from(t.compteurs).where(eq(t.compteurs.clientId, clientId));
      if (n <= 1) throw new ActionError("dernier_compteur");
      await db.delete(t.compteurs).where(eq(t.compteurs.id, a.id));
      return;
    }
    case "meter.update": {
      await ownedMeter(db, clientId, a.id);
      const p = a.patch ?? {};
      const set: Partial<typeof t.compteurs.$inferInsert> = {};
      if (p.name !== undefined && str(p.name)) set.nom = str(p.name, 60);
      if (p.usage !== undefined && USAGES.includes(p.usage)) set.typeUsage = p.usage;
      if (p.phase !== undefined) set.typeCompteur = p.phase === "tri" ? "tri" : "mono";
      if (p.debt !== undefined) set.retenueDette = Math.round(num(p.debt, 0, 1_000_000));
      if (p.occupant !== undefined) set.occupant = str(p.occupant, 60) || null;
      if (Object.keys(set).length) await db.update(t.compteurs).set(set).where(eq(t.compteurs.id, a.id));
      return;
    }
    case "appliance.add": {
      const x = a.appliance;
      if (!str(x?.name)) throw new ActionError("nom_requis");
      await db.insert(t.appareils).values({ clientId, nom: str(x.name, 60), puissanceWatts: num(x.watts, 1, 50000), heuresParJour: num(x.hoursPerDay, 0.1, 24), joursParSemaine: Math.round(num(x.daysPerWeek, 1, 7)) });
      return;
    }
    case "appliance.remove":
      await db.delete(t.appareils).where(and(eq(t.appareils.id, a.id), eq(t.appareils.clientId, clientId)));
      return;
    case "user.update": {
      const p = a.patch ?? {};
      const set: Partial<typeof t.clients.$inferInsert> = {};
      if (p.name !== undefined) set.nom = str(p.name, 80);
      if (p.phone !== undefined) {
        const raw = str(p.phone, 30);
        const phone = raw ? normalizePhone(raw) : null;
        if (raw && !phone) throw new ActionError("telephone_invalide");
        if (phone) {
          const [other] = await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.telephone, phone));
          if (other && other.id !== clientId) throw new ActionError("telephone_deja_utilise", 409);
        }
        set.telephone = phone;
      }
      if (p.lang !== undefined) set.langue = p.lang === "Wolof" ? "Wolof" : "Français";
      if (p.channels !== undefined) set.canaux = { push: !!p.channels.push, whatsapp: !!p.channels.whatsapp, sms: !!p.channels.sms, email: !!p.channels.email };
      if (p.relances !== undefined) {
        const sub = await effectiveSub(db, clientId);
        set.relances = sub.offre === "ia" ? Math.round(num(p.relances, 0, 6)) : 2; // réglable seulement avec Woly Elec IA
      }
      if (p.rechargeDay !== undefined) set.jourRecharge = Math.round(num(p.rechargeDay, 1, 28));
      if (p.objective !== undefined && OBJECTIVES.includes(p.objective)) set.objectif = p.objective;
      if (p.household !== undefined) set.foyer = Math.round(num(p.household, 1, 50));
      if (p.budget !== undefined) set.budget = Math.round(num(p.budget, 0, 10_000_000));
      if (p.consent !== undefined) set.consentement = !!p.consent;
      if (Object.keys(set).length) await db.update(t.clients).set(set).where(eq(t.clients.id, clientId));
      return;
    }
    case "alerts.read":
      await db.update(t.alertes).set({ lue: true }).where(eq(t.alertes.clientId, clientId));
      return;
    case "alert.dismiss":
      await db.delete(t.alertes).where(and(eq(t.alertes.id, a.id), eq(t.alertes.clientId, clientId)));
      return;
    case "subscribe": {
      // Paiement simulé (mode démo). Avec SasPay, le paiement passe par /api/paiement puis la confirmation de SasPay.
      const mode = await paymentMode(db);
      if (mode === "saspay") throw new ActionError("paiement_en_ligne", 409);
      if (mode !== "demo") throw new ActionError("paiement_indisponible", 503);
      if (!PAYMENT_METHODS.includes(a.method)) throw new ActionError("moyen_invalide");
      const order = await priceOrder(db, clientId, a);
      const reference = `WE-${Date.now().toString(36).toUpperCase()}`;
      await db.insert(t.paiements).values({ clientId, reference, libelle: order.libelle, moyen: a.method, montant: order.amount, statut: "simule", offre: order.pack, cycle: order.cycle, compteurs: order.meters });
      await extendSubscription(db, clientId, order, today);
      return;
    }
    case "pack": {
      // Avec le paiement en ligne, passer d'un abonnement payé Woly Elec 1 à Woly Elec IA demande un nouveau paiement
      if (a.pack === "ia" && (await paymentMode(db)) === "saspay") {
        const sub = await effectiveSub(db, clientId);
        if (!sub.vip && sub.statut === "actif" && sub.offre === "simple") throw new ActionError("paiement_requis", 402);
      }
      await db.update(t.abonnements).set({ offre: a.pack === "simple" ? "simple" : "ia", updatedAt: new Date() }).where(eq(t.abonnements.clientId, clientId));
      return;
    }
    case "ia": {
      await ownedMeter(db, clientId, a.meterId);
      const sub = await effectiveSub(db, clientId);
      if (sub.offre !== "ia" || sub.statut === "expire") throw new ActionError("offre_ia_requise", 402);
      const mois = todayIso.slice(0, 7);
      const [u] = await db.select().from(t.iaUsage).where(and(eq(t.iaUsage.compteurId, a.meterId), eq(t.iaUsage.mois, mois)));
      if ((u?.requetes ?? 0) >= (await iaQuotaFor(db, clientId))) throw new ActionError("quota_atteint", 429);
      await db
        .insert(t.iaUsage)
        .values({ compteurId: a.meterId, mois, requetes: 1 })
        .onConflictDoUpdate({ target: [t.iaUsage.compteurId, t.iaUsage.mois], set: { requetes: sql`${t.iaUsage.requetes} + 1` } });
      await db.insert(t.iaMessages).values([
        { clientId, role: "u", texte: str(a.question, 600) },
        { clientId, role: "a", texte: str(a.answer, 3000) },
      ]);
      return;
    }
    default:
      throw new ActionError("action_inconnue");
  }
}

// ——— Administration ———

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const maskPhone = (p: string) => p.replace(/^\+221(\d{2})\d{5}(\d{2})$/, "+221 $1 ••• •• $2");

export async function adminOverview(db: DB, days: number) {
  const now = new Date();
  const from = addDays(now, -days);
  const prevFrom = addDays(now, -2 * days);
  const week = addDays(now, -7);
  const [[{ total }], [{ inscr }], [{ prev }], [{ actifs }], [{ releves7 }], subs, [{ urgentes }]] = await Promise.all([
    db.select({ total: count() }).from(t.clients),
    db.select({ inscr: count() }).from(t.clients).where(gte(t.clients.createdAt, from)),
    db.select({ prev: count() }).from(t.clients).where(and(gte(t.clients.createdAt, prevFrom), lt(t.clients.createdAt, from))),
    db
      .select({ actifs: sql<number>`count(distinct ${t.compteurs.clientId})::int` })
      .from(t.releves)
      .innerJoin(t.compteurs, eq(t.compteurs.id, t.releves.compteurId))
      .where(gte(t.releves.createdAt, week)),
    db.select({ releves7: count() }).from(t.releves).where(gte(t.releves.createdAt, week)),
    db.select({ statut: t.abonnements.statut, n: count() }).from(t.abonnements).groupBy(t.abonnements.statut),
    db.select({ urgentes: count() }).from(t.alertes).where(and(inArray(t.alertes.type, ["alerte_1j", "alerte_0j"]), gte(t.alertes.createdAt, from))),
  ]);
  const byStatus = Object.fromEntries(subs.map((s) => [s.statut, Number(s.n)]));
  const retention = await Promise.all(
    [30, 60, 90].map(async (n) => {
      const cutoff = addDays(now, -n);
      const [{ eligible }] = await db.select({ eligible: count() }).from(t.clients).where(lt(t.clients.createdAt, cutoff));
      const [{ kept }] = await db
        .select({ kept: sql<number>`count(distinct ${t.clients.id})::int` })
        .from(t.clients)
        .innerJoin(t.compteurs, eq(t.compteurs.clientId, t.clients.id))
        .innerJoin(t.releves, eq(t.releves.compteurId, t.compteurs.id))
        .where(and(lt(t.clients.createdAt, cutoff), gte(t.releves.createdAt, addDays(now, -14))));
      return { days: n, value: pct(Number(kept), Number(eligible)), eligible: Number(eligible) };
    }),
  );
  const sources = await db.select({ source: t.releves.source, n: count() }).from(t.releves).groupBy(t.releves.source);
  return {
    totalClients: Number(total),
    inscriptions: Number(inscr),
    inscriptionsDelta: Number(prev) > 0 ? Math.round(((Number(inscr) - Number(prev)) / Number(prev)) * 100) : null,
    actifsSemaine: Number(actifs),
    relevesParUtilisateur: Number(actifs) > 0 ? Math.round((Number(releves7) / Number(actifs)) * 10) / 10 : 0,
    conversion: pct(byStatus.actif ?? 0, (byStatus.actif ?? 0) + (byStatus.expire ?? 0)),
    essais: byStatus.essai ?? 0,
    alertesUrgentes: Number(urgentes),
    retention,
    sources: sources.map((s) => ({ source: s.source, n: Number(s.n) })),
    recentSubs: (await adminUsers(db)).slice(0, 5),
    recentAlerts: (await adminAlerts(db, 5)),
  };
}

export async function adminUsers(db: DB) {
  const rows = await db
    .select({
      id: t.clients.id,
      nom: t.clients.nom,
      telephone: t.clients.telephone,
      email: t.clients.email,
      google: t.clients.googleId,
      vip: t.clients.vip,
      quotaIa: t.clients.quotaIa,
      telephonesPush: sql<number>`(select count(*)::int from ${t.pushAbonnements} where ${t.pushAbonnements.clientId} = ${t.clients.id})`,
      createdAt: t.clients.createdAt,
      lastSeenAt: t.clients.lastSeenAt,
      offre: t.abonnements.offre,
      statut: t.abonnements.statut,
      essaiFin: t.abonnements.essaiFin,
      renouvellement: t.abonnements.renouvellement,
      compteurs: sql<number>`(select count(*)::int from ${t.compteurs} where ${t.compteurs.clientId} = ${t.clients.id})`,
      releves: sql<number>`(select count(*)::int from ${t.releves} r join ${t.compteurs} c on c.id = r.compteur_id where c.client_id = ${t.clients.id})`,
    })
    .from(t.clients)
    .leftJoin(t.abonnements, eq(t.abonnements.clientId, t.clients.id))
    .orderBy(desc(t.clients.createdAt))
    .limit(500);
  return rows.map((r) => {
    const meters = Number(r.compteurs);
    const pack = (r.offre ?? "ia") as Pack;
    return {
      id: r.id,
      name: r.nom || "—",
      phone: r.telephone ? maskPhone(r.telephone) : "—",
      email: r.email ?? "—",
      method: r.google ? "Google" : "E-mail",
      meters,
      readings: Number(r.releves),
      pack: r.vip ? "VIP · Woly Elec IA" : r.statut === "essai" ? "Essai" : PACKS[pack].name,
      status: r.vip || r.statut === "actif" ? "Actif" : r.statut === "essai" ? "Essai" : "Expiré",
      vip: r.vip,
      quotaIa: r.quotaIa,
      push: Number(r.telephonesPush),
      expires: (r.statut === "essai" ? r.essaiFin : r.renouvellement) ?? "—",
      monthly: !r.vip && r.statut === "actif" ? monthlyPrice(pack, Math.max(1, meters)) : 0,
      createdAt: isoDate(r.createdAt),
      lastSeen: isoDate(r.lastSeenAt),
    };
  });
}

export async function adminAlerts(db: DB, limit = 200) {
  const rows = await db
    .select({ createdAt: t.alertes.createdAt, nom: t.clients.nom, titre: t.alertes.titre, type: t.alertes.type, canal: t.alertes.canal, statut: t.alertes.statut })
    .from(t.alertes)
    .innerJoin(t.clients, eq(t.clients.id, t.alertes.clientId))
    .orderBy(desc(t.alertes.createdAt))
    .limit(limit);
  const CH: Record<string, string> = { push: "Push", whatsapp: "WhatsApp", sms: "SMS", email: "E-mail" };
  const ST: Record<string, string> = { remis: "Remis", en_attente: "En attente", echec: "Échec" };
  return rows.map((r) => ({
    time: r.createdAt.toISOString(),
    user: r.nom || "—",
    type: r.titre,
    channel: CH[r.canal] ?? r.canal,
    status: ST[r.statut] ?? r.statut,
  }));
}

export async function adminTariffs(db: DB) {
  return db.select().from(t.tarifs).orderBy(desc(t.tarifs.id)).limit(20);
}

export async function publishTariff(db: DB, config: TariffJson, version: string) {
  const ok =
    Array.isArray(config?.tiers) &&
    config.tiers.length >= 1 &&
    config.tiers.every((x) => Number(x.price) > 0 && Number(x.price) < 10000 && (x.limit === null || Number(x.limit) > 0)) &&
    Number(config.communalTax) >= 0 &&
    Number(config.communalTax) < 0.5 &&
    Number(config.redevance?.mono) >= 0 &&
    Number(config.redevance?.tri) >= 0;
  if (!ok) throw new ActionError("tarif_invalide");
  const clean: TariffJson = {
    tiers: config.tiers.map((x) => ({ limit: x.limit === null ? null : Number(x.limit), price: Number(x.price) })),
    communalTax: Number(config.communalTax),
    redevance: { mono: Number(config.redevance.mono), tri: Number(config.redevance.tri) },
    margins: config.margins ?? DEFAULT_TARIFF.margins,
  };
  await db.transaction(async (tx) => {
    await tx.update(t.tarifs).set({ active: false }).where(eq(t.tarifs.active, true));
    await tx.insert(t.tarifs).values({ version: str(version, 120) || new Date().toLocaleDateString("fr-FR"), config: clean, active: true });
  });
  setActiveTariff(tariffFromJson(clean));
}

export async function adminTemplates(db: DB) {
  return db.select().from(t.modelesMessages).orderBy(asc(t.modelesMessages.id));
}

export async function saveTemplate(db: DB, id: string, texte: string) {
  const text = str(texte, 1000);
  if (!text.includes("{lien}")) throw new ActionError("lien_obligatoire");
  const [row] = await db.update(t.modelesMessages).set({ texte: text, updatedAt: new Date() }).where(eq(t.modelesMessages.id, id)).returning();
  if (!row) throw new ActionError("modele_introuvable", 404);
}

// ——— Support et réclamations ———

export const SUPPORT_CATEGORIES = ["question", "reclamation", "technique", "paiement", "compte"] as const;
export const SUPPORT_STATUTS = ["ouvert", "en_cours", "resolu"] as const;

export async function createSupportRequest(
  db: DB,
  input: { clientId: string | null; nom: string; email: string; categorie: string; sujet: string; message: string },
) {
  const categorie = (SUPPORT_CATEGORIES as readonly string[]).includes(input.categorie) ? input.categorie : "question";
  const sujet = str(input.sujet, 120);
  const message = String(input.message ?? "").trim().slice(0, 4000);
  if (sujet.length < 3 || message.length < 10) throw new ActionError("demande_incomplete");
  const reference = `WS-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`;
  const [row] = await db
    .insert(t.demandesSupport)
    .values({ reference, clientId: input.clientId, nom: str(input.nom, 80), email: input.email, categorie, sujet, message })
    .returning();
  await sendAdminPush(db, "support", { title: categorie === "reclamation" ? "Nouvelle réclamation" : "Nouvelle demande de support", body: `${row.nom || row.email} · ${sujet}`, url: "/admin/support", tag: `support-${reference}` });
  return row;
}

export async function adminSupport(db: DB) {
  const rows = await db.select().from(t.demandesSupport).orderBy(desc(t.demandesSupport.createdAt)).limit(300);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
}

export async function setSupportStatus(db: DB, id: number, statut: string) {
  if (!(SUPPORT_STATUTS as readonly string[]).includes(statut)) throw new ActionError("statut_invalide");
  const [row] = await db.update(t.demandesSupport).set({ statut, updatedAt: new Date() }).where(eq(t.demandesSupport.id, id)).returning({ id: t.demandesSupport.id });
  if (!row) throw new ActionError("demande_introuvable", 404);
}

// ——— Administration : assistant IA ———

export async function setClientVip(db: DB, clientId: string, vip: boolean) {
  const r = await db.update(t.clients).set({ vip }).where(eq(t.clients.id, clientId)).returning({ id: t.clients.id });
  if (!r.length) throw new ActionError("client_introuvable", 404);
}

/** Quota propre à un client ; null pour revenir au quota général. */
export async function setClientIaQuota(db: DB, clientId: string, value: number | null) {
  const q = value === null ? null : Math.round(num(value, 0, 10_000, "quota_invalide"));
  const r = await db.update(t.clients).set({ quotaIa: q }).where(eq(t.clients.id, clientId)).returning({ id: t.clients.id });
  if (!r.length) throw new ActionError("client_introuvable", 404);
}

type IaSum = { appels: number; tokensEntree: number; tokensSortie: number; coutUsd: number };

/** Consommation de l'API Claude : ce mois-ci, par jour (30 jours), par mois (6 mois), plus gros consommateurs. */
export async function adminIa(db: DB, now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const d30 = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -29);
  const m6 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const sum = {
    appels: sql<number>`count(*)::int`,
    entree: sql<number>`coalesce(sum(${t.iaAppels.tokensEntree}),0)::int`,
    sortie: sql<number>`coalesce(sum(${t.iaAppels.tokensSortie}),0)::int`,
    cout: sql<number>`coalesce(sum(${t.iaAppels.coutUsd}),0)::float8`,
  };
  const day = sql<string>`to_char(${t.iaAppels.createdAt}, 'YYYY-MM-DD')`;
  const month = sql<string>`to_char(${t.iaAppels.createdAt}, 'YYYY-MM')`;
  const [[mois], [total], parJour, parMois, top, [vips], quota] = await Promise.all([
    db.select(sum).from(t.iaAppels).where(gte(t.iaAppels.createdAt, monthStart)),
    db.select(sum).from(t.iaAppels),
    db.select({ jour: day, ...sum }).from(t.iaAppels).where(gte(t.iaAppels.createdAt, d30)).groupBy(day),
    db.select({ mois: month, ...sum }).from(t.iaAppels).where(gte(t.iaAppels.createdAt, m6)).groupBy(month).orderBy(desc(month)),
    db
      .select({ id: t.clients.id, nom: t.clients.nom, email: t.clients.email, vip: t.clients.vip, ...sum })
      .from(t.iaAppels)
      .innerJoin(t.clients, eq(t.clients.id, t.iaAppels.clientId))
      .where(gte(t.iaAppels.createdAt, monthStart))
      .groupBy(t.clients.id)
      .orderBy(desc(sql`sum(${t.iaAppels.coutUsd})`))
      .limit(10),
    db.select({ n: count() }).from(t.clients).where(eq(t.clients.vip, true)),
    globalIaQuota(db),
  ]);
  const fmt = (r: { appels: number; entree: number; sortie: number; cout: number }): IaSum => ({
    appels: Number(r.appels),
    tokensEntree: Number(r.entree),
    tokensSortie: Number(r.sortie),
    coutUsd: Number(r.cout),
  });
  const byDay = new Map(parJour.map((r) => [r.jour, fmt(r)]));
  const empty: IaSum = { appels: 0, tokensEntree: 0, tokensSortie: 0, coutUsd: 0 };
  return {
    mois: fmt(mois),
    total: fmt(total),
    parJour: Array.from({ length: 30 }, (_, i) => {
      const iso = isoDate(addDays(d30, i));
      return { jour: iso, ...(byDay.get(iso) ?? empty) };
    }),
    parMois: parMois.map((r) => ({ mois: r.mois, ...fmt(r) })),
    top: top.map((r) => ({ id: r.id, name: r.nom || "—", email: r.email ?? "—", vip: r.vip, ...fmt(r) })),
    vips: Number(vips.n),
    quota,
  };
}

// ——— Rappels de renouvellement (tâche planifiée) ———

const REMINDER_DAYS = { actif: [7, 3, 1], essai: [3, 1] } as const;

/**
 * Rappels avant la fin de l'essai (J-3, J-1) et de l'abonnement (J-7, J-3, J-1), puis le jour de l'expiration.
 * Notification dans l'application + e-mail avec le lien de paiement SasPay. Idempotent (table rappels) :
 * la tâche peut tourner toutes les heures sans jamais envoyer deux fois le même rappel. Les clients VIP sont ignorés.
 */
export async function renewalReminders(db: DB, today = todayLocal()): Promise<{ rappels: number; expires: number }> {
  const todayIso = isoDate(today);
  const horizon = isoDate(addDays(today, 7));

  // 1. Abonnements et essais arrivés à terme → expirés (comme à l'ouverture de l'application)
  const expired = await db
    .update(t.abonnements)
    .set({ statut: "expire", updatedAt: new Date() })
    .where(
      sql`(${t.abonnements.statut} = 'essai' and ${t.abonnements.essaiFin} < ${todayIso}) or (${t.abonnements.statut} = 'actif' and ${t.abonnements.renouvellement} < ${todayIso})`,
    )
    .returning({ id: t.abonnements.clientId });

  // 2. Expirés depuis moins de 3 jours (y compris ceux expirés à l'ouverture de l'application) et échéances proches
  const recent = isoDate(addDays(today, -3));
  const subs = await db
    .select()
    .from(t.abonnements)
    .where(
      sql`(${t.abonnements.statut} = 'expire' and coalesce(${t.abonnements.renouvellement}, ${t.abonnements.essaiFin}) between ${recent} and ${todayIso})
       or (${t.abonnements.statut} = 'essai' and ${t.abonnements.essaiFin} between ${todayIso} and ${horizon})
       or (${t.abonnements.statut} = 'actif' and ${t.abonnements.renouvellement} between ${todayIso} and ${horizon})`,
    );

  const jobs: { sub: (typeof subs)[number]; kind: "essai" | "abonnement"; days: number; endDate: string; step: number }[] = [];
  for (const s of subs) {
    const kind = s.statut === "essai" || (s.statut === "expire" && !s.renouvellement) ? "essai" : "abonnement";
    const endDate = kind === "essai" ? s.essaiFin : s.renouvellement!;
    const days = Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86400000);
    if (s.statut === "expire") {
      jobs.push({ sub: s, kind, days: 0, endDate, step: 0 });
      continue;
    }
    // Un rappel par palier : le plus proche atteint (un rappel J-7 manqué part à J-6, J-5…)
    const steps: readonly number[] = kind === "essai" ? REMINDER_DAYS.essai : REMINDER_DAYS.actif;
    const step = steps.filter((d) => days <= d).at(-1);
    if (step !== undefined && days >= 1) jobs.push({ sub: s, kind, days, endDate, step });
  }

  let sent = 0;
  for (const j of jobs) {
    const { endDate, step } = j;
    const [c] = await db.select().from(t.clients).where(eq(t.clients.id, j.sub.clientId));
    if (!c || c.vip) continue;
    // Clé unique : le même rappel n'est jamais renvoyé
    const [fresh] = await db.insert(t.rappels).values({ cle: `${c.id}:${j.kind}:${endDate}:J${step}` }).onConflictDoNothing().returning();
    if (!fresh) continue;
    const pack: Pack = j.sub.offre === "simple" ? "simple" : "ia";
    const v = { kind: j.kind, days: j.days, endDate: ddmmyyyy(endDate), offer: PACKS[pack].name, price: PACKS[pack].first };
    const mail = renewalMail(v);
    const title = mail.subject.replace(" · Woly Elec", "");
    const body = j.days <= 0 ? "Réabonnez-vous pour retrouver vos alertes et votre montant exact." : `Renouvelez avant le ${ddmmyyyy(endDate)} pour garder vos alertes et votre montant exact.`;
    const pushed = await sendPush(db, c.id, { title, body, url: "/app/abonnement/paiement", tag: "renouvellement" });
    let canal = "push";
    if (c.email && mailEnabled()) {
      const { sent: ok } = await sendMail({ to: c.email, ...mail });
      if (ok && !pushed) canal = "email";
    }
    await db.insert(t.alertes).values({
      clientId: c.id,
      type: step === 0 ? "abonnement_expire" : `abonnement_j${step}`,
      ton: j.days <= 1 ? "red" : "warn",
      icone: "card",
      titre: title,
      message: j.days <= 0 ? "Réabonnez-vous pour retrouver vos alertes et votre montant exact. Vos données sont conservées." : `Renouvelez avant le ${ddmmyyyy(endDate)} pour garder vos alertes et votre montant exact.`,
      canal,
    });
    sent++;
  }
  if (sent || expired.length) console.log(`[rappels] ${sent} rappel(s) envoyé(s), ${expired.length} abonnement(s) expiré(s)`);
  return { rappels: sent, expires: expired.length };
}

// ——— Bilan hebdomadaire (notification push, gratuite) ———

/**
 * Chaque lundi : consommation de la semaine, autonomie estimée et montant à recharger, pour chaque compteur.
 * Seulement pour les clients abonnés aux notifications sur au moins un appareil, une fois par semaine (table rappels).
 */
export async function weeklySummaries(db: DB, today = todayLocal()): Promise<number> {
  if (today.getDay() !== 1) return 0;
  const week = isoDate(today);
  const targets = await db
    .selectDistinct({ id: t.pushAbonnements.clientId })
    .from(t.pushAbonnements)
    .innerJoin(t.abonnements, eq(t.abonnements.clientId, t.pushAbonnements.clientId))
    .where(inArray(t.abonnements.statut, ["essai", "actif"]));
  let sent = 0;
  for (const { id } of targets) {
    const [fresh] = await db.insert(t.rappels).values({ cle: `${id}:bilan:${week}` }).onConflictDoNothing().returning();
    if (!fresh) continue;
    const state = await buildState(db, id, today);
    if (!state?.meters.length) continue;
    for (const m of state.meters.slice(0, 3)) {
      const s = computeStats(state, m.id, today);
      if (!s.last || !s.avg7) continue;
      const week7 = Math.round(s.avg7 * 7);
      const autonomy = Math.max(0, Math.floor(s.plan.autonomy));
      const advice = s.plan.coversMonth
        ? "Votre crédit devrait tenir jusqu'à la fin du mois."
        : `Pour finir le mois : ${s.plan.minAmount.toLocaleString("fr-FR")} F minimum, ${s.plan.recommendedAmount.toLocaleString("fr-FR")} F conseillés.`;
      const n = await sendPush(db, id, {
        title: `Votre semaine · ${m.name}`,
        body: `${week7} kWh consommés en 7 jours (${s.avg7.toFixed(1).replace(".", ",")} kWh/jour). Autonomie estimée : ${autonomy} jour${autonomy > 1 ? "s" : ""}. ${advice}`,
        url: "/app/bilan",
        tag: `bilan-${m.id}`,
      });
      if (n) sent++;
    }
  }
  if (sent) console.log(`[rappels] ${sent} bilan(s) hebdomadaire(s) envoyé(s)`);
  return sent;
}

// ——— Loterie : un mois d'électricité offert à un client tiré au sort ———

export type LotteryOptions = { exclureGagnants?: boolean; actifsSeulement?: boolean };

/**
 * Consommation d'un compteur sur un mois, d'après ses relevés des 30 derniers jours (code 813 = veille),
 * ou à défaut le cumul du mois (code 814). Montant = une recharge couvrant ce mois (tranches, taxe, redevance).
 */
export async function monthlyConsumption(db: DB, compteurId: string, today = todayLocal()): Promise<{ kwh: number | null; montant: number | null; releves: number }> {
  const [m] = await db.select().from(t.compteurs).where(eq(t.compteurs.id, compteurId));
  if (!m) return { kwh: null, montant: null, releves: 0 };
  const rows = await db
    .select()
    .from(t.releves)
    .where(and(eq(t.releves.compteurId, compteurId), gte(t.releves.date, isoDate(addDays(today, -30)))))
    .orderBy(desc(t.releves.date));
  let daily = 0;
  const veilles = rows.map((r) => r.consoVeilleKwh).filter((v) => v > 0);
  if (veilles.length) daily = veilles.reduce((a, b) => a + b, 0) / veilles.length;
  else if (rows[0] && rows[0].consoMoisKwh > 0) daily = rows[0].consoMoisKwh / Math.max(1, Number(rows[0].date.slice(8, 10)) - 1);
  if (!(daily > 0)) return { kwh: null, montant: null, releves: rows.length };
  const kwh = Math.round(daily * 30);
  await loadActiveTariff(db);
  const montant = Math.round(amountForKwh(kwh, { boughtMonthKwh: 0, firstRechargeOfMonth: true, phase: m.typeCompteur === "tri" ? "tri" : "mono", debt: m.retenueDette }));
  return { kwh, montant, releves: rows.length };
}

/** Clients qui peuvent participer : au moins un compteur ; options : sans les anciens gagnants, actifs (relevé sur 30 jours). */
async function lotteryPool(db: DB, o: LotteryOptions, today = todayLocal()) {
  const meters = await db
    .select({ compteurId: t.compteurs.id, clientId: t.compteurs.clientId, numero: t.compteurs.numero, nom: t.compteurs.nom })
    .from(t.compteurs)
    .orderBy(asc(t.compteurs.createdAt));
  let clientIds = [...new Set(meters.map((m) => m.clientId))];
  if (o.exclureGagnants !== false) {
    const won = new Set((await db.select({ id: t.tirages.clientId }).from(t.tirages).where(sql`${t.tirages.statut} <> 'annule'`)).map((r) => r.id));
    clientIds = clientIds.filter((id) => !won.has(id));
  }
  if (o.actifsSeulement) {
    const since = isoDate(addDays(today, -30));
    const rows = await db
      .selectDistinct({ id: t.compteurs.clientId })
      .from(t.releves)
      .innerJoin(t.compteurs, eq(t.compteurs.id, t.releves.compteurId))
      .where(gte(t.releves.date, since));
    const active = new Set(rows.map((r) => r.id));
    clientIds = clientIds.filter((id) => active.has(id));
  }
  return { clientIds, meters };
}

export async function lotteryParticipants(db: DB, o: LotteryOptions) {
  return (await lotteryPool(db, o)).clientIds.length;
}

/** Tire un client au hasard (tirage cryptographique, chances égales par client) et enregistre le résultat. */
export async function drawLottery(db: DB, o: LotteryOptions, today = todayLocal()) {
  const { clientIds, meters } = await lotteryPool(db, o, today);
  if (!clientIds.length) throw new ActionError("aucun_participant");
  const winner = clientIds[randomInt(clientIds.length)];
  const [c] = await db.select().from(t.clients).where(eq(t.clients.id, winner));
  // Compteur principal du gagnant : le premier enregistré
  const meter = meters.find((m) => m.clientId === winner)!;
  const conso = await monthlyConsumption(db, meter.compteurId, today);
  const [row] = await db
    .insert(t.tirages)
    .values({
      clientId: winner,
      compteurId: meter.compteurId,
      nom: c?.nom ?? "",
      email: c?.email ?? "",
      telephone: c?.telephone ?? null,
      numeroCompteur: meter.numero,
      nomCompteur: meter.nom,
      consoMoisKwh: conso.kwh,
      montantMois: conso.montant,
      participants: clientIds.length,
    })
    .returning();
  return { ...row, releves: conso.releves };
}

export async function lotteryHistory(db: DB) {
  return db.select().from(t.tirages).orderBy(desc(t.tirages.createdAt)).limit(50);
}

/**
 * Recharge faite : le gagnant est prévenu (alerte, notification et e-mail) avec le montant rechargé ;
 * en option, un mois d'abonnement lui est offert. Ou tirage annulé.
 */
export async function setLotteryStatus(db: DB, id: number, statut: "recharge" | "annule", o: { montant?: number; moisOffert?: boolean } = {}, today = todayLocal()) {
  const [row] = await db.select().from(t.tirages).where(eq(t.tirages.id, id));
  if (!row) throw new ActionError("tirage_introuvable", 404);
  if (row.statut !== "tire") throw new ActionError("tirage_deja_traite", 409);
  if (statut === "annule") {
    await db.update(t.tirages).set({ statut }).where(eq(t.tirages.id, id));
    return;
  }
  const montant = Math.round(num(o.montant ?? row.montantMois ?? 0, 0, 1_000_000, "montant_invalide"));
  const moisOffert = !!o.moisOffert && !!row.clientId;
  await db.update(t.tirages).set({ statut, montantRecharge: montant || null, moisOffert, rechargeAt: new Date() }).where(eq(t.tirages.id, id));
  if (!row.clientId) return;

  let finAbonnement: string | null = null;
  if (moisOffert) {
    // Le mois offert s'ajoute à la fin de l'essai ou de l'abonnement en cours, sinon il part d'aujourd'hui
    const [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, row.clientId));
    const todayIso = isoDate(today);
    const end = sub?.statut === "actif" && sub.renouvellement && sub.renouvellement > todayIso ? sub.renouvellement : sub?.statut === "essai" && sub.essaiFin > todayIso ? sub.essaiFin : todayIso;
    const until = new Date(`${end}T00:00:00`);
    until.setMonth(until.getMonth() + 1);
    finAbonnement = isoDate(until);
    await db.update(t.abonnements).set({ statut: "actif", offre: sub?.offre === "simple" ? "simple" : "ia", cycle: "mensuel", renouvellement: finAbonnement, updatedAt: new Date() }).where(eq(t.abonnements.clientId, row.clientId));
  }

  const titre = "Vous avez gagné la loterie Woly Elec !";
  const montantTxt = montant ? ` de ${montant.toLocaleString("fr-FR")} F` : "";
  const moisTxt = finAbonnement ? ` Bonus : un mois d'abonnement Woly Elec offert, jusqu'au ${ddmmyyyy(finAbonnement)}.` : "";
  const message = `Votre compteur ${row.numeroCompteur} a été rechargé${montantTxt}, offert par Woly Elec.${moisTxt} Entrez les codes de recharge reçus sur votre compteur, puis faites un relevé.`;
  await db.insert(t.alertes).values({ clientId: row.clientId, compteurId: row.compteurId, type: "loterie", ton: "ok", icone: "check", titre, message, canal: "push" });
  // Notification envoyée même si le client a coupé le canal push : il doit savoir qu'il a gagné
  await sendPush(db, row.clientId, { title: titre, body: message, url: "/app/alertes", tag: `loterie-${id}` }, { force: true });
  if (row.email && mailEnabled()) await sendMail({ to: row.email, ...alertMail(titre, message) }).catch(() => undefined);
  await sendAdminPush(db, "loterie", { title: "Gagnant prévenu", body: `${row.nom || row.email} · ${montant ? `${montant.toLocaleString("fr-FR")} F` : "recharge"}${finAbonnement ? " + 1 mois offert" : ""}`, url: "/admin/loterie", tag: `loterie-${id}` });
}
