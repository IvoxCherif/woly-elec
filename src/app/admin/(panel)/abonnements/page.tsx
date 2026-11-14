import { USERS } from "../data";
import { monthlyPrice } from "@/lib/pricing";
import { fcfa } from "@/lib/format";

export default function Abonnements() {
  const paying = USERS.filter((u) => u.status === "Actif");
  const mrr = paying.reduce((t, u) => t + monthlyPrice(u.pack === "Woly Elec IA" ? "ia" : "simple", u.meters), 0);
  const trials = USERS.filter((u) => u.status === "Essai").length;
  return (
    <>
      <div className="kpis">
        <div className="card kpi"><span className="lab">Revenu mensuel récurrent</span><span className="v">{fcfa(mrr)}</span><span className="xs mut">Abonnés actifs de l&apos;échantillon</span></div>
        <div className="card kpi"><span className="lab">Abonnés payants</span><span className="v">{paying.length}</span></div>
        <div className="card kpi"><span className="lab">Essais en cours</span><span className="v">{trials}</span><span className="xs mut">Rappels J-7, J-3, J-1</span></div>
        <div className="card kpi"><span className="lab">Part Woly Elec IA</span><span className="v">{Math.round((paying.filter((u) => u.pack === "Woly Elec IA").length / Math.max(1, paying.length)) * 100)} %</span></div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Tous les abonnements</b></div>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead><tr><th>Utilisateur</th><th>Offre</th><th className="n">Compteurs</th><th className="n">Prix mensuel</th><th>Statut</th><th>Échéance</th></tr></thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.pack}</td><td className="n">{u.meters}</td>
                  <td className="n">{u.pack === "Essai" ? "—" : fcfa(monthlyPrice(u.pack === "Woly Elec IA" ? "ia" : "simple", u.meters))}</td>
                  <td><span className={`badge ${u.status === "Actif" ? "b-ok" : u.status === "Essai" ? "b-trial" : "b-risk"}`}>{u.status}</span></td><td>{u.expires}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
