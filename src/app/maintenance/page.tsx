import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/ui";

export const metadata: Metadata = { title: "Maintenance en cours" };

export default function Maintenance() {
  return (
    <main style={{ minHeight: "100vh", background: "var(--g9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="col" style={{ maxWidth: 560, gap: 16, alignItems: "flex-start" }}>
        <Logo dark size={44} />
        <span className="avatar" style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--yel)", color: "var(--g9)", marginTop: 20 }}><Icon name="wrench" size="l" /></span>
        <h1 className="h2" style={{ color: "#fff" }}>Maintenance en cours</h1>
        <p className="lead" style={{ color: "#cfe3d8" }}>Nous améliorons Woly Elec. Vos relevés et vos alertes restent enregistrés. Retour prévu dans environ 30 minutes.</p>
        <span className="badge b-trial">Vos données sont en sécurité</span>
      </div>
    </main>
  );
}
