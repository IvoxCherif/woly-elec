/**
 * Moteur de calcul Woly Elec.
 * Source : Notion « Spécifications du moteur de calcul » (corrigée le 19/10/2026) et cahier des charges v2.
 * Toutes les valeurs tarifaires viennent d'une configuration (TariffConfig), jamais du code métier :
 * en production, elle est lue depuis la table de tarifs administrable.
 */

export type Tier = { /** borne haute cumulée en kWh achetés dans le mois */ limit: number; /** FCFA par kWh */ price: number };

export type TariffConfig = {
  tiers: Tier[];
  /** taxe communale, appliquée à chaque recharge (0,025 = 2,5 %) */
  communalTax: number;
  /** redevance (location du compteur), une fois par mois, sur la 1re recharge */
  redevance: { mono: number; tri: number };
  /** marges de sécurité selon l'ancienneté des relevés */
  margins: { regular: number; average: number; newClient: number };
};

export const DEFAULT_TARIFF: TariffConfig = {
  tiers: [
    { limit: 150, price: 82 },
    { limit: 250, price: 136.49 },
    { limit: Infinity, price: Math.round(136.49 * 1.18 * 100) / 100 }, // TVA 18 % au-delà de 250 kWh (à confirmer)
  ],
  communalTax: 0.025,
  redevance: { mono: 429, tri: 1427 },
  margins: { regular: 0.1, average: 0.15, newClient: 0.2 },
};

// ——— Tarif actif (lu depuis la table de tarifs administrable) ———

let ACTIVE: TariffConfig = DEFAULT_TARIFF;
/** Tarif utilisé par défaut par toutes les fonctions du moteur. */
export const activeTariff = (): TariffConfig => ACTIVE;
export function setActiveTariff(cfg: TariffConfig) {
  ACTIVE = cfg;
}

/** Forme JSON (base de données, API) : une limite `null` signifie « sans limite ». */
export type TariffJson = Omit<TariffConfig, "tiers"> & { tiers: { limit: number | null; price: number }[] };
export const tariffToJson = (c: TariffConfig): TariffJson => ({ ...c, tiers: c.tiers.map((t) => ({ limit: Number.isFinite(t.limit) ? t.limit : null, price: t.price })) });
export const tariffFromJson = (j: TariffJson): TariffConfig => ({ ...j, tiers: j.tiers.map((t) => ({ limit: t.limit ?? Infinity, price: t.price })) });

export type MeterPhase = "mono" | "tri";

export type RechargeContext = {
  /** kWh déjà achetés ce mois-ci (remis à zéro le 1er) */
  boughtMonthKwh: number;
  /** true si aucune recharge n'a encore été faite ce mois-ci : la redevance s'applique */
  firstRechargeOfMonth: boolean;
  phase?: MeterPhase;
  /** retenue de dette Senelec sur chaque recharge, en FCFA */
  debt?: number;
};

export type TierPart = { tier: number; kwh: number; cost: number; price: number };

export type KwhResult = {
  kwh: number;
  net: number;
  tax: number;
  redevance: number;
  debt: number;
  parts: TierPart[];
  /** kWh achetés cumulés après la recharge */
  boughtAfter: number;
};

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Numéro de tranche (1, 2, 3) pour un cumul de kWh achetés. */
export function tierIndexFor(boughtMonthKwh: number, cfg: TariffConfig = activeTariff()): number {
  const i = cfg.tiers.findIndex((t) => boughtMonthKwh < t.limit);
  return (i === -1 ? cfg.tiers.length - 1 : i) + 1;
}

/** kWh restants dans la tranche courante avant de passer à la suivante. */
export function kwhLeftInTier(boughtMonthKwh: number, cfg: TariffConfig = activeTariff()): number {
  const t = cfg.tiers[tierIndexFor(boughtMonthKwh, cfg) - 1];
  return Number.isFinite(t.limit) ? Math.max(0, t.limit - boughtMonthKwh) : Infinity;
}

/** kWh obtenus pour un montant donné : le montant net remplit la tranche 1, puis la 2, puis la 3. */
export function kwhForAmount(amount: number, ctx: RechargeContext, cfg: TariffConfig = activeTariff()): KwhResult {
  const tax = amount * cfg.communalTax;
  const redevance = ctx.firstRechargeOfMonth ? cfg.redevance[ctx.phase ?? "mono"] : 0;
  const debt = ctx.debt ?? 0;
  let net = Math.max(0, amount - tax - redevance - debt);
  const netStart = net;
  let bought = ctx.boughtMonthKwh;
  let kwh = 0;
  const parts: TierPart[] = [];
  cfg.tiers.forEach((t, i) => {
    if (net <= 0) return;
    const room = Math.max(0, t.limit - bought);
    if (room <= 0) return;
    const cost = room * t.price;
    if (net <= cost) {
      const k = net / t.price;
      parts.push({ tier: i + 1, kwh: k, cost: net, price: t.price });
      kwh += k;
      bought += k;
      net = 0;
    } else {
      parts.push({ tier: i + 1, kwh: room, cost, price: t.price });
      kwh += room;
      bought += room;
      net -= cost;
    }
  });
  return { kwh, net: netStart, tax, redevance, debt, parts, boughtAfter: bought };
}

/** Montant (FCFA) à payer pour obtenir un besoin en kWh, frais inclus. */
export function amountForKwh(needKwh: number, ctx: RechargeContext, cfg: TariffConfig = activeTariff()): number {
  if (needKwh <= 0) return 0;
  let need = needKwh;
  let bought = ctx.boughtMonthKwh;
  let energy = 0;
  for (const t of cfg.tiers) {
    const part = Math.min(need, Math.max(0, t.limit - bought));
    energy += part * t.price;
    need -= part;
    bought += part;
    if (need <= 0) break;
  }
  const redevance = ctx.firstRechargeOfMonth ? cfg.redevance[ctx.phase ?? "mono"] : 0;
  return (energy + redevance + (ctx.debt ?? 0)) / (1 - cfg.communalTax);
}

// ——— Dates ———

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Jours restants avant la fin du mois (au 20 octobre : 11). */
export function daysLeftInMonth(d: Date): number {
  return daysInMonth(d) - d.getDate();
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function firstOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

// ——— Consommation et autonomie ———

export type Reading = {
  id: string;
  date: string; // ISO
  balanceKwh: number; // code 801
  monthKwh: number; // code 814
  yesterdayKwh: number; // code 813
  source: "manuel" | "ocr" | "lien";
};

/** Moyenne journalière sur les n derniers relevés (code 813). 3 j pour les alertes, 7 ou 30 j pour le plan. */
export function averageDaily(readings: Reading[], window = 7): number {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted.slice(-window).map((r) => r.yesterdayKwh).filter((v) => v > 0);
  if (last.length === 0) return 0;
  return last.reduce((s, v) => s + v, 0) / last.length;
}

/** jours restants = solde kWh / consommation moyenne journalière */
export function autonomyDays(balanceKwh: number, avgDaily: number): number {
  if (avgDaily <= 0) return Infinity;
  return balanceKwh / avgDaily;
}

export type Level = "ok" | "warn" | "risk";

/** Sain : plus de 5 jours · Attention : 3 à 5 jours (et jusqu'à 1) · Urgence : 1 jour ou moins. */
export function levelFor(days: number): Level {
  if (days > 5) return "ok";
  if (days > 1) return "warn";
  return "risk";
}

/** Seuils d'alerte du cahier des charges : 5, 3, 1 jour et moins d'un jour. */
export function alertThreshold(days: number): 5 | 3 | 1 | 0 | null {
  if (days < 1) return 0;
  if (days <= 1) return 1;
  if (days <= 3) return 3;
  if (days <= 5) return 5;
  return null;
}

/** Marge de sécurité : 20–25 % nouveau client, 15 % client moyen, 10 % client régulier. */
export function safetyMargin(readingsCount: number, cfg: TariffConfig = activeTariff()): number {
  if (readingsCount < 7) return cfg.margins.newClient;
  if (readingsCount < 14) return cfg.margins.average;
  return cfg.margins.regular;
}

export type Reliability = { label: "faible" | "moyenne" | "bonne" | "très bonne"; bars: 1 | 2 | 3 | 4 };

export function reliability(readingsCount: number): Reliability {
  if (readingsCount < 3) return { label: "faible", bars: 1 };
  if (readingsCount < 7) return { label: "moyenne", bars: 2 };
  if (readingsCount < 20) return { label: "bonne", bars: 3 };
  return { label: "très bonne", bars: 4 };
}

const ceilTo = (n: number, step: number) => Math.ceil(n / step) * step;

export type MonthPlanInput = {
  date: Date;
  balanceKwh: number;
  avgDaily: number;
  boughtMonthKwh: number;
  firstRechargeOfMonth: boolean;
  phase?: MeterPhase;
  debt?: number;
  readingsCount: number;
};

export type MonthPlan = {
  daysLeft: number;
  autonomy: number;
  depletionDate: Date | null;
  coversMonth: boolean;
  needKwh: number;
  margin: number;
  minAmount: number;
  recommendedAmount: number;
  level: Level;
};

/**
 * Besoin jusqu'à la fin du mois : (jours restants × conso moyenne) − solde.
 * Montant minimum = besoin exact ; montant recommandé = besoin + marge de sécurité.
 */
export function monthPlan(i: MonthPlanInput, cfg: TariffConfig = activeTariff()): MonthPlan {
  const daysLeft = daysLeftInMonth(i.date);
  const autonomy = autonomyDays(i.balanceKwh, i.avgDaily);
  const needKwh = Math.max(0, daysLeft * i.avgDaily - i.balanceKwh);
  const margin = safetyMargin(i.readingsCount, cfg);
  const ctx: RechargeContext = {
    boughtMonthKwh: i.boughtMonthKwh,
    firstRechargeOfMonth: i.firstRechargeOfMonth,
    phase: i.phase,
    debt: i.debt,
  };
  const min = amountForKwh(needKwh, ctx, cfg);
  const rec = amountForKwh(needKwh * (1 + margin), ctx, cfg);
  return {
    daysLeft,
    autonomy,
    depletionDate: Number.isFinite(autonomy) ? addDays(i.date, Math.floor(autonomy)) : null,
    coversMonth: autonomy >= daysLeft,
    needKwh,
    margin,
    minAmount: needKwh > 0 ? ceilTo(min, 100) : 0,
    recommendedAmount: needKwh > 0 ? ceilTo(rec, 500) : 0,
    level: levelFor(autonomy),
  };
}

export type BestDay = {
  date: Date;
  kind: "maintenant" | "avant-epuisement" | "premier-du-mois" | "inutile";
  title: string;
  reason: string;
};

/**
 * Meilleur jour de recharge : celui qui donne le plus de kWh sans risque de coupure.
 * Le 1er du mois, le cumul de tranche repart à zéro ; la redevance ne change pas le meilleur jour.
 */
export function bestRechargeDay(i: MonthPlanInput, cfg: TariffConfig = activeTariff()): BestDay {
  const plan = monthPlan(i, cfg);
  const first = firstOfNextMonth(i.date);
  const tier = tierIndexFor(i.boughtMonthKwh, cfg);
  if (plan.coversMonth) {
    return {
      date: first,
      kind: "inutile",
      title: "Le 1er du mois prochain",
      reason: "Votre crédit couvre la fin du mois. Rechargez le 1er : vos kWh repartent en tranche 1.",
    };
  }
  if (plan.autonomy <= 1) {
    return {
      date: i.date,
      kind: "maintenant",
      title: "Aujourd'hui",
      reason: "Votre crédit risque de s'épuiser dans moins d'un jour. Rechargez le montant minimum maintenant.",
    };
  }
  const safeDay = addDays(i.date, Math.max(0, Math.floor(plan.autonomy) - 1));
  if (tier >= 2) {
    return {
      date: safeDay,
      kind: "avant-epuisement",
      title: `Le ${safeDay.getDate()}`,
      reason:
        "Vous avez dépassé 150 kWh achetés ce mois-ci : rechargez seulement le minimum avant l'épuisement, puis le reste le 1er en tranche 1.",
    };
  }
  return {
    date: safeDay,
    kind: "avant-epuisement",
    title: `Le ${safeDay.getDate()}`,
    reason: `Rechargez au plus tard le ${safeDay.getDate()}, un jour avant l'épuisement estimé, pour garder une marge.`,
  };
}

export type Simulation = KwhResult & {
  tierLabel: string;
  avgCost: number;
  autonomyGained: number;
  autonomyTotal: number;
};

/** Simulateur : kWh estimés, tranche utilisée, coût moyen et autonomie obtenue pour un montant. */
export function simulate(
  amount: number,
  ctx: RechargeContext & { balanceKwh: number; avgDaily: number },
  cfg: TariffConfig = activeTariff(),
): Simulation {
  const r = kwhForAmount(amount, ctx, cfg);
  const tiers = r.parts.filter((p) => p.kwh > 0).map((p) => p.tier);
  const tierLabel =
    tiers.length === 0 ? "—" : tiers.length === 1 ? `Tranche ${tiers[0]}` : `Tranches ${tiers.join(" et ")}`;
  return {
    ...r,
    tierLabel,
    avgCost: r.kwh > 0 ? amount / r.kwh : 0,
    autonomyGained: autonomyDays(r.kwh, ctx.avgDaily),
    autonomyTotal: autonomyDays(r.kwh + ctx.balanceKwh, ctx.avgDaily),
  };
}

// ——— Appareils ———

export type Appliance = { id: string; name: string; watts: number; hoursPerDay: number; daysPerWeek: number };

/** kWh/jour = (watts × heures) / 1000, pondéré par les jours d'utilisation dans la semaine. */
export function applianceKwhPerDay(a: Pick<Appliance, "watts" | "hoursPerDay" | "daysPerWeek">): number {
  return ((a.watts * a.hoursPerDay) / 1000) * (a.daysPerWeek / 7);
}

export { round };
