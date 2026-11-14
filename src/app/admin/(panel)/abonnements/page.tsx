"use client";

import { fcfa } from "@/lib/format";
import { monthlyPrice } from "@/lib/pricing";
import { SourceBadge, useAdmin } from "../useAdmin";
import { sampleUsers, type AdminRow as AdminUser } from "../data";

export default function Abonnements() {
  const { data, live } = useAdmin<AdminUser[]>("users");
  const users =
    live ? data ?? [] : live === false ? sampleUsers().map((u) => ({ ...u, monthly: u.status === "Actif" ? monthlyPrice(u.pack === "Woly Elec IA" ? "ia" : "simple", u.meters) : 0 })) : [];
  const paying = users.filter((u) => u.status === "Actif");
  const mrr = paying.reduce((t, u) => t + u.monthly, 0);
  return (
    <>
      <div className="row"><SourceBadge live={live} /></div>
      <div className="kpis">
        <div className="card kpi"><span className="lab">Revenu mensuel récurrent</span><span className="v">{fcfa(mrr)}</span><span className="xs mut">Équivalent mensuel des abonnés actifs</span></div>
        <div className="card kpi"><span className="lab">Abonnés payants</span><span className="v">{paying.length}</span></div>
        <div className="card kpi"><span className="lab">Essais en cours</span><span className="v">{users.filter((u) => u.status === "Essai").length}</span><span className="xs mut">Rappels J-7, J-3, J-1</span></div>
        <div className="card kpi"><span className="lab">Part Woly Elec IA</span><span className="v">{paying.length ? Math.round((paying.filter((u) => u.pack === "Woly Elec IA").length / paying.length) * 100) : 0} %</span></div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Tous les abonnements</b></div>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead><tr><th>Utilisateur</th><th>Offre</th><th className="n">Compteurs</th><th className="n">Prix mensuel</th><th>Statut</th><th>Échéance</th></tr></thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--mut)", padding: 28 }}>{live === null ? "Chargement…" : "Aucun abonnement."}</td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.pack}</td><td className="n">{u.meters}</td>
                  <td className="n">{u.monthly ? fcfa(u.monthly) : "—"}</td>
                  <td><span className={`badge ${u.status === "Actif" ? "b-ok" : u.status === "Essai" ? "b-trial" : "b-risk"}`}>{u.status}</span></td><td>{u.expires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="xs mut">Les paiements restent simulés tant qu&apos;aucun agrégateur (Wave, Orange Money, Free Money) n&apos;est branché.</p>
    </>
  );
}
