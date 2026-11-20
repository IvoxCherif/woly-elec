"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Callout } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { fcfa } from "@/lib/format";
import { useStore } from "@/lib/store";
import { useAppUI } from "@/components/app/AppShell";

type Achat = { reference: string; statut: string; montant: number; total: number; numeroCompteur: string; token: string | null };

/** Retour de la page de paiement : suit la commande jusqu'à la remise du code de recharge. */
export default function RetourRecharge() {
  const { notify, replaceState } = useStore();
  const { openReleve } = useAppUI();
  const [a, setA] = useState<Achat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useRef(replaceState);
  refresh.current = replaceState;

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref) return setError("Recharge introuvable.");
    let stop = false;
    let tries = 0;
    const tick = async () => {
      const r = await fetch(`/api/recharge/${encodeURIComponent(ref)}`, { cache: "no-store" }).catch(() => null);
      if (stop) return;
      if (r?.status === 404) return setError("Recharge introuvable.");
      if (r?.ok) {
        const j = (await r.json()) as Achat;
        setA(j);
        if (j.statut === "livre") {
          // Historique à jour (la recharge a été enregistrée sur le compteur)
          const me = await fetch("/api/me", { cache: "no-store" }).catch(() => null);
          if (me?.ok) refresh.current(await me.json());
          return;
        }
        if (["annule", "a_rembourser", "rembourse"].includes(j.statut)) return;
      }
      if (++tries < 60) setTimeout(() => void tick(), 4000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, []);

  async function copy() {
    if (!a?.token) return;
    try {
      await navigator.clipboard.writeText(a.token.replace(/\s/g, ""));
      notify("Code copié");
    } catch {
      /* copie indisponible : le code reste affiché */
    }
  }

  if (error) return <Callout tone="red" title="Oups">{error} <Link href="/app/recharger">Retour</Link></Callout>;
  if (!a) return <div className="skel" style={{ height: 240 }} aria-busy="true" />;

  return (
    <div className="stack" style={{ maxWidth: 620 }}>
      {a.statut === "livre" && a.token ? (
        <div className="card col" style={{ gap: 16, alignItems: "center", textAlign: "center" }}>
          <span className="avatar" style={{ background: "var(--ok1)", color: "var(--ok)", width: 56, height: 56 }}><Icon name="check" /></span>
          <b className="h2" style={{ fontSize: 26 }}>Votre recharge est prête</b>
          <p className="sm">Tapez ce code sur le clavier du compteur {a.numeroCompteur}, puis validez :</p>
          <div className="mont ink" style={{ fontSize: 26, fontWeight: 800, letterSpacing: 2, background: "var(--g1)", borderRadius: 14, padding: "16px 18px", fontVariantNumeric: "tabular-nums", overflowWrap: "anywhere" }}>{a.token}</div>
          <button type="button" className="btn btn-line" onClick={() => void copy()}>Copier le code</button>
          <p className="xs mut">{fcfa(a.montant)} de crédit · payé {fcfa(a.total)} · référence {a.reference}. Le code est aussi gardé dans votre historique.</p>
          <button type="button" className="btn btn-blue btn-blk" onClick={openReleve}>Code tapé : faire mon relevé</button>
        </div>
      ) : a.statut === "a_rembourser" || a.statut === "rembourse" ? (
        <Callout tone="warn" title={a.statut === "rembourse" ? "Paiement remboursé" : "Recharge non délivrée"}>
          {a.statut === "rembourse"
            ? `Votre paiement de ${fcfa(a.total)} vous a été remboursé.`
            : `Votre paiement de ${fcfa(a.total)} est bien reçu, mais la recharge n'a pas pu être achetée. Notre équipe vous envoie le code ou vous rembourse rapidement. Référence : ${a.reference}.`}
        </Callout>
      ) : a.statut === "annule" ? (
        <Callout tone="info" title="Paiement non effectué">Aucun montant n&apos;a été débité. <Link href="/app/recharger" style={{ fontWeight: 700 }}>Réessayer</Link></Callout>
      ) : (
        <div className="card col" style={{ gap: 12, alignItems: "center", textAlign: "center" }}>
          <div className="skel" style={{ width: 56, height: 56, borderRadius: "50%" }} />
          <b className="h3">{a.statut === "en_attente" ? "Confirmation du paiement…" : "Achat de votre recharge…"}</b>
          <p className="sm mut">Cela prend en général moins d&apos;une minute. Vous pouvez quitter cette page : le code vous sera envoyé en notification.</p>
        </div>
      )}
    </div>
  );
}
