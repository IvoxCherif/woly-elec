"use client";

import { Callout, Confidence, Frise, Seg } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useAppUI } from "@/components/app/AppShell";
import { useMeterStats, useStore } from "@/lib/store";
import { days, fcfa, kwh, monthName, num } from "@/lib/format";
import type { Objective } from "@/lib/demo";

const DAYS = [1, 5, 10, 15, 20, 25];
const VENDORS = [
  { name: "Wave", href: "https://www.wave.com/fr/" },
  { name: "Orange Money", href: "https://www.orange.sn/" },
  { name: "Free Money", href: "https://www.free.sn/" },
];

export default function Plan() {
  const s = useMeterStats();
  const { state, today, updateUser, notify } = useStore();
  const { openRecharge } = useAppUI();
  const p = s.plan;
  const depDay = p.depletionDate && p.depletionDate.getMonth() === today.getMonth() && !p.coversMonth ? p.depletionDate.getDate() : null;
  const bestDay = !p.coversMonth && s.best.date.getMonth() === today.getMonth() ? s.best.date.getDate() : null;

  return (
    <>
      <div className="grid2" style={{ alignItems: "start" }}>
        <div className="card col" style={{ gap: 14, padding: 24 }}>
          <span className="lab">Pour tenir jusqu&apos;à la fin de {monthName(today)}</span>
          {p.needKwh > 0 ? (
            <>
              <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div className="col" style={{ gap: 2 }}>
                  <span className="xs mut">Minimum</span>
                  <span className="big" style={{ fontSize: 40 }}>{fcfa(p.minAmount)}</span>
                </div>
                <div className="col" style={{ gap: 2 }}>
                  <span className="xs mut">Recommandé</span>
                  <span className="big" style={{ fontSize: 40, color: "var(--blue)" }}>{fcfa(p.recommendedAmount)}</span>
                </div>
              </div>
              <span className="sm">
                Il reste {p.daysLeft} jours. À {num(s.avg7)} kWh par jour, il vous faut {kwh(p.daysLeft * s.avg7, 0)} ; vous en avez {kwh(s.last?.balanceKwh ?? 0, 0)}. Il manque{" "}
                <b className="ink">{kwh(p.needKwh)}</b>.
              </span>
              <span className="xs mut">Frais inclus (estimation) · marge de sécurité de {Math.round(p.margin * 100)} % sur le montant recommandé</span>
            </>
          ) : (
            <>
              <span className="big" style={{ fontSize: 40, color: "var(--ok)" }}>0 F</span>
              <span className="sm">
                Votre solde ({kwh(s.last?.balanceKwh ?? 0, 0)}) couvre les {p.daysLeft} jours restants à {num(s.avg7)} kWh par jour. Rechargez le 1er pour repartir en tranche 1.
              </span>
            </>
          )}
          <Confidence bars={s.reliability.bars} label={s.reliability.label} count={s.readings.length} />
          <div className="row wrapf" style={{ gap: 10 }}>
            {VENDORS.map((v) => (
              <a key={v.name} className="btn btn-line btn-sm" href={v.href} target="_blank" rel="noreferrer">
                Acheter via {v.name}
              </a>
            ))}
          </div>
          <button type="button" className="btn btn-blue" onClick={openRecharge}>
            J&apos;ai rechargé : enregistrer ma recharge
          </button>
          <span className="xs mut">Woly Elec ne vend pas d&apos;électricité : achetez votre crédit Woyofal chez votre revendeur habituel, puis enregistrez-le ici.</span>
        </div>

        <div className="col" style={{ gap: 20 }}>
          <div className="card col" style={{ gap: 8, background: "var(--g9)", borderColor: "var(--g9)" }}>
            <div className="row" style={{ color: "var(--yel)" }}>
              <Icon name="bolt" size="s" />
              <b className="mont" style={{ fontSize: 14 }}>Meilleur jour pour recharger</b>
            </div>
            <div className="row wrapf" style={{ alignItems: "baseline", gap: 10 }}>
              <span className="big" style={{ fontSize: 36, color: "#fff" }}>{s.best.title}</span>
              <span className="sm" style={{ color: "#cfe3d8" }}>Prochaine recharge conseillée</span>
            </div>
            <p className="sm" style={{ color: "#cfe3d8" }}>{s.best.reason}</p>
          </div>

          <div className="card col" style={{ gap: 8 }}>
            <div className="row">
              <span className="lab">{monthName(today)}</span>
              <span className="sp" />
              <span className="sm mut">Autonomie ≈ {days(p.autonomy)}</span>
            </div>
            <Frise daysInMonth={s.daysInMonth} today={today.getDate()} depletionDay={depDay} rechargeDay={bestDay} />
            <div className="fl">
              <span>1</span>
              <span>{today.getDate()} · aujourd&apos;hui</span>
              <span>{depDay ? `${depDay} · coupure estimée` : `${s.daysInMonth} · fin du mois`}</span>
            </div>
            <div className="row wrapf xs mut" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: "var(--g6)" }} /> passé</span>
              <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: "var(--blue)" }} /> aujourd&apos;hui</span>
              <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: "var(--yel)" }} /> recharge conseillée</span>
              <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 3, background: "var(--red)" }} /> risque de coupure</span>
            </div>
          </div>

          <div className="card col" style={{ gap: 12 }}>
            <span className="lab">Jour de recharge préféré</span>
            <div className="chips" role="group" aria-label="Jour de recharge préféré">
              {DAYS.map((d) => (
                <button key={d} type="button" className="chip" aria-pressed={state.user.rechargeDay === d} onClick={() => { updateUser({ rechargeDay: d }); notify(`Rappel programmé le ${d === 1 ? "1er" : d} de chaque mois`); }}>
                  {d === 1 ? "1er" : d}
                </button>
              ))}
            </div>
            <span className="xs mut">Vous recevrez un rappel 3 jours avant, avec le montant optimal.</span>
            <span className="lab" style={{ marginTop: 6 }}>Objectif du mois</span>
            <Seg<Objective>
              label="Objectif du mois"
              value={state.user.objective}
              onChange={(v) => updateUser({ objective: v })}
              options={[
                { value: "mois", label: "Tenir tout le mois" },
                { value: "coupure", label: "Éviter la coupure" },
                { value: "economiser", label: "Économiser" },
              ]}
            />
          </div>
        </div>
      </div>
      {s.tier >= 2 && (
        <Callout tone="warn" title="Vous êtes en tranche 2">
          Vous avez acheté {kwh(s.boughtMonthKwh, 0)} ce mois-ci. Chaque kWh coûte maintenant 136,49 F au lieu de 82 F : rechargez seulement le nécessaire jusqu&apos;au 1er.
        </Callout>
      )}
    </>
  );
}
