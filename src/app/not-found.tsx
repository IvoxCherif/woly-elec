import Link from "next/link";
import { Logo } from "@/components/ui";
import { BackButton } from "@/components/BackButton";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <header className="hdr"><div className="wrap" style={{ minHeight: 64 }}><BackButton fallback="/" compact /><Logo href="/" size={36} /></div></header>
      <main className="wrap col" style={{ flex: 1, gap: 14, alignItems: "flex-start", justifyContent: "center", padding: "56px 28px" }}>
        <span className="big" style={{ fontSize: 96, color: "var(--g9)" }}>4<span style={{ color: "var(--yel2)" }}>0</span>4</span>
        <h1 className="h2">Cette page est introuvable</h1>
        <p className="lead">Le lien est peut-être incorrect ou a expiré. Retournez à l&apos;accueil pour continuer.</p>
        <div className="row wrapf">
          <Link className="btn btn-blue" href="/">Retour à l&apos;accueil</Link>
          <Link className="btn btn-line" href="/aide">Contacter l&apos;aide</Link>
        </div>
      </main>
    </div>
  );
}
