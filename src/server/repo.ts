import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as t from "@/db/schema";
import type { Action } from "@/lib/actions";
import type { AlertItem, Meter, Objective, Recharge, State, StoredReading, Usage, User } from "@/lib/demo";
import { addDays, alertThreshold, autonomyDays, DEFAULT_TARIFF, kwhForAmount, setActiveTariff, tariffFromJson, tariffToJson, tierIndexFor, type TariffJson } from "@/lib/engine";
import { isoDate } from "@/lib/format";
import { normalizePhone } from "./phone";
import { annualPrice, IA_QUOTA_PER_METER, monthlyPrice, PACKS, PAYMENT_METHODS, TRIAL_DAYS, type Pack } from "@/lib/pricing";
import { computeStats } from "@/lib/stats";
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
  const [appliances, alerts, payments, chat] = await Promise.all([
    db.select().from(t.appareils).where(eq(t.appareils.clientId, clientId)).orderBy(asc(t.appareils.createdAt)),
    db.select().from(t.alertes).where(eq(t.alertes.clientId, clientId)).orderBy(desc(t.alertes.createdAt)).limit(60),
    db.select().from(t.paiements).where(eq(t.paiements.clientId, clientId)).orderBy(desc(t.paiements.createdAt)),
    db.select().from(t.iaMessages).where(eq(t.iaMessages.clientId, clientId)).orderBy(desc(t.iaMessages.id)).limit(40),
  ]);

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
      pack: (sub?.offre ?? "ia") as Pack,
      status: (sub?.statut ?? "expire") as State["subscription"]["status"],
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

  return db.transaction(async (tx) => {
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
        emailVerifie: id.kind === "google", // Google garantit l'adresse ; l'e-mail seul sera vérifié quand l'envoi d'e-mails sera branché
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
  const canal = th <= 1 && ch.sms ? "sms" : ch.whatsapp ? "whatsapp" : "push";
  await db.insert(t.alertes).values({
    clientId,
    compteurId: meterId,
    type,
    ton: th <= 1 ? "red" : "warn",
    icone: th <= 1 ? "bolt" : "warn",
    titre: th === 0 ? "Moins d'un jour d'électricité" : `Il vous reste environ ${th} jour${th > 1 ? "s" : ""}`,
    message,
    canal,
    // WhatsApp et SMS ne sont pas encore branchés : l'alerte est visible dans l'application, l'envoi reste en attente.
    statut: canal === "push" ? "remis" : "en_attente",
  });
}

// ——— Actions du compte client ———

async function ownedMeter(db: DB, clientId: string, meterId: string) {
  const [m] = await db.select().from(t.compteurs).where(and(eq(t.compteurs.id, meterId), eq(t.compteurs.clientId, clientId)));
  if (!m) throw new ActionError("compteur_introuvable", 404);
  return m;
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
      const [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId));
      if (sub?.statut !== "actif") throw new ActionError("abonnement_requis", 402);
      const number = str(a.meter.number, 40);
      if (number.replace(/\D/g, "").length < 8 || !str(a.meter.name)) throw new ActionError("compteur_invalide");
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
        const [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId));
        set.relances = sub?.offre === "ia" ? Math.round(num(p.relances, 0, 6)) : 2; // réglable seulement avec Woly Elec IA
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
      // Aucun agrégateur de paiement n'est encore branché : en mode « demo », le paiement est simulé et tracé comme tel.
      if ((process.env.PAYMENT_MODE ?? "demo") !== "demo") throw new ActionError("paiement_indisponible", 503);
      if (!PAYMENT_METHODS.includes(a.method)) throw new ActionError("moyen_invalide");
      const pack: Pack = a.pack === "simple" ? "simple" : "ia";
      const [{ n }] = await db.select({ n: count() }).from(t.compteurs).where(eq(t.compteurs.clientId, clientId));
      const meters = Math.max(Number(n), Math.round(num(a.meters, 1, 200)));
      const [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId));
      const year = sub?.annee ?? 1;
      const cycle = a.cycle === "annuel" ? "annuel" : "mensuel";
      const amount = cycle === "mensuel" ? monthlyPrice(pack, meters) : annualPrice(pack, meters, year);
      const until = new Date(today);
      if (cycle === "mensuel") until.setMonth(until.getMonth() + 1);
      else until.setFullYear(until.getFullYear() + 1);
      const reference = `WE-${Date.now().toString(36).toUpperCase()}`;
      await db.insert(t.paiements).values({
        clientId,
        reference,
        libelle: `${PACKS[pack].name} · ${meters} compteur${meters > 1 ? "s" : ""} · ${cycle === "mensuel" ? "1 mois" : "12 mois"}`,
        moyen: a.method,
        montant: amount,
        statut: "simule",
      });
      await db
        .update(t.abonnements)
        .set({ offre: pack, statut: "actif", cycle, renouvellement: isoDate(until), updatedAt: new Date() })
        .where(eq(t.abonnements.clientId, clientId));
      return;
    }
    case "pack":
      await db.update(t.abonnements).set({ offre: a.pack === "simple" ? "simple" : "ia", updatedAt: new Date() }).where(eq(t.abonnements.clientId, clientId));
      return;
    case "ia": {
      await ownedMeter(db, clientId, a.meterId);
      const [sub] = await db.select().from(t.abonnements).where(eq(t.abonnements.clientId, clientId));
      if (sub?.offre !== "ia" || sub.statut === "expire") throw new ActionError("offre_ia_requise", 402);
      const mois = todayIso.slice(0, 7);
      const [u] = await db.select().from(t.iaUsage).where(and(eq(t.iaUsage.compteurId, a.meterId), eq(t.iaUsage.mois, mois)));
      if ((u?.requetes ?? 0) >= IA_QUOTA_PER_METER) throw new ActionError("quota_atteint", 429);
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
      pack: r.statut === "essai" ? "Essai" : PACKS[pack].name,
      status: r.statut === "actif" ? "Actif" : r.statut === "essai" ? "Essai" : "Expiré",
      expires: (r.statut === "essai" ? r.essaiFin : r.renouvellement) ?? "—",
      monthly: r.statut === "actif" ? monthlyPrice(pack, Math.max(1, meters)) : 0,
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
