"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SupportForm } from "@/components/site/SupportForm";
import { useStore } from "@/lib/store";

export default function Support() {
  const { state, mode } = useStore();
  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <div className="card col" style={{ gap: 16, padding: 28 }}>
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Support et réclamations</span>
          <h2 className="h2" style={{ fontSize: 28 }}>Comment pouvons-nous vous aider ?</h2>
          <p className="sm">Question sur un calcul, réclamation, problème avec votre compte ou votre abonnement : écrivez-nous ici.</p>
        </div>
        <SupportForm connected={mode === "server"} defaultEmail={mode === "server" ? state.user.email : ""} defaultName={mode === "server" ? state.user.name : ""} />
      </div>
      <div className="col" style={{ gap: 20 }}>
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Autres moyens</b>
          <div className="tick sm"><Icon name="mail" size="s" /><a href="mailto:support@wolyelec.com">support@wolyelec.com</a></div>
          <div className="tick sm"><Icon name="chat" size="s" /><a href="https://wa.me/221771234567">WhatsApp : +221 77 123 45 67</a></div>
          <span className="xs mut">Réponse en quelques heures, du lundi au samedi.</span>
        </div>
        <div className="card col" style={{ gap: 8 }}>
          <b className="h3">Questions fréquentes</b>
          <Link className="sm" href="/aide">Comment relever les codes 801, 813 et 814 ?</Link>
          <Link className="sm" href="/aide">Pourquoi mes kWh varient pour un même montant ?</Link>
          <Link className="sm" href="/connexion">J&apos;ai oublié mon mot de passe</Link>
        </div>
      </div>
    </div>
  );
}
