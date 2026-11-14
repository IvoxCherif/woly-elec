import Link from "next/link";
import { Logo } from "@/components/ui";
import { BackButton } from "@/components/BackButton";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <header className="hdr">
        <div className="wrap" style={{ minHeight: 64 }}>
          <BackButton fallback="/" compact />
          <Logo href="/" size={36} />
          <span className="sp" />
          <Link className="sm" href="/aide">Besoin d&apos;aide ?</Link>
        </div>
      </header>
      <main id="contenu" style={{ flex: 1, padding: "40px 18px 56px" }}>{children}</main>
      <p className="xs mut" style={{ textAlign: "center", padding: "0 18px 24px" }}>Woly Elec est un service indépendant, non affilié à la Senelec.</p>
    </div>
  );
}
