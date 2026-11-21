"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { loadPixel, readConsent, track, writeConsent } from "@/lib/pixel";

// Pas de suivi dans l'administration, les liens de lecture partagés et les invitations
const EXCLUDED = ["/admin", "/c/", "/invitation", "/maintenance"];

/** Pixel Meta : chargé seulement si l'administrateur l'a activé et si le visiteur accepte les cookies de mesure. */
export function MetaPixel() {
  const path = usePathname() ?? "/";
  const excluded = EXCLUDED.some((p) => path.startsWith(p));
  const [id, setId] = useState<string | null>(null);
  const [ask, setAsk] = useState(false);
  const loaded = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (excluded || id) return;
    let stop = false;
    void fetch("/api/pixel")
      .then((r) => (r.ok ? r.json() : { id: null }))
      .then((j: { id: string | null }) => {
        if (stop || !j.id) return;
        setId(j.id);
        const c = readConsent();
        if (c === null) setAsk(true);
      })
      .catch(() => undefined);
    return () => {
      stop = true;
    };
  }, [excluded, id]);

  // Une page vue à chaque changement de page (navigation interne comprise)
  useEffect(() => {
    if (!id || excluded || readConsent() !== "oui") return;
    if (!loaded.current) {
      loadPixel(id);
      loaded.current = true;
    }
    if (lastPath.current === path) return;
    lastPath.current = path;
    track("PageView");
  }, [id, path, excluded, ask]);

  if (!ask || excluded) return null;

  const choose = (v: "oui" | "non") => {
    writeConsent(v);
    setAsk(false);
  };

  return (
    <div className={`consent${path.startsWith("/app") ? " consent-app" : ""}`} role="dialog" aria-label="Cookies de mesure">
      <p className="sm">
        Nous aimerions mesurer quelles publicités Facebook et Instagram vous ont amené ici (cookies Meta). Aucune donnée de vos compteurs n&apos;est partagée. <Link href="/confidentialite">En savoir plus</Link>
      </p>
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="btn btn-line" onClick={() => choose("non")}>Refuser</button>
        <button type="button" className="btn btn-blue" onClick={() => choose("oui")}>Accepter</button>
      </div>
    </div>
  );
}
