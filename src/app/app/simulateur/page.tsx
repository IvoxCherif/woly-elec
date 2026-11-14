"use client";

import Link from "next/link";
import { useState } from "react";
import { Callout, NumField, TierBadge } from "@/components/ui";
import { useMeterStats } from "@/lib/store";
import { simulate } from "@/lib/engine";
import { days, fcfa, kwh, num, parseNum } from "@/lib/format";

const PRESETS = [2000, 5000, 10000, 15000, 20000];

export default function Simulateur() {
  const s = useMeterStats();
  const [amount, setAmount] = useState("10 000");
  const a = parseNum(amount);
  const avg = s.avg7 || 5;
  const bal = s.last?.balanceKwh ?? 0;
  const today = a > 0 ? simulate(a, { boughtMonthKwh: s.boughtMonthKwh, firstRechargeOfMonth: s.firstRechargeOfMonth, phase: s.meter.phase, debt: s.meter.debt, balanceKwh: bal, avgDaily: avg }) : null;
  const first = a > 0 ? simulate(a, { boughtMonthKwh: 0, firstRechargeOfMonth: true, phase: s.meter.phase, debt: s.meter.debt, balanceKwh: bal, avgDaily: avg }) : null;
  const gain = today && first ? first.kwh - today.kwh : 0;

  return (
    <>
      <p className="lead" style={{ maxWidth: 760 }}>
        Testez un montant avant de recharger. Le simulateur applique la grille en vigueur, la taxe communale de 2,5 %
        {s.firstRechargeOfMonth ? " et la redevance mensuelle (1re recharge du mois)" : ""}. Chiffres estimés.
      </p>
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card col" style={{ gap: 16 }}>
          <NumField label="Montant à recharger" unit="F" value={amount} onChange={setAmount} autoFocus />
          <div className="chips" role="group" aria-label="Montants courants">
            {PRESETS.map((p) => (
              <button key={p} type="button" className="chip" aria-pressed={a === p} onClick={() => setAmount(num(p, 0))}>
                {fcfa(p)}
              </button>
            ))}
          </div>
          {today ? (
            <div className="col" style={{ gap: 0 }}>
              <Row label="kWh estimés"><b className="mont ink" style={{ fontSize: 22 }}>≈ {kwh(today.kwh)}</b></Row>
              <Row label="Tranche utilisée">{today.parts.length > 0 ? today.parts.map((p) => <TierBadge key={p.tier} tier={p.tier} />) : "—"}</Row>
              <Row label="Autonomie obtenue"><b className="mont ink" style={{ fontSize: 22 }}>≈ {days(today.autonomyGained)}</b></Row>
              <Row label="Autonomie totale avec votre solde"><b className="mont ink" style={{ fontSize: 22 }}>≈ {days(today.autonomyTotal)}</b></Row>
              <Row label="Coût moyen du kWh" last><b className="mont ink" style={{ fontSize: 22 }}>≈ {fcfa(today.avgCost)}</b></Row>
            </div>
          ) : (
            <p className="sm mut">Saisissez un montant pour voir l&apos;estimation.</p>
          )}
        </div>

        <div className="col" style={{ gap: 20 }}>
          {today && first && (
            <div className="card col" style={{ gap: 14 }}>
              <span className="lab">Aujourd&apos;hui ou le 1er du mois ?</span>
              <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="mc" style={{ border: `2px solid ${s.tier > 1 ? "var(--yel2)" : "var(--ok)"}` }}>
                  <span className="k">Aujourd&apos;hui</span>
                  <span className="v">{num(today.kwh, 0)} <small>kWh</small></span>
                  <span className="xs mut">{today.tierLabel}</span>
                </div>
                <div className="mc" style={{ border: "2px solid var(--ok)" }}>
                  <span className="k">Le 1er du mois</span>
                  <span className="v">{num(first.kwh, 0)} <small>kWh</small></span>
                  <span className="xs cok" style={{ fontWeight: 700 }}>
                    {gain > 0.5 ? `+${num(gain, 0)} kWh · ${first.tierLabel.toLowerCase()}` : first.tierLabel}
                  </span>
                </div>
              </div>
              <p className="sm">
                {gain > 0.5
                  ? s.plan.coversMonth
                    ? `Votre crédit couvre le mois : en attendant le 1er, vous gagnez environ ${num(gain, 0)} kWh pour le même montant.`
                    : `Attendre le 1er donnerait ${num(gain, 0)} kWh de plus, mais votre crédit ne tient pas jusque-là : rechargez seulement le minimum maintenant.`
                  : "Aujourd'hui, ce montant reste en tranche 1 : pas de différence à attendre le 1er, hormis la redevance mensuelle."}
              </p>
            </div>
          )}
          {today && (
            <div className="card col" style={{ gap: 10 }}>
              <span className="lab">Détail du calcul</span>
              <Row label="Montant payé">{fcfa(a)}</Row>
              <Row label="Taxe communale (2,5 %)">− {fcfa(today.tax)}</Row>
              {today.redevance > 0 && <Row label="Redevance du compteur (1 fois par mois)">− {fcfa(today.redevance)}</Row>}
              {today.debt > 0 && <Row label="Retenue de dette Senelec">− {fcfa(today.debt)}</Row>}
              <Row label="Montant converti en kWh"><b className="ink">{fcfa(today.net)}</b></Row>
              {today.parts.map((p) => (
                <Row key={p.tier} label={`Tranche ${p.tier} · ${num(p.price, 2)} F/kWh`} last={p === today.parts.at(-1)}>
                  {kwh(p.kwh)}
                </Row>
              ))}
            </div>
          )}
          <Callout tone="info" title="Pourquoi les kWh varient">
            Au-delà de 150 kWh achetés dans le mois, le kWh passe de 82 F à 136,49 F. Le compteur de tranche repart à zéro le 1er.
          </Callout>
          <Link className="btn btn-blue" href="/app/plan" style={{ alignSelf: "flex-start" }}>
            Voir mon plan du mois
          </Link>
        </div>
      </div>
    </>
  );
}

function Row({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className="row wrapf" style={{ padding: "11px 0", borderBottom: last ? 0 : "1px solid var(--ln)" }}>
      <span className="sm">{label}</span>
      <span className="sp" />
      <span className="row" style={{ gap: 6 }}>{children}</span>
    </div>
  );
}
