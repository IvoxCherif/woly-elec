"use client";

import { useMemo } from "react";
import type { MeterStats } from "@/lib/store";
import { useStore } from "@/lib/store";
import { days, fcfa, kwh, monthShort } from "@/lib/format";
import { Gauge } from "../ui";

/** Jauge de crédit d'un compteur : solde en kWh + autonomie. */
export function CreditGauge({ s, size = 250 }: { s: MeterStats; size?: number }) {
  const bal = s.last?.balanceKwh ?? 0;
  const frac = s.plan.coversMonth ? 1 : s.plan.autonomy / Math.max(1, s.plan.daysLeft);
  return <Gauge fraction={frac} level={s.plan.level} value={kwh(bal, bal < 100 ? 1 : 0)} detail={`≈ ${days(s.plan.autonomy)}`} size={size} />;
}

export function depletionLabel(s: MeterStats) {
  if (!s.last) return "Ajoutez un relevé pour estimer votre autonomie";
  if (s.plan.coversMonth) return "Crédit suffisant jusqu'à la fin du mois · estimé";
  const d = s.plan.depletionDate;
  return d ? `Crédit jusqu'au ${d.getDate()} · estimé d'après vos relevés` : "";
}

/** Dépenses de recharge des n derniers mois (pour les barres). */
export function useMonthlySpend(meterId: string, months = 6) {
  const { state, today } = useStore();
  return useMemo(() => {
    const out: { label: string; value: number; hint: string }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const v = state.recharges.filter((r) => r.meterId === meterId && r.date.startsWith(key)).reduce((t, r) => t + r.amount, 0);
      out.push({ label: monthShort(d.getMonth()), value: v, hint: fcfa(v) });
    }
    return out;
  }, [state.recharges, meterId, months, today]);
}
