"use client";

import { useEffect, useState } from "react";

/**
 * Écran de chargement de l'application : fond vert du thème, logo et barre de chargement.
 * Rendu dès le HTML du serveur (aucun écran blanc), il s'efface en fondu quand les données sont prêtes.
 * Affiché au moins 700 ms pour ne pas clignoter.
 */
export function Splash({ ready, min = 700, label = "Chargement de votre compte…" }: { ready: boolean; min?: number; label?: string }) {
  const [minDone, setMinDone] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinDone(true), min);
    return () => clearTimeout(t);
  }, [min]);
  const leaving = ready && minDone;
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setGone(true), 450);
    return () => clearTimeout(t);
  }, [leaving]);
  if (gone) return null;
  return (
    <div className={`splash${leaving ? " out" : ""}`} role="status" aria-live="polite" aria-busy={!leaving}>
      <div className="splash-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-icon.png" alt="" className="splash-logo" />
        <div className="splash-name">
          <b>WOLY</b> <i>ELEC</i>
        </div>
        <p className="splash-tag">Votre électricité, sous contrôle</p>
        <div className="splash-bar" aria-hidden="true"><span /></div>
        <span className="splash-sr">{label}</span>
      </div>
    </div>
  );
}
