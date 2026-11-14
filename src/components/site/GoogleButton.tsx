"use client";

import { useEffect, useState } from "react";

/** Bouton « Continuer avec Google » (désactivé tant que Google n'est pas configuré sur le serveur). */
export function GoogleButton({ mode }: { mode: "connexion" | "inscription" }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((j) => setEnabled(!!j.google))
      .catch(() => setEnabled(false));
  }, []);

  const content = (
    <>
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      {mode === "inscription" ? "S'inscrire avec Google" : "Se connecter avec Google"}
    </>
  );

  if (enabled === false)
    return (
      <div className="col" style={{ gap: 4 }}>
        <button type="button" className="btn btn-line btn-blk" disabled aria-disabled="true" style={{ opacity: 0.6 }}>
          {content}
        </button>
        <span className="xs mut" style={{ textAlign: "center" }}>Connexion avec Google bientôt disponible.</span>
      </div>
    );
  return (
    <a className="btn btn-line btn-blk" href={`/api/auth/google?mode=${mode}`} aria-busy={enabled === null} style={{ background: "#fff" }}>
      {content}
    </a>
  );
}

export function OrSeparator() {
  return (
    <div className="row" style={{ gap: 12 }} aria-hidden="true">
      <hr className="hr" style={{ flex: 1 }} />
      <span className="xs mut">ou avec votre e-mail</span>
      <hr className="hr" style={{ flex: 1 }} />
    </div>
  );
}
