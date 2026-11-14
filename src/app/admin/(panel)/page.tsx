"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { BarChart, Seg } from "@/components/ui";
import { ALERT_LOG, USERS } from "./data";
import { SourceBadge, useAdmin } from "./useAdmin";

type R = "7" | "30" | "90";
type Overview = {
  totalClients: number;
  inscriptions: number;
  inscriptionsDelta: number | null;
  actifsSemaine: number;
  relevesParUtilisateur: number;
  conversion: number | null;
  essais: number;
  alertesUrgentes: number;
  retention: { days: number; value: number | null; eligible: number }[];
  sources: { source: string; n: number }[];
  recentSubs: { id: string; name: string; pack: string; status: string; expires: string }[];
  recentAlerts: { time: string; type: string; channel: string; status: string }[];
};

const SAMPLE: Overview = {
  totalClients: 1284,
  inscriptions: 312,
  inscriptionsDelta: 12,
  actifsSemaine: 642,
  relevesParUtilisateur: 3.4,
  conversion: 31,
  essais: 220,
  alertesUrgentes: 218,
  retention: [{ days: 30, value: 64, eligible: 1 }, { days: 60, value: 52, eligible: 1 }, { days: 90, value: 47, eligible: 1 }],
  sources: [{ source: "manuel", n: 3100 }, { source: "lien", n: 1900 }],
  recentSubs: USERS.slice(0, 5).map((u) => ({ id: u.id, name: u.name, pack: u.pack, status: u.status, expires: u.expires })),
  recentAlerts: ALERT_LOG.slice(0, 5).map((a) => ({ time: a.time, type: a.type, channel: a.channel, status: a.status })),
};
const SOURCE: Record<string, string> = { manuel: "Saisie", lien: "Lien d'alerte", ocr: "Photo (OCR)" };
const badge = (s: string) => (s === "Actif" || s === "Remis" ? "b-ok" : s === "Essai" ? "b-trial" : s === "En attente" ? "b-warn" : "b-risk");

export default function AdminHome() {
  const [r, setR] = useState<R>("30");
  const { data, live } = useAdmin<Overview>("overview", `&jours=${r}`);
  const o = live ? data : live === false ? SAMPLE : null;

  return (
    <>
      <div className="row wrapf" style={{ gap: 12 }}>
        <Seg<R> label="Période" style={{ width: 300 }} value={r} onChange={setR} options={[{ value: "7", label: "7 j" }, { value: "30", label: "30 j" }, { value: "90", label: "90 j" }]} />
        <SourceBadge live={live} />
        <span className="sp" />
        <button type="button" className="btn btn-line btn-sm" onClick={() => window.print()}><Icon name="print" size="s" /> Imprimer</button>
      </div>
      {!o ? (
        <div className="skel" style={{ height: 320 }} aria-busy="true" />
      ) : (
        <>
          <div className="kpis">
            <div className="card kpi"><span className="lab">Inscriptions · {r} j</span><span className="v">{o.inscriptions.toLocaleString("fr-FR")}</span><span className="xs mut">{o.inscriptionsDelta !== null ? `${o.inscriptionsDelta >= 0 ? "+" : ""}${o.inscriptionsDelta} % vs période précédente` : `${o.totalClients} comptes au total`}</span></div>
            <div className="card kpi"><span className="lab">Actifs · semaine</span><span className="v">{o.actifsSemaine.toLocaleString("fr-FR")}</span><span className="xs mut">Au moins un relevé en 7 jours</span></div>
            <div className="card kpi"><span className="lab">Relevés par actif</span><span className="v">{o.relevesParUtilisateur.toLocaleString("fr-FR")}</span><span className="xs mut">Sur les 7 derniers jours</span></div>
            <div className="card kpi"><span className="lab">Essai → abonnement</span><span className="v">{o.conversion !== null ? `${o.conversion} %` : "—"}</span><span className="xs mut">{o.essais} essai{o.essais > 1 ? "s" : ""} en cours</span></div>
            <div className="card kpi"><span className="lab">Alertes urgentes</span><span className="v">{o.alertesUrgentes.toLocaleString("fr-FR")}</span><span className="xs mut">1 jour ou moins, sur {r} j</span></div>
          </div>
          <div className="grid2">
            <div className="card col" style={{ gap: 12 }}>
              <b className="h3">Rétention</b>
              <div className="grid3f">
                {o.retention.map((x) => (
                  <div key={x.days} className="mc">
                    <span className="k">À {x.days} jours</span>
                    <span className="v">{x.value !== null ? `${x.value} %` : "—"}</span>
                    {x.value !== null ? <div className="tr" style={{ height: 8, background: "var(--g1)" }}><b style={{ width: `${x.value}%`, background: "var(--blue)" }} /></div> : <span className="xs mut">Pas encore de compte assez ancien</span>}
                  </div>
                ))}
              </div>
              <span className="xs mut">Part des comptes de plus de N jours ayant fait un relevé ces 14 derniers jours.</span>
            </div>
            <div className="card col" style={{ gap: 12 }}>
              <b className="h3">Origine des relevés</b>
              {o.sources.length ? <BarChart label="Relevés par origine" data={o.sources.map((s) => ({ label: SOURCE[s.source] ?? s.source, value: s.n, hint: `${s.n} relevés` }))} /> : <p className="sm mut">Aucun relevé pour le moment.</p>}
            </div>
          </div>
          <div className="grid2">
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Comptes récents</b></div>
              <div className="scr"><table className="tbl"><thead><tr><th>Utilisateur</th><th>Offre</th><th>Statut</th><th>Échéance</th></tr></thead><tbody>
                {o.recentSubs.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--mut)", padding: 24 }}>Aucun compte pour le moment.</td></tr>}
                {o.recentSubs.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.pack}</td><td><span className={`badge ${badge(u.status)}`}>{u.status}</span></td><td>{u.expires}</td></tr>)}
              </tbody></table></div>
            </div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Dernières alertes</b></div>
              <div className="scr"><table className="tbl"><thead><tr><th>Quand</th><th>Type</th><th>Canal</th><th>Statut</th></tr></thead><tbody>
                {o.recentAlerts.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--mut)", padding: 24 }}>Aucune alerte pour le moment.</td></tr>}
                {o.recentAlerts.map((a, i) => <tr key={i}><td>{a.time.includes("T") ? new Date(a.time).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : a.time}</td><td>{a.type}</td><td>{a.channel}</td><td><span className={`badge ${badge(a.status)}`}>{a.status}</span></td></tr>)}
              </tbody></table></div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
