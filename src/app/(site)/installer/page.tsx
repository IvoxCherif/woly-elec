import type { Metadata } from "next";
import { InstallGuide } from "@/components/InstallGuide";

export const metadata: Metadata = {
  title: "Installer l'application et activer les notifications",
  description: "Ajoutez Woly Elec sur l'écran d'accueil de votre téléphone Android ou iPhone et recevez vos alertes avant coupure.",
};

export default function InstallerSite() {
  return (
    <section className="sec">
      <div className="wrap col" style={{ gap: 20 }}>
        <div className="col" style={{ gap: 8 }}>
          <span className="eyebrow">Application mobile</span>
          <h1 className="h2" style={{ fontSize: 34 }}>Woly Elec sur votre téléphone</h1>
          <p className="lead" style={{ maxWidth: 680 }}>
            Ajoutez Woly Elec sur l&apos;écran d&apos;accueil comme une application, puis activez les notifications pour recevoir vos alertes avant coupure, même application fermée. Rien à télécharger sur un store.
          </p>
        </div>
        <InstallGuide />
      </div>
    </section>
  );
}
