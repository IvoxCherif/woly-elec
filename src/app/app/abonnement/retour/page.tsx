"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { fcfa } from "@/lib/format";
import { useStore } from "@/lib/store";

type Statut = "en_attente" | "confirme" | "echec" | "annule" | "introuvable" | "erreur";

function Retour() {
  const ref = useSearchParams().get("ref") ?? "";
  const { replaceState } = useStore();
  const [statut, setStatut] = useState<Statut>("en_attente");
  const [info, setInfo] = useState<{ montant: number; libelle: string } | null>(null);
  const [checks, setChecks] = useState(0);
  const timer = useRef<number | null>(null);
  // replaceState change à chaque rendu : on le garde dans une ref pour ne pas relancer la vérification en boucle
  const apply = useRef(replaceState);
  apply.current = replaceState;

  const check = useCallback(async () => {
    try {
      const r = await fetch(`/api/paiement/${encodeURIComponent(ref)}`, { cache: "no-store" });
      if (r.status === 404) return setStatut("introuvable");
      const j = await r.json();
      if (!r.ok) return setStatut("erreur");
      setInfo({ montant: j.montant, libelle: j.libelle });
      setStatut(j.statut as Statut);
      if (j.state) apply.current(j.state);
    } catch {
      /* réseau : on réessaie au prochain passage */
    } finally {
      setChecks((n) => n + 1);
    }
  }, [ref]);

  useEffect(() => {
    if (!ref) {
      setStatut("introuvable");
      return;
    }
    void check();
  }, [ref, check]);

  // Vérification toutes les 4 s pendant 3 minutes tant que SasPay n'a pas confirmé
  useEffect(() => {
    if (statut !== "en_attente" || checks === 0 || checks > 45) return;
    timer.current = window.setTimeout(() => void check(), 4000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [statut, checks, check]);

  return (
    <div className="center col" style={{ gap: 16, textAlign: "center", alignItems: "center", paddingTop: 20 }}>
      {statut === "confirme" ? (
        <>
          <span className="avatar" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--ok1)", color: "var(--ok)" }}><Icon name="check" size="l" /></span>
          <h2 className="h2" style={{ fontSize: 28 }}>Paiement reçu, merci !</h2>
          {info && <p className="sm">{info.libelle} · {fcfa(info.montant)}. Votre abonnement est actif.</p>}
          <span className="xs mut">Référence {ref}</span>
          <Link className="btn btn-blue" href="/app/abonnement">Voir mon abonnement</Link>
        </>
      ) : statut === "en_attente" ? (
        <>
          <span className="avatar" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--blue1)", color: "var(--blue)" }}><Icon name="clock" size="l" /></span>
          <h2 className="h2" style={{ fontSize: 28 }}>Confirmation du paiement…</h2>
          <p className="sm">Nous attendons la confirmation de votre opérateur. Si vous avez validé le paiement sur votre téléphone, cela prend généralement quelques secondes.</p>
          {checks > 45 ? (
            <button type="button" className="btn btn-line" onClick={() => { setChecks(1); void check(); }}>Vérifier à nouveau</button>
          ) : (
            <span className="skel" style={{ display: "inline-block", width: 180, height: 10 }} aria-hidden="true" />
          )}
          <span className="xs mut">Vous pouvez fermer cette page : l&apos;abonnement s&apos;active automatiquement dès la confirmation. Référence {ref}</span>
        </>
      ) : (
        <>
          <span className="avatar" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--red1)", color: "var(--red)" }}><Icon name="x" size="l" /></span>
          <h2 className="h2" style={{ fontSize: 28 }}>{statut === "introuvable" ? "Paiement introuvable" : statut === "erreur" ? "Vérification impossible" : "Paiement non abouti"}</h2>
          <p className="sm">{statut === "annule" || statut === "echec" ? "Aucun montant n'a été validé pour cet abonnement. Vous pouvez réessayer." : "Réessayez dans un instant ou contactez support@wolyelec.com avec la référence ci-dessous."}</p>
          {ref && <span className="xs mut">Référence {ref}</span>}
          <Link className="btn btn-yel" href="/app/abonnement/paiement">Réessayer le paiement</Link>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="skel" style={{ height: 240 }} aria-busy="true" />}>
      <Retour />
    </Suspense>
  );
}
