"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { kwhForAmount, setActiveTariff, tariffFromJson, tierIndexFor, type Appliance } from "./engine";
import { buildDemo, type Meter, type Recharge, type Scenario, type State, type StoredReading, type User } from "./demo";
import type { Action } from "./actions";
import { isoDate } from "./format";
import type { Cycle, Pack, PaymentMethod } from "./pricing";
import { annualPrice, monthlyPrice } from "./pricing";
import { computeStats, trialDaysLeft, type MeterStats } from "./stats";

const KEY = "woly-elec-demo-v1";

type Toast = { id: number; text: string };
export type Mode = "demo" | "server";

const ERRORS: Record<string, string> = {
  abonnement_requis: "Un abonnement est nécessaire pour ajouter un compteur.",
  dernier_compteur: "Impossible de supprimer votre dernier compteur.",
  quota_atteint: "Quota IA atteint : renouvelé le 1er du mois.",
  offre_ia_requise: "L'assistant est réservé à Woly Elec IA.",
  date_invalide: "Date invalide.",
  valeur_invalide: "Une valeur saisie est invalide.",
  montant_invalide: "Montant invalide.",
  paiement_indisponible: "Le paiement en ligne n'est pas encore disponible.",
  non_connecte: "Votre session a expiré : reconnectez-vous.",
  telephone_invalide: "Numéro invalide : 9 chiffres, par exemple 77 123 45 67.",
  telephone_deja_utilise: "Ce numéro est déjà utilisé par un autre compte.",
};

type Ctx = {
  state: State;
  mode: Mode;
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
  /** Mode serveur : applique l'état renvoyé par une route (ex. assistant IA). */
  replaceState: (s: State) => void;
  /** Ajoute un échange au fil sans le décompter (réponse du moteur local). */
  pushChat: (question: string, answer: string) => void;
  loadScenario: (s: Scenario) => void;
  reset: () => void;
  logout: () => Promise<void>;
};

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(() => buildDemo("essai"));
  const [mode, setMode] = useState<Mode>("demo");
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const selected = useRef<string>("");
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const notify = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  /** Remplace l'état par celui du serveur en gardant le compteur affiché. */
  const applyServer = useCallback((s: State) => {
    if (s.tariff) setActiveTariff(tariffFromJson(s.tariff));
    const keep = s.meters.some((m) => m.id === selected.current) ? selected.current : s.selectedMeterId;
    setState({ ...s, selectedMeterId: keep });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        if (r.ok) {
          const s = (await r.json()) as State;
          if (!cancelled) {
            applyServer(s);
            setMode("server");
            setReady(true);
          }
          return;
        }
      } catch {
        /* serveur injoignable : mode démo */
      }
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw) as State;
          if (s.version === 1 && !cancelled) setState({ ...s, mode: "demo" });
        }
      } catch {
        /* stockage indisponible : on garde la démo */
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyServer]);

  useEffect(() => {
    selected.current = state.selectedMeterId;
    if (!ready || mode !== "demo") return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state, ready, mode]);

  /** En mode compte : envoie l'action au serveur puis applique l'état officiel (l'affichage local est déjà à jour). */
  const send = useCallback(
    async (action: Action) => {
      if (mode !== "server") return;
      try {
        const r = await fetch("/api/me/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) return applyServer(j as State);
        notify(ERRORS[j.error] ?? "Enregistrement impossible, réessayez.");
        const back = await fetch("/api/me", { cache: "no-store" });
        if (back.ok) applyServer((await back.json()) as State);
      } catch {
        notify("Hors ligne : modification non enregistrée.");
      }
    },
    [mode, applyServer, notify],
  );

  const meter = state.meters.find((m) => m.id === state.selectedMeterId) ?? state.meters[0];

  const api: Ctx = {
    state,
    mode,
    ready,
    today,
    meter,
    toasts,
    notify,
    selectMeter: (id) => setState((s) => ({ ...s, selectedMeterId: id })),
    addReading: (r) => {
      setState((s) => ({
        ...s,
        readings: [...s.readings.filter((x) => !(x.meterId === r.meterId && x.date === r.date)), { ...r, source: r.source ?? "manuel", id: `l${Date.now()}` }],
      }));
      void send({ type: "reading", meterId: r.meterId, date: r.date, balanceKwh: r.balanceKwh, monthKwh: r.monthKwh, yesterdayKwh: r.yesterdayKwh });
    },
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
      void send({ type: "recharge", ...r });
      return rec;
    },
    addMeter: (m) => {
      if (mode === "server") return void send({ type: "meter.add", meter: m });
      setState((s) => {
        const id = `m${Date.now()}`;
        return { ...s, meters: [...s.meters, { ...m, id }], selectedMeterId: id };
      });
    },
    removeMeter: (id) => {
      setState((s) => {
        const meters = s.meters.filter((m) => m.id !== id);
        return { ...s, meters, selectedMeterId: s.selectedMeterId === id ? meters[0]?.id ?? "" : s.selectedMeterId };
      });
      void send({ type: "meter.remove", id });
    },
    updateMeter: (id, patch) => {
      setState((s) => ({ ...s, meters: s.meters.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
      void send({ type: "meter.update", id, patch });
    },
    addAppliance: (a) => {
      setState((s) => ({ ...s, appliances: [...s.appliances, { ...a, id: `ap${Date.now()}` }] }));
      void send({ type: "appliance.add", appliance: a });
    },
    removeAppliance: (id) => {
      setState((s) => ({ ...s, appliances: s.appliances.filter((a) => a.id !== id) }));
      void send({ type: "appliance.remove", id });
    },
    updateUser: (patch) => {
      setState((s) => ({ ...s, user: { ...s.user, ...patch } }));
      const { initials: _i, email: _e, ...rest } = patch;
      void send({ type: "user.update", patch: rest });
    },
    markAlertsRead: () => {
      setState((s) => ({ ...s, alerts: s.alerts.map((a) => ({ ...a, read: true })) }));
      void send({ type: "alerts.read" });
    },
    dismissAlert: (id) => {
      setState((s) => ({ ...s, alerts: s.alerts.filter((a) => a.id !== id) }));
      void send({ type: "alert.dismiss", id });
    },
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
      void send({ type: "subscribe", pack, cycle, meters, method });
      return { id, amount, until: isoDate(until) };
    },
    changePack: (pack) => {
      setState((s) => ({ ...s, subscription: { ...s.subscription, pack } }));
      void send({ type: "pack", pack });
    },
    askIa: (question, answer) => {
      const used = state.iaUsed[meter.id] ?? 0;
      if (used >= 30) return false;
      setState((s) => ({
        ...s,
        iaUsed: { ...s.iaUsed, [meter.id]: used + 1 },
        chat: [...s.chat, { role: "u", text: question }, { role: "a", text: answer }],
      }));
      void send({ type: "ia", meterId: meter.id, question, answer });
      return true;
    },
    replaceState: (s) => applyServer(s),
    pushChat: (question, answer) => setState((s) => ({ ...s, chat: [...s.chat, { role: "u", text: question }, { role: "a", text: answer }] })),
    loadScenario: (sc) => mode === "demo" && setState(buildDemo(sc)),
    reset: () => mode === "demo" && setState(buildDemo("essai")),
    logout: async () => {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      window.location.href = "/";
    },
  };

  return <StoreCtx.Provider value={api}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return c;
}

export { computeStats, trialDaysLeft, type MeterStats };

export function useMeterStats(meterId?: string): MeterStats {
  const { state, today } = useStore();
  const id = meterId ?? state.selectedMeterId;
  return useMemo(() => computeStats(state, id, today), [state, id, today]);
}
