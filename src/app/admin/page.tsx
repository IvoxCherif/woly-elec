"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { BarChart, Seg } from "@/components/ui";
import { ALERT_LOG, USERS } from "./data";

type R = "7" | "30" | "90";
const K: Record<R, [string, string, string, string, string, string]> = {
  "7": ["312", "+4 %", "598", "3,1", "29 %", "61"],
  "30": ["1 284", "+12 %", "642", "3,4", "31 %", "218"],
  "90": ["3 470", "+38 %", "655", "3,3", "30 %", "590"],
};

export default function AdminHome() {
  const [r, setR] = useState<R>("30");
  const k = K[r];
  return (
    <>
      <div className="row wrapf" style={{ gap: 12 }}>
        <Seg<R> label="Période" style={{ width: 300 }} value={r} onChange={setR} options={[{ value: "7", label: "7 j" }, { value: "30", label: "30 j" }, { value: "90", label: "90 j" }]} />
        <span className="sp" />
        <button type="button" className="btn btn-line btn-sm" onClick={() => window.print()}><Icon name="download" size="s" /> Exporter</button>
      </div>
      <div className="kpis">
        <div className="card kpi"><span className="lab">Inscriptions</span><span className="v">{k[0]}</span><span className="xs cok" style={{ fontWeight: 700 }}>{k[1]} sur {r} j</span></div>
        <div className="card kpi"><span className="lab">Actifs · semaine</span><span className="v">{k[2]}</span><span className="xs mut">Au moins un relevé</span></div>
        <div className="card kpi"><span className="lab">Relevés par utilisateur</span><span className="v">{k[3]}</span><span className="xs mut">Par semaine</span></div>
        <div className="card kpi"><span className="lab">Essai → abonnement</span><span className="v">{k[4]}</span><span className="xs mut">Sur les essais terminés</span></div>
        <div className="card kpi"><span className="lab">Coupures évitées</span><span className="v">{k[5]}</span><span className="xs mut">Estimation</span></div>
      </div>
      <div className="grid2">
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Rétention</b>
          <div className="grid3f">
            {[["À 30 jours", 64], ["À 60 jours", 52], ["À 90 jours", 47]].map(([l, v]) => (
              <div key={l} className="mc"><span className="k">{l}</span><span className="v">{v} %</span><div className="tr" style={{ height: 8, background: "var(--g1)" }}><b style={{ width: `${v}%`, background: "var(--blue)" }} /></div></div>
            ))}
          </div>
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <div className="row"><b className="h3">Fiabilité des prévisions</b><span className="sp" /><span className="badge b-ok">Écart moyen : 0,9 jour</span></div>
          <BarChart label="Précision des prévisions selon le nombre de relevés" data={[["1 relevé", 30], ["3", 48], ["6", 64], ["10", 72], ["14", 80], ["20+", 86]].map(([l, v]) => ({ label: String(l), value: Number(v), hint: `${v} % de prévisions à moins d'un jour près` }))} />
        </div>
      </div>
      <div className="grid2">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Abonnements récents</b></div>
          <div className="scr"><table className="tbl"><thead><tr><th>Utilisateur</th><th>Offre</th><th>Statut</th><th>Expire</th></tr></thead><tbody>
            {USERS.slice(0, 5).map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.pack}</td><td><span className={`badge ${u.status === "Actif" ? "b-ok" : u.status === "Essai" ? "b-trial" : "b-risk"}`}>{u.status}</span></td><td>{u.expires}</td></tr>)}
          </tbody></table></div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Journal des alertes envoyées</b></div>
          <div className="scr"><table className="tbl"><thead><tr><th>Heure</th><th>Type</th><th>Canal</th><th>Statut</th></tr></thead><tbody>
            {ALERT_LOG.slice(0, 5).map((a, i) => <tr key={i}><td>{a.time}</td><td>{a.type}</td><td>{a.channel}</td><td><span className={`badge ${a.status === "Remis" ? "b-ok" : a.status === "En attente" ? "b-warn" : "b-risk"}`}>{a.status}</span></td></tr>)}
          </tbody></table></div>
        </div>
      </div>
    </>
  );
}
