"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart, Empty, LineChart, Seg, TierBadge } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useAppUI } from "@/components/app/AppShell";
import { useMeterStats, useStore } from "@/lib/store";
import { ddmmyyyy, fcfa, monthShort, num, token } from "@/lib/format";

type Range = "1" | "3" | "12";

export default function Historique() {
  const s = useMeterStats();
  const { today } = useStore();
  const { openRecharge } = useAppUI();
  const [range, setRange] = useState<Range>("3");
  const [tab, setTab] = useState<"recharges" | "releves">("recharges");

  const since = useMemo(() => new Date(today.getFullYear(), today.getMonth() - (Number(range) - 1), 1), [today, range]);
  const recharges = s.recharges.filter((r) => new Date(r.date) >= since);
  const readings = s.readings.filter((r) => new Date(r.date) >= since);
  const spent = recharges.reduce((t, r) => t + r.amount, 0);
  const bought = recharges.reduce((t, r) => t + r.kwh, 0);
  const consumed = readings.reduce((t, r) => t + r.yesterdayKwh, 0);

  const monthly = useMemo(() => {
    const n = Number(range) === 1 ? 3 : Number(range);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() - (n - 1 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const v = s.recharges.filter((r) => r.date.startsWith(key)).reduce((t, r) => t + r.amount, 0);
      return { label: monthShort(d.getMonth()), value: v, hint: fcfa(v) };
    });
  }, [s.recharges, range, today]);

  function exportCsv() {
    const rows = [["date", "montant_fcfa", "kwh_recus", "tranche", "revendeur", "codes"], ...s.recharges.map((r) => [r.date, r.amount, r.kwh, r.tier, r.vendor, r.tokens.join(" | ")])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `woly-elec-recharges-${s.meter.number.replace(/\s/g, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="row wrapf no-print" style={{ gap: 12 }}>
        <Seg<Range> label="Période" style={{ width: 360 }} value={range} onChange={setRange} options={[{ value: "1", label: "Ce mois" }, { value: "3", label: "3 mois" }, { value: "12", label: "12 mois" }]} />
        <span className="sp" />
        <button type="button" className="btn btn-line btn-sm" onClick={exportCsv}>
          <Icon name="download" size="s" /> Exporter en CSV
        </button>
        <button type="button" className="btn btn-line btn-sm" onClick={() => window.print()}>
          <Icon name="print" size="s" /> Imprimer
        </button>
        <Link className="btn btn-blue btn-sm" href="/app/bilan">
          <Icon name="doc" size="s" /> Voir le bilan mensuel
        </Link>
      </div>

      <div className="kpis">
        <div className="card kpi"><span className="lab">Dépenses · {range === "1" ? "ce mois" : `${range} mois`}</span><span className="v">{fcfa(spent)}</span></div>
        <div className="card kpi"><span className="lab">Recharges</span><span className="v">{recharges.length}</span><span className="xs mut">{num(bought, 0)} kWh achetés</span></div>
        <div className="card kpi"><span className="lab">kWh consommés</span><span className="v">{num(consumed, 0)}</span><span className="xs mut">D&apos;après {readings.length} relevés · estimé</span></div>
        <div className="card kpi"><span className="lab">Moyenne par jour</span><span className="v">{num(s.avg30)} <small style={{ fontSize: 16 }}>kWh</small></span></div>
      </div>

      <div className="grid2">
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Courbe de consommation</b>
          <LineChart values={readings.map((r) => r.yesterdayKwh)} label="Consommation quotidienne sur la période" />
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Dépenses par mois</b>
          <BarChart data={monthly} label="Dépenses de recharge par mois" />
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row wrapf" style={{ padding: "16px 20px", gap: 12 }}>
          <Seg label="Type de données" style={{ width: 320 }} value={tab} onChange={setTab} options={[{ value: "recharges", label: "Recharges" }, { value: "releves", label: "Relevés" }]} />
          <span className="sp" />
          <button type="button" className="btn btn-ghost btn-sm no-print" onClick={openRecharge}>
            <Icon name="plus" size="s" /> Ajouter une recharge
          </button>
        </div>
        <div className="scr">
          {tab === "recharges" ? (
            recharges.length === 0 ? (
              <Empty icon="receipt" title="Aucune recharge sur cette période" />
            ) : (
              <table className="tbl" style={{ minWidth: 760 }}>
                <thead>
                  <tr><th>Date</th><th>Montant</th><th className="n">kWh reçus</th><th>Tranche</th><th>Code de recharge</th><th>Revendeur</th></tr>
                </thead>
                <tbody>
                  {recharges.map((r) => (
                    <tr key={r.id}>
                      <td>{ddmmyyyy(r.date)}</td>
                      <td>{fcfa(r.amount)}</td>
                      <td className="n">{num(r.kwh, 0)}</td>
                      <td><TierBadge tier={r.tier} /></td>
                      <td style={{ fontVariantNumeric: "tabular-nums", fontSize: 14 }}>{r.tokens[0] ? token(r.tokens[0]) : "—"}{r.tokens.length > 1 && <span className="xs mut"> +{r.tokens.length - 1}</span>}</td>
                      <td>{r.vendor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead>
                <tr><th>Date</th><th className="n">Solde · 801</th><th className="n">Veille · 813</th><th className="n">Mois · 814</th><th>Source</th></tr>
              </thead>
              <tbody>
                {[...readings].reverse().map((r) => (
                  <tr key={r.id}>
                    <td>{ddmmyyyy(r.date)}</td>
                    <td className="n">{num(r.balanceKwh)} kWh</td>
                    <td className="n">{num(r.yesterdayKwh)} kWh</td>
                    <td className="n">{num(r.monthKwh, 0)} kWh</td>
                    <td><span className="tag">{r.source === "lien" ? "Lien d'alerte" : r.source === "ocr" ? "Photo (OCR)" : "Saisie"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
