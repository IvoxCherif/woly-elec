"use client";

import Link from "next/link";
import { useState } from "react";
import { BarChart, Callout, Confidence, Empty, Frise, LineChart, Seg, TierBadge, TrancheBar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CreditGauge, depletionLabel, useMonthlySpend } from "@/components/app/shared";
import { useAppUI } from "@/components/app/AppShell";
import { useMeterStats, useStore } from "@/lib/store";
import { ddmm, fcfa, kwh, num } from "@/lib/format";
import { IA_QUOTA_PER_METER } from "@/lib/pricing";

export default function Dashboard() {
  const s = useMeterStats();
  const { state } = useStore();
  const quota = state.iaQuota ?? IA_QUOTA_PER_METER;
  const { openReleve, openRecharge } = useAppUI();
  const [range, setRange] = useState<"7" | "14" | "30">("14");
  const spend = useMonthlySpend(s.meter.id);

  if (!s.last)
    return (
      <div className="card">
        <Empty title="Aucun relevé pour ce compteur" action={<button className="btn btn-blue" onClick={openReleve}>Ajouter mon premier relevé</button>}>
          Saisissez les codes 801, 813 et 814 de votre compteur pour voir votre autonomie et votre montant exact.
        </Empty>
      </div>
    );

  const p = s.plan;
  const series = s.readings.slice(-Number(range)).map((r) => r.yesterdayKwh);
  const depDay = p.depletionDate && p.depletionDate.getMonth() === new Date().getMonth() && !p.coversMonth ? p.depletionDate.getDate() : null;
  const bestDay = s.best.date.getMonth() === new Date().getMonth() ? s.best.date.getDate() : null;
  const iaUsed = state.iaUsed[s.meter.id] ?? 0;
  const lastIa = [...state.chat].reverse().find((m) => m.role === "a");

  return (
    <>
      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))" }}>
        <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", padding: 24 }}>
          <div className="col" style={{ alignItems: "center", gap: 6, flex: "none", margin: "0 auto" }}>
            <CreditGauge s={s} />
            <span className="xs mut">{depletionLabel(s)}</span>
          </div>
          <div className="col" style={{ flex: "1 1 220px", gap: 12 }}>
            <div className="mc">
              <span className="k">Consommation prévue (mois)</span>
              <span className="v">
                {num(s.avg7 * s.daysInMonth, 0)} <small>kWh</small>
              </span>
            </div>
            <div className="mc">
              <span className="k">Montant à recharger pour finir le mois</span>
              <span className="v">
                {p.minAmount > 0 ? <>{num(p.minAmount, 0)} <small>F</small></> : <>0 <small>F</small></>}
              </span>
              <span className="xs mut">{p.minAmount > 0 ? `Minimum · recommandé ${fcfa(p.recommendedAmount)}` : "Votre crédit couvre le mois"}</span>
            </div>
            <Link className={`btn ${p.level === "risk" ? "btn-red" : "btn-blue"} btn-blk`} href="/app/plan">
              Recharger maintenant
            </Link>
            <button type="button" className="btn btn-line btn-blk btn-sm" onClick={openRecharge}>
              J&apos;ai rechargé : enregistrer
            </button>
          </div>
        </div>
        <div className="col" style={{ gap: 20 }}>
          <div className="card col" style={{ gap: 10 }}>
            <div className="row wrapf">
              <b className="h3">Tranche actuelle</b>
              <span className="sp" />
              <span className={`badge ${s.tier === 1 ? "b-ok" : "b-warn"}`}>
                Tranche {s.tier} · {s.tier === 1 ? "82" : "136,49"} F/kWh
              </span>
            </div>
            <TrancheBar bought={s.boughtMonthKwh} />
            <p className="sm">
              {kwh(s.boughtMonthKwh, 0)} achetés ce mois-ci
              {s.tier === 1 ? (
                <>
                  {" "}: il vous reste <b className="ink">{kwh(s.leftInTier, 0)}</b> en tranche 1 avant de passer en tranche 2.
                </>
              ) : (
                <> : vos prochains kWh sont en tranche {s.tier}. </>
              )}{" "}
              Remise à zéro le 1er du mois.
            </p>
          </div>
          <div className="card col" style={{ gap: 10 }}>
            <div className="row wrapf">
              <b className="h3">Plan du mois</b>
              <span className="sp" />
              <span className="badge b-gr">Meilleur jour : {s.best.title.toLowerCase().replace("le 1er du mois prochain", "le 1er")}</span>
            </div>
            <Frise daysInMonth={s.daysInMonth} today={new Date().getDate()} depletionDay={depDay} rechargeDay={s.best.kind === "inutile" ? null : bestDay} />
            <div className="fl">
              <span>1</span>
              <span>{new Date().getDate()} · aujourd&apos;hui</span>
              <span>{depDay ? `${depDay} · coupure estimée` : `${s.daysInMonth} · fin du mois`}</span>
            </div>
            <Confidence bars={s.reliability.bars} label={s.reliability.label} count={s.readings.length} />
          </div>
        </div>
      </div>

      {p.level === "risk" ? (
        <Callout tone="red" title={`Urgence : environ ${p.autonomy < 1 ? "moins d'un jour" : "1 jour"} d'électricité`}>
          D&apos;après vos 3 derniers relevés, votre crédit devrait s&apos;épuiser très vite. Rechargez au moins {fcfa(p.minAmount)} maintenant.
        </Callout>
      ) : p.level === "warn" ? (
        <Callout tone="warn" title={`Il vous reste environ ${Math.floor(p.autonomy)} jours`}>
          Mettez à jour votre solde pour recevoir le montant exact. {s.best.reason}
        </Callout>
      ) : (
        <Callout tone={p.coversMonth ? "ok" : "warn"} title={p.coversMonth ? "Votre crédit couvre la fin du mois" : `Pensez à votre recharge ${s.best.title.toLowerCase()}`}>
          {s.best.reason}
        </Callout>
      )}

      <div className="grid2">
        <div className="card col" style={{ gap: 12 }}>
          <div className="row wrapf">
            <b className="h3">Consommation · {range} derniers jours</b>
            <span className="sp" />
            <Seg label="Période" style={{ width: 240 }} value={range} onChange={setRange} options={[{ value: "7", label: "7 j" }, { value: "14", label: "14 j" }, { value: "30", label: "Mois" }]} />
          </div>
          <LineChart values={series} label={`Courbe de consommation sur ${series.length} jours`} />
          <span className="sm">
            Moyenne estimée : <b className="ink">{num(s.avg7)} kWh par jour</b> · 3 jours : {num(s.avg3)} kWh
          </span>
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <div className="row">
            <b className="h3">Dépenses mensuelles</b>
            <span className="sp" />
            <span className="sm mut">6 derniers mois</span>
          </div>
          <BarChart data={spend} label="Dépenses de recharge des 6 derniers mois" />
        </div>
      </div>

      <div className="grid2">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row" style={{ padding: "18px 20px" }}>
            <b className="h3">Dernières recharges</b>
            <span className="sp" />
            <Link className="sm" href="/app/historique">
              Tout voir
            </Link>
          </div>
          <div className="scr">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th className="n">kWh</th>
                  <th>Tranche</th>
                </tr>
              </thead>
              <tbody>
                {s.recharges.slice(0, 4).map((r) => (
                  <tr key={r.id}>
                    <td>{ddmm(r.date)}</td>
                    <td>{fcfa(r.amount)}</td>
                    <td className="n">{num(r.kwh, 0)}</td>
                    <td>
                      <TierBadge tier={r.tier} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <div className="row">
            <span className="badge b-ia">
              <Icon name="sparkle" size="s" /> Woly Elec IA
            </span>
            <span className="sp" />
            <span className="badge b-gr">
              {iaUsed}/{quota} requêtes
            </span>
          </div>
          <div className="chat">
            <div className="bub u">{lastIa ? [...state.chat].reverse().find((m) => m.role === "u")?.text : "Explique-moi mon mois"}</div>
            <div className="bub a">
              {lastIa ? (
                lastIa.text
              ) : (
                <>
                  Vous avez acheté <b>{kwh(s.boughtMonthKwh, 0)}</b> en {s.monthRecharges.length} recharge{s.monthRecharges.length > 1 ? "s" : ""}. Vous consommez environ <b>{num(s.avg7)} kWh par jour</b>
                  {s.tier === 1 ? " et restez en tranche 1." : " et vos prochains kWh seront en tranche 2."}
                </>
              )}
            </div>
          </div>
          <Link href="/app/assistant" className="btn btn-lineb btn-sm" style={{ alignSelf: "flex-start" }}>
            Poser une question
          </Link>
        </div>
      </div>
    </>
  );
}
