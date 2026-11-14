"use client";

import { useState } from "react";
import { Seg } from "@/components/ui";
import { ALERT_LOG } from "../data";
import { SourceBadge, useAdmin } from "../useAdmin";

type F = "tous" | "WhatsApp" | "SMS" | "Push" | "E-mail";
type Row = { time: string; user: string; type: string; channel: string; status: string };

export default function JournalAlertes() {
  const [f, setF] = useState<F>("tous");
  const { data, live } = useAdmin<Row[]>("alerts");
  const all: Row[] = live ? data ?? [] : live === false ? ALERT_LOG : [];
  const list = all.filter((a) => f === "tous" || a.channel === f);
  const day = all.filter((a) => !a.time.includes("T") || Date.now() - new Date(a.time).getTime() < 86400000);
  const remis = all.filter((a) => a.status === "Remis").length;
  return (
    <>
      <div className="row"><SourceBadge live={live} /></div>
      <div className="kpis">
        <div className="card kpi"><span className="lab">Alertes · 24 h</span><span className="v">{day.length}</span></div>
        <div className="card kpi"><span className="lab">Taux de remise</span><span className="v">{all.length ? Math.round((remis / all.length) * 100) : 0} %</span></div>
        <div className="card kpi"><span className="lab">En attente d&apos;envoi</span><span className="v" style={{ color: "#8A6A00" }}>{all.filter((a) => a.status === "En attente").length}</span><span className="xs mut">WhatsApp et SMS non branchés</span></div>
        <div className="card kpi"><span className="lab">Échecs</span><span className="v cr">{all.filter((a) => a.status === "Échec").length}</span></div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row wrapf" style={{ padding: "16px 20px", gap: 12 }}>
          <b className="h3">Journal</b><span className="sp" />
          <Seg<F> label="Canal" style={{ width: 460, maxWidth: "100%" }} value={f} onChange={setF} options={(["tous", "WhatsApp", "SMS", "Push", "E-mail"] as F[]).map((v) => ({ value: v, label: v === "tous" ? "Tous" : v }))} />
        </div>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr><th>Quand</th><th>Utilisateur</th><th>Alerte</th><th>Canal</th><th>Statut</th></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--mut)", padding: 28 }}>{live === null ? "Chargement…" : "Aucune alerte."}</td></tr>}
              {list.map((a, i) => (
                <tr key={i}>
                  <td>{a.time.includes("T") ? new Date(a.time).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : a.time}</td>
                  <td>{a.user}</td><td>{a.type}</td><td>{a.channel}</td>
                  <td><span className={`badge ${a.status === "Remis" ? "b-ok" : a.status === "En attente" ? "b-warn" : "b-risk"}`}>{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
