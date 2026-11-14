import { describe, expect, it } from "vitest";
import {
  amountForKwh,
  applianceKwhPerDay,
  autonomyDays,
  bestRechargeDay,
  daysLeftInMonth,
  DEFAULT_TARIFF,
  kwhForAmount,
  kwhLeftInTier,
  levelFor,
  monthPlan,
  tierIndexFor,
} from "./engine";
import { annualPrice, monthlyPrice } from "./pricing";

// Cas de test de la page Notion « Spécifications du moteur de calcul »
describe("kWh pour un montant", () => {
  it("5 000 F, 1re recharge du mois : (4 875 − 429) / 82 ≈ 54,2 kWh", () => {
    expect(kwhForAmount(5000, { boughtMonthKwh: 0, firstRechargeOfMonth: true }).kwh).toBeCloseTo(54.2, 1);
  });
  it("5 000 F, recharge suivante en tranche 1 : 4 875 / 82 ≈ 59,4 kWh", () => {
    expect(kwhForAmount(5000, { boughtMonthKwh: 40, firstRechargeOfMonth: false }).kwh).toBeCloseTo(59.45, 2);
  });
  it("10 000 F, 1re recharge : ≈ 113,7 kWh", () => {
    expect(kwhForAmount(10000, { boughtMonthKwh: 0, firstRechargeOfMonth: true }).kwh).toBeCloseTo(113.7, 1);
  });
  it("10 000 F, 150 kWh déjà achetés : 9 750 / 136,49 ≈ 71,4 kWh", () => {
    expect(kwhForAmount(10000, { boughtMonthKwh: 150, firstRechargeOfMonth: false }).kwh).toBeCloseTo(71.4, 1);
  });
  it("validation historique au tarif 2023 (91,17 F) : 48,8 et 53,5 kWh", () => {
    const cfg = { ...DEFAULT_TARIFF, tiers: [{ limit: 150, price: 91.17 }, ...DEFAULT_TARIFF.tiers.slice(1)] };
    expect(kwhForAmount(5000, { boughtMonthKwh: 0, firstRechargeOfMonth: true }, cfg).kwh).toBeCloseTo(48.8, 1);
    expect(kwhForAmount(5000, { boughtMonthKwh: 0, firstRechargeOfMonth: false }, cfg).kwh).toBeCloseTo(53.5, 1);
  });
  it("répartit un montant sur deux tranches", () => {
    const r = kwhForAmount(10000, { boughtMonthKwh: 120, firstRechargeOfMonth: false });
    expect(r.parts.map((p) => p.tier)).toEqual([1, 2]);
    expect(r.parts[0].kwh).toBe(30);
  });
});

describe("montant pour un besoin", () => {
  it("Annexe C : 135 kWh achetés, besoin 38 kWh ≈ 4 481 F", () => {
    expect(amountForKwh(38, { boughtMonthKwh: 135, firstRechargeOfMonth: false })).toBeCloseTo(4481, 0);
  });
  it("Scénario 1 : 38 kWh en tranche 1 ≈ 3 196 F", () => {
    expect(amountForKwh(38, { boughtMonthKwh: 0, firstRechargeOfMonth: false })).toBeCloseTo(3196, 0);
  });
  it("aller-retour montant ↔ kWh", () => {
    const ctx = { boughtMonthKwh: 100, firstRechargeOfMonth: true };
    expect(kwhForAmount(amountForKwh(80, ctx), ctx).kwh).toBeCloseTo(80, 6);
  });
});

describe("tranches", () => {
  it("814 = 120 kWh achetés : tranche 1, 30 kWh restants", () => {
    expect(tierIndexFor(120)).toBe(1);
    expect(kwhLeftInTier(120)).toBe(30);
  });
  it("170 kWh achetés : tranche 2", () => expect(tierIndexFor(170)).toBe(2));
  it("au-delà de 250 kWh : tranche 3", () => expect(tierIndexFor(260)).toBe(3));
});

describe("autonomie et plan", () => {
  it("exemple présentation : 66 kWh le 17 à 5,2 kWh/j ≈ 12,7 jours, jusqu'au 29", () => {
    expect(autonomyDays(66, 5.2)).toBeCloseTo(12.7, 1);
    const p = monthPlan({
      date: new Date(2026, 10, 17),
      balanceKwh: 66,
      avgDaily: 5.2,
      boughtMonthKwh: 120,
      firstRechargeOfMonth: false,
      readingsCount: 14,
    });
    expect(p.depletionDate?.getDate()).toBe(29);
    expect(p.coversMonth).toBe(false);
  });
  it("Annexe C : 20 octobre → 11 jours restants, besoin 38 kWh", () => {
    const d = new Date(2026, 9, 20);
    expect(daysLeftInMonth(d)).toBe(11);
    const p = monthPlan({ date: d, balanceKwh: 6, avgDaily: 4, boughtMonthKwh: 135, firstRechargeOfMonth: false, readingsCount: 20 });
    expect(p.needKwh).toBe(38);
    expect(p.minAmount).toBe(4500);
    expect(p.recommendedAmount).toBeGreaterThan(p.minAmount);
  });
  it("niveaux d'alerte", () => {
    expect(levelFor(8)).toBe("ok");
    expect(levelFor(3)).toBe("warn");
    expect(levelFor(1)).toBe("risk");
  });
  it("conseille le 1er du mois quand le crédit couvre la fin du mois", () => {
    const b = bestRechargeDay({ date: new Date(2026, 10, 25), balanceKwh: 60, avgDaily: 5, boughtMonthKwh: 160, firstRechargeOfMonth: false, readingsCount: 10 });
    expect(b.kind).toBe("inutile");
    expect(b.date.getDate()).toBe(1);
  });
});

describe("appareils", () => {
  it("climatiseur 1 000 W, 6 h : 6 kWh/jour", () => {
    expect(applianceKwhPerDay({ watts: 1000, hoursPerDay: 6, daysPerWeek: 7 })).toBe(6);
  });
});

describe("prix des offres", () => {
  it("pack simple", () => {
    expect(monthlyPrice("simple", 1)).toBe(1999);
    expect(monthlyPrice("simple", 2)).toBe(2999);
    expect(annualPrice("simple", 1)).toBe(21989);
    expect(annualPrice("simple", 1, 2)).toBe(23988);
    expect(monthlyPrice("simple", 10)).toBe(10999);
  });
  it("pack IA", () => {
    expect(monthlyPrice("ia", 2)).toBe(3998);
    expect(annualPrice("ia", 1)).toBe(27489);
    expect(annualPrice("ia", 5)).toBe(93445);
    expect(annualPrice("ia", 10, 2)).toBe(191880);
  });
});
