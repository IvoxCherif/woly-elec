"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useStore, trialDaysLeft } from "@/lib/store";
import { ddmmyyyy, fcfa } from "@/lib/format";
import { IA_QUOTA_PER_METER, monthlyPrice, annualPrice, PACKS, TRIAL_DAYS } from "@/lib/pricing";

export default function Abonnement() {
  const { state, today, changePack, notify } = useStore();
  const quota = state.iaQuota ?? IA_QUOTA_PER_METER;
  const sub = state.subscription;
  const left = trialDaysLeft(state, today);
  const n = state.meters.length;
  const other = sub.pack === "ia" ? "simple" : "ia";
  const renewal = sub.cycle === "annuel" ? annualPrice(sub.pack, n, sub.year + 1) : monthlyPrice(sub.pack, n);

  return (
    <>
      <div className="grid2">
        <div className="card col" style={{ gap: 14, padding: 24 }}>
          <div className="row">
            <span className="lab">Offre actuelle</span>
            <span className="sp" />
            {sub.vip ? <span className="badge b-ia">VIP · offert</span> : <span className={`badge ${sub.status === "essai" ? "b-trial" : sub.status === "actif" ? "b-ok" : "b-risk"}`}>{sub.status === "essai" ? "Essai gratuit" : sub.status === "actif" ? "Actif" : "Expiré"}</span>}
          </div>
          <div className="col" style={{ gap: 2 }}>
            <b className="big" style={{ fontSize: 30 }}>{PACKS[sub.pack].name}</b>
            <span className="sm">
              {sub.vip
                ? `${n} compteur${n > 1 ? "s" : ""} · accès offert par Woly Elec, sans paiement`
                : sub.status === "essai"
                ? `Essai complet · 1 compteur · expire le ${ddmmyyyy(sub.trialEnd)}`
                : sub.status === "actif"
                  ? `${n} compteur${n > 1 ? "s" : ""} · ${sub.cycle} · renouvellement le ${sub.renewsAt ? ddmmyyyy(sub.renewsAt) : "—"}`
                  : "Vos alertes et votre montant exact sont désactivés."}
            </span>
          </div>
          {sub.status === "essai" && (
            <>
              <div className="tr" style={{ background: "var(--g1)" }}><b style={{ width: `${(left / TRIAL_DAYS) * 100}%`, background: "var(--yel2)" }} /></div>
              <span className="sm"><b className="ink">{left} jour{left > 1 ? "s" : ""} restant{left > 1 ? "s" : ""}</b> sur {TRIAL_DAYS}. Sans abonnement, vous ne recevrez plus vos alertes de coupure ni votre montant exact.</span>
            </>
          )}
          {sub.status === "actif" && !sub.vip && (
            <span className="sm">Prix de renouvellement : <b className="ink">{fcfa(renewal)}</b>{sub.cycle === "annuel" ? " par an à partir de la 2e année (12 mois payés)" : " par mois"}.</span>
          )}
          {!sub.vip && <div className="row wrapf" style={{ gap: 10 }}>
            <Link className="btn btn-yel" href="/app/abonnement/paiement">{sub.status === "actif" ? "Renouveler ou modifier" : sub.status === "essai" ? "S'abonner" : "Me réabonner"}</Link>
            <button type="button" className="btn btn-line" onClick={() => { changePack(other); notify(`Pack changé : ${PACKS[other].name}`); }}>
              Passer à {PACKS[other].name}
            </button>
          </div>}
        </div>
        <div className="card col" style={{ gap: 14, padding: 24 }}>
          <span className="lab">Compteurs</span>
          <div className="list">
            {state.meters.map((m, i) => (
              <div key={m.id}>
                <span className="avatar"><Icon name="plug" size="s" /></span>
                <div style={{ flex: 1 }}><b className="ink">{m.name}</b><div className="xs mut">{m.number} · {i === 0 ? (sub.status === "essai" ? "inclus dans l'essai" : `${fcfa(PACKS[sub.pack].first)}/mois`) : `+${fcfa(PACKS[sub.pack].extra)}/mois`}</div></div>
                <span className="badge b-ok">Actif</span>
              </div>
            ))}
            <div>
              <span className="avatar" style={{ border: "1.5px dashed #C9D6CF", background: "#fff" }}><Icon name="plus" size="s" /></span>
              <div style={{ flex: 1 }}><b className="ink">Ajouter un compteur</b><div className="xs mut">+{fcfa(PACKS[sub.pack].extra)}/mois avec {PACKS[sub.pack].name}{sub.status === "essai" ? " · abonnement requis" : ""}</div></div>
              <Link className="btn btn-ghost btn-sm" href={sub.status === "actif" ? "/app/compteurs" : "/app/abonnement/paiement"}>Ajouter</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="grid2">
        {sub.pack === "ia" ? (
          <div className="card col" style={{ gap: 12 }}>
            <span className="lab">Quota IA · par compteur</span>
            {state.meters.slice(0, 4).map((m) => {
              const u = state.iaUsed[m.id] ?? 0;
              return (
                <div key={m.id} className="col" style={{ gap: 6 }}>
                  <div className="row"><b className="big" style={{ fontSize: 22 }}>{u}/{quota}</b><span className="sm">{m.name}</span></div>
                  <div className="tr" style={{ background: "var(--g1)" }}><b style={{ width: `${(u / Math.max(1, quota)) * 100}%`, background: "var(--blue)" }} /></div>
                </div>
              );
            })}
            <span className="xs mut">Le quota est de {quota} requêtes par compteur et n&apos;est pas partagé entre compteurs. Renouvelé le 1er du mois.</span>
          </div>
        ) : (
          <div className="card col" style={{ gap: 10 }}>
            <span className="lab">Woly Elec IA</span>
            <p className="sm">Ajoutez l&apos;assistant qui explique vos recharges et commente votre bilan : {fcfa(PACKS.ia.first)}/mois.</p>
            <button type="button" className="btn btn-lineb btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => changePack("ia")}>Découvrir Woly Elec IA</button>
          </div>
        )}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Historique des paiements</b></div>
          <div className="scr">
            <table className="tbl">
              <thead><tr><th>Date</th><th>Détail</th><th>Moyen</th><th className="n">Montant</th></tr></thead>
              <tbody>
                {sub.payments.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: "center", padding: 28, color: "var(--mut)" }}>Aucun paiement pour le moment. Votre essai est gratuit.</td></tr>
                ) : (
                  sub.payments.map((p) => (
                    <tr key={p.id}><td>{ddmmyyyy(p.date)}</td><td>{p.label}<div className="xs mut">Reçu {p.id}</div></td><td>{p.method}</td><td className="n">{fcfa(p.amount)}</td></tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="card row wrapf" style={{ gap: 16, background: "var(--g1)", borderColor: "var(--g2)" }}>
        <span className="avatar"><Icon name="lock" /></span>
        <div style={{ flex: "1 1 260px" }}>
          <b className="h4">Paiement sur le site uniquement</b>
          <p className="sm">Wave, Orange Money ou Free Money. L&apos;application mobile affiche l&apos;état de votre abonnement et renvoie vers cette page.</p>
        </div>
        <span className="chan"><span className="tag">Wave</span><span className="tag">Orange Money</span><span className="tag">Free Money</span></span>
      </div>
    </>
  );
}
