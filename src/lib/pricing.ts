/**
 * Offres et prix (Notion « Tarification et abonnements »).
 * Essai gratuit 30 jours (1 compteur), puis abonnement. Pas de version gratuite permanente.
 * Annuel : 1re année = mensuel × 11 (1 mois offert) ; dès la 2e année = mensuel × 12.
 */

export type Pack = "simple" | "ia";
export type Cycle = "mensuel" | "annuel";

export const PACKS: Record<Pack, { name: string; tagline: string; first: number; extra: number; relances: string }> = {
  simple: { name: "Woly Elec 1", tagline: "L'outil calcule et alerte.", first: 1999, extra: 1000, relances: "2, fixes" },
  ia: { name: "Woly Elec IA", tagline: "L'outil calcule, alerte et explique.", first: 2499, extra: 1499, relances: "Réglables" },
};

export const TRIAL_DAYS = 30;
export const IA_QUOTA_PER_METER = 30;

export function monthlyPrice(pack: Pack, meters: number): number {
  const p = PACKS[pack];
  return p.first + Math.max(0, meters - 1) * p.extra;
}

/** year = 1 pour la 1re année (× 11), sinon × 12 */
export function annualPrice(pack: Pack, meters: number, year = 1): number {
  return monthlyPrice(pack, meters) * (year <= 1 ? 11 : 12);
}

export function priceFor(pack: Pack, meters: number, cycle: Cycle, year = 1): number {
  return cycle === "mensuel" ? monthlyPrice(pack, meters) : annualPrice(pack, meters, year);
}

export const PAYMENT_METHODS = ["Wave", "Orange Money", "Free Money"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
