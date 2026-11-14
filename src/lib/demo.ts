/**
 * Données de démonstration générées autour de la date du jour.
 * En production, elles viennent de l'API (PostgreSQL) : Client, Compteur, Relevé, Recharge, Appareil, Alerte, Abonnement.
 */
import { addDays, kwhForAmount, type Appliance, type MeterPhase, type Reading } from "./engine";
import { isoDate } from "./format";
import type { Pack, Cycle, PaymentMethod } from "./pricing";

export type Usage = "Ménage" | "Commerce" | "Location" | "Parties communes";
export type Objective = "mois" | "coupure" | "economiser";

export type Meter = {
  id: string;
  name: string;
  number: string;
  usage: Usage;
  phase: MeterPhase;
  site: string;
  occupant?: string;
  debt: number;
};

export type Recharge = {
  id: string;
  meterId: string;
  date: string;
  amount: number;
  kwh: number;
  tokens: string[];
  vendor: string;
  tier: number;
  firstOfMonth: boolean;
};

export type AlertItem = {
  id: string;
  meterId: string;
  tone: "red" | "warn" | "info" | "ok";
  icon?: string;
  title: string;
  body: string;
  date: string;
  read: boolean;
  channel: "push" | "whatsapp" | "sms" | "email";
};

export type Payment = { id: string; date: string; label: string; method: PaymentMethod; amount: number };

export type Subscription = {
  pack: Pack;
  status: "essai" | "actif" | "expire";
  cycle: Cycle;
  trialStart: string;
  trialEnd: string;
  renewsAt?: string;
  year: number;
  payments: Payment[];
};

export type User = {
  name: string;
  initials: string;
  phone: string;
  email: string;
  lang: "Français" | "Wolof";
  channels: { push: boolean; whatsapp: boolean; sms: boolean; email: boolean };
  relances: number;
  rechargeDay: number;
  objective: Objective;
  household: number;
  budget: number;
  consent: boolean;
};

export type StoredReading = Reading & { meterId: string };

export type ChatMsg = { role: "u" | "a"; text: string };

export type State = {
  version: number;
  /** demo : données dans le navigateur ; server : compte réel en base de données */
  mode?: "demo" | "server";
  /** tarif actif (table de tarifs administrable) */
  tariff?: import("./engine").TariffJson;
  scenario: Scenario;
  user: User;
  subscription: Subscription;
  meters: Meter[];
  selectedMeterId: string;
  readings: StoredReading[];
  recharges: Recharge[];
  appliances: Appliance[];
  alerts: AlertItem[];
  iaUsed: Record<string, number>;
  chat: ChatMsg[];
};

export type Scenario = "essai" | "proprietaire" | "fin-essai";

const DAILY = [4.6, 5.4, 4.9, 5.8, 5.0, 5.6, 4.8, 5.3, 5.1, 5.7, 4.9, 5.5, 5.2, 5.1, 4.7, 5.3, 5.9, 5.0, 5.4, 4.8, 5.2];

let seq = 0;
const uid = (p: string) => `${p}${++seq}`;

function tokenOf(n: number) {
  let s = "";
  let x = n * 7919 + 12345;
  for (let i = 0; i < 20; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    s += String(x % 10);
  }
  return s;
}

/** Construit l'historique d'un compteur : relevés quotidiens + recharges du mois et du mois précédent. */
function buildMeter(
  meter: Meter,
  today: Date,
  opts: { endBalance: number; dailyFactor: number; readingsDays: number; recharges: { offset: number; amount: number; vendor: string }[] },
) {
  const readings: StoredReading[] = [];
  const recharges: Recharge[] = [];
  const start = addDays(today, -opts.readingsDays + 1);

  // recharges triées, avec cumul mensuel pour la tranche
  const rs = opts.recharges.map((r) => ({ ...r, date: addDays(today, r.offset) })).sort((a, b) => +a.date - +b.date);
  const boughtByMonth: Record<string, number> = {};
  for (const r of rs) {
    const key = `${r.date.getFullYear()}-${r.date.getMonth()}`;
    const bought = boughtByMonth[key] ?? 0;
    const res = kwhForAmount(r.amount, { boughtMonthKwh: bought, firstRechargeOfMonth: bought === 0, phase: meter.phase, debt: meter.debt });
    boughtByMonth[key] = res.boughtAfter;
    const n = ++seq;
    recharges.push({
      id: `r${n}`,
      meterId: meter.id,
      date: isoDate(r.date),
      amount: r.amount,
      kwh: Math.round(res.kwh * 10) / 10,
      tokens: [tokenOf(n), tokenOf(n + 1), tokenOf(n + 2)],
      vendor: r.vendor,
      tier: res.parts.at(-1)?.tier ?? 1,
      firstOfMonth: bought === 0,
    });
  }

  // reconstitue le solde en remontant le temps depuis le solde final
  const consumption = Array.from({ length: opts.readingsDays }, (_, i) => DAILY[i % DAILY.length] * opts.dailyFactor);
  let balance = opts.endBalance;
  const balances: number[] = new Array(opts.readingsDays);
  for (let i = opts.readingsDays - 1; i >= 0; i--) {
    balances[i] = balance;
    const day = isoDate(addDays(start, i));
    // la veille du jour i, on a consommé consumption[i] et peut-être rechargé le jour i
    balance += consumption[i];
    for (const r of recharges) if (r.date === day) balance -= r.kwh;
    balance = Math.max(balance, 0.5);
  }
  // conso cumulée du mois (code 814) : on suppose ≈ 5,1 kWh/j avant le premier relevé
  let monthCons = (start.getDate() - 1) * 5.1 * opts.dailyFactor;
  for (let i = 0; i < opts.readingsDays; i++) {
    const d = addDays(start, i);
    if (d.getDate() === 1) monthCons = 0;
    monthCons += consumption[i];
    readings.push({
      id: uid("l"),
      meterId: meter.id,
      date: isoDate(d),
      balanceKwh: Math.round(balances[i] * 10) / 10,
      monthKwh: Math.round(monthCons),
      yesterdayKwh: Math.round(consumption[i] * 10) / 10,
      source: i % 5 === 0 ? "lien" : "manuel",
    });
  }
  return { readings, recharges };
}

export function buildDemo(scenario: Scenario = "essai", today = new Date()): State {
  seq = 0;
  const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dom = d0.getDate();
  const main: Meter = { id: "m1", name: "Maison de Dakar", number: "0145 6789 012", usage: "Ménage", phase: "mono", site: "Maison de Dakar", debt: 0 };
  const meters: Meter[] = [main];

  // recharges du compteur principal : début de mois (10 000 F) et milieu (5 000 F), plus celles du mois précédent
  const thisMonth = [
    { offset: -(dom - Math.min(3, dom)), amount: 10000, vendor: "Wave" },
    ...(dom > 9 ? [{ offset: -(dom - 9), amount: 2000, vendor: "Orange Money" }] : []),
  ];
  const lastMonth = [
    { offset: -dom - 4, amount: 8000, vendor: "Wave" },
    { offset: -dom - 18, amount: 6000, vendor: "Free Money" },
    { offset: -dom - 29, amount: 10000, vendor: "Wave" },
    { offset: -dom - 45, amount: 9000, vendor: "Wave" },
    { offset: -dom - 60, amount: 10000, vendor: "Orange Money" },
    { offset: -dom - 75, amount: 7000, vendor: "Wave" },
    { offset: -dom - 92, amount: 10000, vendor: "Wave" },
    { offset: -dom - 110, amount: 8000, vendor: "Free Money" },
    { offset: -dom - 125, amount: 10000, vendor: "Wave" },
    { offset: -dom - 150, amount: 9000, vendor: "Orange Money" },
  ];
  const m1 = buildMeter(main, d0, { endBalance: 41.6, dailyFactor: 1, readingsDays: 21, recharges: [...thisMonth, ...lastMonth] });

  let readings = [...m1.readings];
  let recharges = [...m1.recharges];

  if (scenario === "proprietaire") {
    const others: [Meter, number, number, number][] = [
      [{ id: "m2", name: "Appartement B2", number: "0145 6789 013", usage: "Location", phase: "mono", site: "Résidence Les Almadies", occupant: "M. Ba", debt: 0 }, 4.2, 1.0, 3],
      [{ id: "m3", name: "Appartement A3", number: "0145 2231 884", usage: "Location", phase: "mono", site: "Résidence Les Almadies", occupant: "Mme Sow", debt: 0 }, 13.5, 0.9, 6],
      [{ id: "m4", name: "Appartement C1", number: "0145 7712 306", usage: "Location", phase: "mono", site: "Résidence Les Almadies", occupant: "M. Fall", debt: 0 }, 22, 1.1, 9],
      [{ id: "m5", name: "Appartement A2", number: "0145 5521 640", usage: "Location", phase: "mono", site: "Résidence Les Almadies", occupant: "Mme Ndiaye", debt: 0 }, 52, 0.95, 12],
      [{ id: "m6", name: "Parties communes", number: "0145 9980 127", usage: "Parties communes", phase: "tri", site: "Résidence Les Almadies", occupant: "Syndic", debt: 0 }, 96, 1.25, 7],
    ];
    for (const [m, bal, factor, days] of others) {
      meters.push(m);
      const b = buildMeter(m, d0, { endBalance: bal, dailyFactor: factor, readingsDays: days, recharges: [{ offset: -(dom - Math.min(2, dom)), amount: 8000, vendor: "Wave" }] });
      readings = [...readings, ...b.readings];
      recharges = [...recharges, ...b.recharges];
    }
  }

  const trialStart = addDays(d0, scenario === "fin-essai" ? -31 : -7);
  const subscription: Subscription =
    scenario === "proprietaire"
      ? {
          pack: "ia",
          status: "actif",
          cycle: "annuel",
          trialStart: isoDate(addDays(d0, -60)),
          trialEnd: isoDate(addDays(d0, -30)),
          renewsAt: isoDate(addDays(d0, 335)),
          year: 1,
          payments: [{ id: "WE-0001", date: isoDate(addDays(d0, -30)), label: "Woly Elec IA · 6 compteurs · 1re année", method: "Wave", amount: (2499 + 5 * 1499) * 11 }],
        }
      : {
          pack: "ia",
          status: scenario === "fin-essai" ? "expire" : "essai",
          cycle: "mensuel",
          trialStart: isoDate(trialStart),
          trialEnd: isoDate(addDays(trialStart, 30)),
          year: 1,
          payments: [],
        };

  const alerts: AlertItem[] = [
    { id: "a1", meterId: "m1", tone: "info", icon: "wallet", title: "Recharge recommandée", body: "Rechargez avant l'épuisement estimé pour garder une marge, en restant au maximum en tranche 1.", date: isoDate(addDays(d0, -2)), read: false, channel: "whatsapp" },
    { id: "a2", meterId: "m1", tone: "warn", icon: "trend", title: "Consommation anormale", body: "Il y a 4 jours : 9 kWh, bien au-dessus de votre moyenne. Un appareil est peut-être resté allumé.", date: isoDate(addDays(d0, -4)), read: false, channel: "push" },
    { id: "a3", meterId: "m1", tone: "ok", icon: "check", title: "Recharge enregistrée", body: "Environ 114 kWh reçus pour 10 000 F. Votre électricité devrait durer jusqu'à la fin du mois si votre consommation reste stable.", date: recharges[0]?.date ?? isoDate(d0), read: true, channel: "whatsapp" },
    { id: "a4", meterId: "m1", tone: "warn", icon: "clock", title: "Abonnement", body: "Votre essai gratuit se termine bientôt. Sans abonnement, vous ne recevrez plus vos alertes de coupure.", date: isoDate(addDays(d0, -1)), read: false, channel: "email" },
  ];
  if (scenario === "proprietaire") {
    alerts.unshift({ id: "a0", meterId: "m2", tone: "red", title: "Appartement B2 · M. Ba : environ 1 jour d'électricité", body: "Une alerte d'urgence a été envoyée par WhatsApp il y a 2 heures. Aucune mise à jour depuis.", date: isoDate(d0), read: false, channel: "whatsapp" });
  }

  return {
    version: 1,
    scenario,
    user: {
      name: "M. Diallo",
      initials: "MD",
      phone: "+221 77 123 45 67",
      email: "m.diallo@example.sn",
      lang: "Français",
      channels: { push: true, whatsapp: true, sms: false, email: true },
      relances: 2,
      rechargeDay: 5,
      objective: "mois",
      household: 5,
      budget: 15000,
      consent: true,
    },
    subscription,
    meters,
    selectedMeterId: "m1",
    readings,
    recharges,
    appliances: [
      { id: "ap1", name: "Réfrigérateur", watts: 150, hoursPerDay: 12, daysPerWeek: 7 },
      { id: "ap2", name: "Climatiseur", watts: 900, hoursPerDay: 3, daysPerWeek: 7 },
      { id: "ap3", name: "Télévision", watts: 80, hoursPerDay: 5, daysPerWeek: 7 },
      { id: "ap4", name: "Éclairage", watts: 60, hoursPerDay: 6, daysPerWeek: 7 },
      { id: "ap5", name: "Ventilateur", watts: 55, hoursPerDay: 8, daysPerWeek: 7 },
    ],
    alerts,
    iaUsed: { m1: 18 },
    chat: [],
  };
}
