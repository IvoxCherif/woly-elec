"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  averageDaily,
  bestRechargeDay,
  daysInMonth,
  kwhForAmount,
  monthPlan,
  reliability,
  tierIndexFor,
  kwhLeftInTier,
  type Appliance,
  type BestDay,
  type MonthPlan,
  type Reliability,
} from "./engine";
import { buildDemo, type AlertItem, type Meter, type Recharge, type Scenario, type State, type StoredReading, type User } from "./demo";
import { isoDate } from "./format";
import type { Cycle, Pack, PaymentMethod } from "./pricing";
import { annualPrice, monthlyPrice } from "./pricing";

const KEY = "woly-elec-demo-v1";

type Toast = { id: number; text: string };

type Ctx = {
  state: State;
  ready: boolean;
  today: Date;
  meter: Meter;
  toasts: Toast[];
  notify: (text: string) => void;
  selectMeter: (id: string) => void;
  addReading: (r: Omit<StoredReading, "id" | "source"> & { source?: StoredReading["source"] }) => void;
  addRecharge: (r: { meterId: string; date: string; amount: number; vendor: string; tokens: string[]; kwh?: number }) => Recharge;
  addMeter: (m: Omit<Meter, "id">) => void;
  removeMeter: (id: string) => void;
  updateMeter: (id: string, patch: Partial<Meter>) => void;
  addAppliance: (a: Omit<Appliance, "id">) => void;
  removeAppliance: (id: string) => void;
  updateUser: (patch: Partial<User>) => void;
  markAlertsRead: () => void;
  dismissAlert: (id: string) => void;
  subscribe: (pack: Pack, cycle: Cycle, meters: number, method: PaymentMethod) => { id: string; amount: number; until: string };
  changePack: (pack: Pack) => void;
  askIa: (question: string, answer: string) => boolean;
  loadScenario: (s: Scenario) => void;
  reset: () => void;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => buildDemo("essai"));
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as State;
        if (s.version === 1) setState(s);
      }
    } catch {
      /* stockage indisponible : on garde la démo */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready]);

  const notify = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const meter = state.meters.find((m) => m.id === state.selectedMeterId) ?? state.meters[0];

  const api: Ctx = {
    state,
    ready,
    today,
    meter,
    toasts,
    notify,
    selectMeter: (id) => setState((s) => ({ ...s, selectedMeterId: id })),
    addReading: (r) =>
      setState((s) => ({
        ...s,
        readings: [...s.readings.filter((x) => !(x.meterId === r.meterId && x.date === r.date)), { ...r, source: r.source ?? "manuel", id: `l${Date.now()}` }],
      })),
    addRecharge: (r) => {
      const monthKey = r.date.slice(0, 7);
      const prev = state.recharges.filter((x) => x.meterId === r.meterId && x.date.slice(0, 7) === monthKey);
      const bought = prev.reduce((t, x) => t + x.kwh, 0);
      const m = state.meters.find((x) => x.id === r.meterId)!;
      const res = kwhForAmount(r.amount, { boughtMonthKwh: bought, firstRechargeOfMonth: prev.length === 0, phase: m.phase, debt: m.debt });
      const rec: Recharge = {
        id: `r${Date.now()}`,
        meterId: r.meterId,
        date: r.date,
        amount: r.amount,
        kwh: Math.round((r.kwh ?? res.kwh) * 10) / 10,
        tokens: r.tokens,
        vendor: r.vendor,
        tier: res.parts.at(-1)?.tier ?? tierIndexFor(bought),
        firstOfMonth: prev.length === 0,
      };
      setState((s) => ({
        ...s,
        recharges: [...s.recharges, rec],
        alerts: [
          { id: `a${Date.now()}`, meterId: r.meterId, tone: "ok", icon: "check", title: "Recharge enregistrée", body: `${r.amount.toLocaleString("fr-FR")} F · environ ${Math.round(rec.kwh)} kWh reçus. Mettez à jour votre solde après avoir saisi les codes.`, date: r.date, read: false, channel: "push" },
          ...s.alerts,
        ],
      }));
      return rec;
    },
    addMeter: (m) =>
      setState((s) => {
        const id = `m${Date.now()}`;
        return { ...s, meters: [...s.meters, { ...m, id }], selectedMeterId: id };
      }),
    removeMeter: (id) =>
      setState((s) => {
        const meters = s.meters.filter((m) => m.id !== id);
        return { ...s, meters, selectedMeterId: s.selectedMeterId === id ? meters[0]?.id ?? "" : s.selectedMeterId };
      }),
    updateMeter: (id, patch) => setState((s) => ({ ...s, meters: s.meters.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
    addAppliance: (a) => setState((s) => ({ ...s, appliances: [...s.appliances, { ...a, id: `ap${Date.now()}` }] })),
    removeAppliance: (id) => setState((s) => ({ ...s, appliances: s.appliances.filter((a) => a.id !== id) })),
    updateUser: (patch) => setState((s) => ({ ...s, user: { ...s.user, ...patch } })),
    markAlertsRead: () => setState((s) => ({ ...s, alerts: s.alerts.map((a) => ({ ...a, read: true })) })),
    dismissAlert: (id) => setState((s) => ({ ...s, alerts: s.alerts.filter((a) => a.id !== id) })),
    subscribe: (pack, cycle, meters, method) => {
      const amount = cycle === "mensuel" ? monthlyPrice(pack, meters) : annualPrice(pack, meters, state.subscription.year);
      const until = new Date(today);
      if (cycle === "mensuel") until.setMonth(until.getMonth() + 1);
      else until.setFullYear(until.getFullYear() + 1);
      const id = `WE-${String(state.subscription.payments.length + 1).padStart(4, "0")}`;
      setState((s) => ({
        ...s,
        subscription: {
          ...s.subscription,
          pack,
          cycle,
          status: "actif",
          renewsAt: isoDate(until),
          payments: [
            { id, date: isoDate(today), label: `${pack === "ia" ? "Woly Elec IA" : "Woly Elec 1"} · ${meters} compteur${meters > 1 ? "s" : ""} · ${cycle === "mensuel" ? "1 mois" : "12 mois"}`, method, amount },
            ...s.subscription.payments,
          ],
        },
      }));
      return { id, amount, until: isoDate(until) };
    },
    changePack: (pack) => setState((s) => ({ ...s, subscription: { ...s.subscription, pack } })),
    askIa: (question, answer) => {
      const used = state.iaUsed[meter.id] ?? 0;
      if (used >= 30) return false;
      setState((s) => ({
        ...s,
        iaUsed: { ...s.iaUsed, [meter.id]: used + 1 },
        chat: [...s.chat, { role: "u", text: question }, { role: "a", text: answer }],
      }));
      return true;
    },
    loadScenario: (sc) => setState(buildDemo(sc)),
    reset: () => setState(buildDemo("essai")),
  };

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return c;
}

// ——— Calculs dérivés par compteur ———

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

export function computeStats(state: State, meterId: string, today: Date): MeterStats {
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
  const input = {
    date: today,
    balanceKwh: last?.balanceKwh ?? 0,
    avgDaily: avg7 || 5,
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

export function useMeterStats(meterId?: string): MeterStats {
  const { state, today } = useStore();
  const id = meterId ?? state.selectedMeterId;
  return useMemo(() => computeStats(state, id, today), [state, id, today]);
}

export function trialDaysLeft(state: State, today: Date): number {
  const end = new Date(state.subscription.trialEnd);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
}
