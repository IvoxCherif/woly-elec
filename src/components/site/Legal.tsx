export function LegalPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="sec">
      <div className="wrap" style={{ maxWidth: 860 }}>
        <article className="card col" style={{ gap: 16, padding: "clamp(24px,5vw,44px)" }}>
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="h2">{title}</h1>
          <div className="col legal" style={{ gap: 14 }}>{children}</div>
          <hr className="hr" />
          <p className="xs mut">Dernière mise à jour : novembre 2026. [TEXTE JURIDIQUE À FAIRE VALIDER PAR UN CONSEIL]</p>
        </article>
      </div>
    </section>
  );
}
