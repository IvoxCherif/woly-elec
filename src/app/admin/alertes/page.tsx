"use client";

import { useState } from "react";
import { Seg } from "@/components/ui";
import { ALERT_LOG } from "../data";

type F = "tous" | "WhatsApp" | "SMS" | "Push" | "E-mail";

export default function JournalAlertes() {
  const [f, setF] = useState<F>("tous");
  const list = ALERT_LOG.filter((a) => f === "tous" || a.channel === f);
  const fails = ALERT_LOG.filter((a) => a.status === "Échec").length;
  return (
    <>
      <div className="kpis">
        <div className="card kpi"><span className="lab">Envoyées · 24 h</span><span className="v">{ALERT_LOG.length}</span></div>
        <div className="card kpi"><span className="lab">Taux de remise</span><span className="v">{Math.round((ALERT_LOG.filter((a) => a.status === "Remis").length / ALERT_LOG.length) * 100)} %</span></div>
        <div className="card kpi"><span className="lab">Échecs</span><span className="v cr">{fails}</span><span className="xs mut">Relancés automatiquement sur un autre canal</span></div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row wrapf" style={{ padding: "16px 20px", gap: 12 }}>
          <b className="h3">Journal</b><span className="sp" />
          <Seg<F> label="Canal" style={{ width: 460, maxWidth: "100%" }} value={f} onChange={setF} options={(["tous", "WhatsApp", "SMS", "Push", "E-mail"] as F[]).map((v) => ({ value: v, label: v === "tous" ? "Tous" : v }))} />
        </div>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr><th>Heure</th><th>Utilisateur</th><th>Type</th><th>Canal</th><th>Statut</th></tr></thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={i}><td>{a.time}</td><td>{a.user}</td><td>{a.type}</td><td>{a.channel}</td><td><span className={`badge ${a.status === "Remis" ? "b-ok" : a.status === "En attente" ? "b-warn" : "b-risk"}`}>{a.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
