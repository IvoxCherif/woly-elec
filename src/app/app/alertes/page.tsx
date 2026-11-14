"use client";

import { useEffect } from "react";
import { Callout, Empty, Switch } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useMeterStats, useStore } from "@/lib/store";
import { ago, days } from "@/lib/format";
import { alertThreshold } from "@/lib/engine";

const CHANNEL = { push: "Push", whatsapp: "WhatsApp", sms: "SMS", email: "E-mail" } as const;

export default function Alertes() {
  const { state, today, updateUser, markAlertsRead, dismissAlert, notify } = useStore();
  const s = useMeterStats();
  const ch = state.user.channels;
  const ia = state.subscription.pack === "ia";
  const threshold = alertThreshold(s.plan.autonomy);

  useEffect(() => {
    const t = setTimeout(markAlertsRead, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = [...state.alerts].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <div className="col" style={{ gap: 12 }}>
        {threshold !== null && (
          <Callout tone={threshold <= 1 ? "red" : "warn"} title={threshold === 0 ? "Moins d'un jour d'électricité" : `Seuil d'alerte ${threshold} jour${threshold > 1 ? "s" : ""} atteint`}>
            Autonomie estimée : {days(s.plan.autonomy)} sur {s.meter.name}. Une alerte est envoyée par {[ch.whatsapp && "WhatsApp", ch.push && "push", ch.sms && threshold <= 1 && "SMS"].filter(Boolean).join(", ") || "aucun canal actif"}.
          </Callout>
        )}
        {list.length === 0 && <div className="card"><Empty icon="bell" title="Aucune alerte">Tout va bien : vous serez prévenu à 5, 3 et 1 jour d&apos;autonomie.</Empty></div>}
        {list.map((a) => {
          const meter = state.meters.find((m) => m.id === a.meterId);
          return (
            <div key={a.id} className="row" style={{ alignItems: "stretch", gap: 8 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <Callout tone={a.tone} icon={a.icon} title={a.title}>
                  {a.body}{" "}
                  <span className="xs">
                    · {ago(a.date, today)} · {CHANNEL[a.channel]}
                    {state.meters.length > 1 && meter ? ` · ${meter.name}` : ""}
                    {!a.read && <b style={{ display: "inline", marginLeft: 6, font: "700 12px Inter" }}>· nouveau</b>}
                  </span>
                </Callout>
              </div>
              <button type="button" className="avatar" style={{ background: "#fff", border: "1px solid var(--ln)", alignSelf: "center" }} onClick={() => dismissAlert(a.id)} aria-label={`Supprimer l'alerte ${a.title}`}>
                <Icon name="x" size="s" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="col" style={{ gap: 20 }}>
        <div className="card col" style={{ gap: 0 }}>
          <span className="lab" style={{ marginBottom: 6 }}>Canaux</span>
          {(
            [
              ["push", "Notifications push", "Alertes et rappels"],
              ["whatsapp", "WhatsApp", "Alertes 5, 3 et 1 jour, avec lien de mise à jour"],
              ["sms", "SMS", "Urgences uniquement (1 jour ou moins)"],
              ["email", "E-mail", "Résumé mensuel"],
            ] as const
          ).map(([k, label, hint], i) => (
            <div key={k} className="row" style={{ padding: "12px 0", borderBottom: i < 3 ? "1px solid var(--ln)" : 0 }}>
              <div style={{ flex: 1 }}>
                <b className="ink sm">{label}</b>
                <div className="xs mut">{hint}</div>
              </div>
              <button type="button" role="switch" className="sw" aria-checked={ch[k]} aria-label={label} onClick={() => updateUser({ channels: { ...ch, [k]: !ch[k] } })} />
            </div>
          ))}
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <span className="lab">Relances de mise à jour</span>
          <p className="sm">Si vous ne mettez pas à jour votre compteur après le message hebdomadaire, Woly Elec vous relance, avec 2 heures entre chaque message.</p>
          <div className="row" style={{ gap: 14 }}>
            <button type="button" className="avatar" style={{ background: "#fff", border: "1.5px solid #C9D6CF" }} disabled={!ia || state.user.relances <= 0} onClick={() => updateUser({ relances: state.user.relances - 1 })} aria-label="Moins de relances"><Icon name="minus" /></button>
            <span className="big" style={{ fontSize: 32 }}>{state.user.relances}</span>
            <button type="button" className="avatar" style={{ background: "#fff", border: "1.5px solid #C9D6CF" }} disabled={!ia || state.user.relances >= 6} onClick={() => updateUser({ relances: state.user.relances + 1 })} aria-label="Plus de relances"><Icon name="plus" /></button>
            <span className="sm">relance{state.user.relances > 1 ? "s" : ""}</span>
          </div>
          <span className="xs mut">{ia ? "Réglable avec Woly Elec IA (0 à 6)." : "Nombre fixe (2) avec Woly Elec 1. Réglable avec Woly Elec IA."}</span>
        </div>
        <div className="card col" style={{ gap: 10 }}>
          <span className="lab">Seuils d&apos;alerte</span>
          <div className="chan">
            <span className="badge b-warn">5 jours</span>
            <span className="badge b-warn">3 jours</span>
            <span className="badge b-risk">1 jour</span>
            <span className="badge b-risk">moins d&apos;un jour</span>
          </div>
          <span className="xs mut">Calculés sur votre moyenne des 3 derniers jours. Chaque message contient un lien personnel et expirable vers la mise à jour de votre compteur.</span>
          <Switch checked={state.user.consent} onChange={(v) => { updateUser({ consent: v }); notify(v ? "Alertes activées" : "Alertes suspendues"); }} label="Recevoir les alertes de coupure" />
        </div>
      </div>
    </div>
  );
}
