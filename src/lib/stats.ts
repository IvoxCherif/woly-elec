/** Calculs dérivés par compteur : partagés par le navigateur (store) et le serveur (alertes). */
import {
  averageDaily,
  bestRechargeDay,
  daysInMonth,
  kwhLeftInTier,
  monthPlan,
  reliability,
  tierIndexFor,
  type BestDay,
  type MonthPlan,
  type Reliability,
} from "./engine";
import type { AlertItem, Meter, Recharge, State, StoredReading } from "./demo";
import { isoDate } from "./format";

export type MeterStats = {
  meter: Meter;
  readings: StoredReading[];
  last?: StoredReading;
  recharges: Recharge[];
  monthRecharges: Recharge[];
  boughtMonthKwh: number;
  tier: number;
  leftInTier: number;
  avg3: number;
  avg7: number;
  avg30: number;
  plan: MonthPlan;
  best: BestDay;
  reliability: Reliability;
  daysInMonth: number;
  firstRechargeOfMonth: boolean;
  alerts: AlertItem[];
};

type StatsInput = Pick<State, "meters" | "readings" | "recharges" | "alerts">;

export function computeStats(state: StatsInput, meterId: string, today: Date): MeterStats {
  const meter = state.meters.find((m) => m.id === meterId) ?? state.meters[0];
  const readings = state.readings.filter((r) => r.meterId === meter.id).sort((a, b) => a.date.localeCompare(b.date));
  const last = readings.at(-1);
  const recharges = state.recharges.filter((r) => r.meterId === meter.id).sort((a, b) => b.date.localeCompare(a.date));
  const monthKey = isoDate(today).slice(0, 7);
  const monthRecharges = recharges.filter((r) => r.date.slice(0, 7) === monthKey);
  const boughtMonthKwh = monthRecharges.reduce((t, r) => t + r.kwh, 0);
  const avg3 = averageDaily(readings, 3);
  const avg7 = averageDaily(readings, 7);
  const avg30 = averageDaily(readings, 30);
  // Nouveau client (moins de 3 relevés) : la conso du mois (code 814) ÷ jours écoulés est plus fiable qu'une seule veille (813)
  const monthAvg = last && last.monthKwh > 0 && today.getDate() > 1 ? last.monthKwh / (today.getDate() - 1) : 0;
  const avgPlan = readings.length < 3 && monthAvg > 0 ? monthAvg : avg7;
  const input = {
    date: today,
    balanceKwh: last?.balanceKwh ?? 0,
    avgDaily: avgPlan || 5,
    boughtMonthKwh,
    firstRechargeOfMonth: monthRecharges.length === 0,
    phase: meter.phase,
    debt: meter.debt,
    readingsCount: readings.length,
  };
  // alertes urgentes : moyenne 3 jours ; plan du mois : moyenne 7 jours
  const plan = monthPlan(input);
  const urgent = monthPlan({ ...input, avgDaily: avg3 || input.avgDaily });
  plan.level = urgent.level;
  return {
    meter,
    readings,
    last,
    recharges,
    monthRecharges,
    boughtMonthKwh,
    tier: tierIndexFor(boughtMonthKwh),
    leftInTier: kwhLeftInTier(boughtMonthKwh),
    avg3,
    avg7,
    avg30,
    plan,
    best: bestRechargeDay(input),
    reliability: reliability(readings.length),
    daysInMonth: daysInMonth(today),
    firstRechargeOfMonth: monthRecharges.length === 0,
    alerts: state.alerts.filter((a) => a.meterId === meter.id),
  };
}

export function trialDaysLeft(state: Pick<State, "subscription">, today: Date): number {
  const end = new Date(state.subscription.trialEnd);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
}
