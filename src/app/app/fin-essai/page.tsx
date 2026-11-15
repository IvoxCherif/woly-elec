"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useStore } from "@/lib/store";

export default function FinEssai() {
  const { loadScenario, mode, state } = useStore();
  // Abonnement payé arrivé à terme (et non simple fin d'essai)
  const wasPaid = state.subscription.payments.length > 0;
  return (
    <div className="overlay light" style={{ position: "relative", inset: "auto", minHeight: "70vh", background: "transparent" }}>
      <div className="modal col" role="dialog" aria-label={wasPaid ? "Votre abonnement est terminé" : "Votre essai est terminé"} style={{ maxWidth: 680, gap: 20, padding: 36, alignItems: "center", textAlign: "center" }}>
        <span className="avatar" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--yel1)", color: "#8A6A00" }}><Icon name="clock" size="l" /></span>
        <div className="col" style={{ gap: 6, alignItems: "center" }}>
          <h2 className="h2" style={{ fontSize: 32 }}>{wasPaid ? "Votre abonnement est terminé" : "Votre essai est terminé"}</h2>
          <p className="lead" style={{ maxWidth: 520 }}>Vos données sont conservées. Abonnez-vous pour reprendre là où vous vous êtes arrêté.</p>
        </div>
        <div className="card flat col" style={{ gap: 10, width: "100%", textAlign: "left", background: "var(--bg)" }}>
          <span className="lab">Sans abonnement, vous perdez</span>
          <div className="tick"><Icon name="x" size="s" style={{ color: "var(--red)" }} /><span className="sm ink"><b>Vos alertes avant coupure</b> par WhatsApp, SMS et push</span></div>
          <div className="tick"><Icon name="x" size="s" style={{ color: "var(--red)" }} /><span className="sm ink"><b>Votre montant exact</b> pour tenir jusqu&apos;à la fin du mois</span></div>
          <div className="tick"><Icon name="x" size="s" style={{ color: "var(--red)" }} /><span className="sm ink"><b>Votre plan du mois</b> et le meilleur jour de recharge</span></div>
        </div>
        <div className="row wrapf" style={{ gap: 12, justifyContent: "center" }}>
          <Link className="btn btn-yel btn-lg" href="/app/abonnement/paiement">Me réabonner · dès 1 999 F/mois</Link>
          <Link className="btn btn-line btn-lg" href="/tarifs">Voir les offres</Link>
        </div>
        <span className="xs mut">Paiement sécurisé par Wave, Orange Money, Free Money ou carte bancaire · sur le site uniquement</span>
        {mode === "demo" && <button type="button" className="xs" style={{ color: "var(--blue)" }} onClick={() => loadScenario("essai")}>Démo : revenir à un essai en cours</button>}
      </div>
    </div>
  );
}
