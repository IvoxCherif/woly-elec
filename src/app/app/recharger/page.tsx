"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Callout, NumField } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useMeterStats, useStore } from "@/lib/store";
import { fcfa, parseNum } from "@/lib/format";

type Achat = { reference: string; statut: string; montant: number; total: number; numeroCompteur: string; token: string | null; date: string };
type Check = { nom: string; adresse: string; statut: string; numero: string };

const ERR: Record<string, string> = {
  recharge_indisponible: "La recharge dans l'application n'est pas disponible pour le moment.",
  compteur_inconnu_senelec: "Ce numéro de compteur est inconnu chez Senelec : vérifiez-le dans « Compteurs ».",
  compteur_inactif: "Ce compteur n'est pas actif chez Senelec : contactez la Senelec.",
  verification_impossible: "Vérification du compteur impossible pour le moment : réessayez dans un instant.",
  montant_invalide: "Montant entre 1 000 et 200 000 F.",
  paiement_indisponible: "Le paiement en ligne est momentanément indisponible.",
  compteur_introuvable: "Vous ne pouvez pas recharger ce compteur.",
  trop_de_requetes: "Trop d'essais : réessayez dans une heure.",
};
const PRESETS = [2000, 5000, 10000, 20000];
const STATUT: Record<string, string> = { livre: "Code livré", en_attente: "Paiement en attente", paye: "En cours", en_cours: "En cours", a_rembourser: "Remboursement en cours", rembourse: "Remboursé" };

/** Achat d'une recharge Woyofal dans l'application (visible seulement quand l'administrateur l'a activé). */
export default function Recharger() {
  const { state, meter, mode } = useStore();
  const s = useMeterStats();
  const offer = state.rechargeEnLigne;
  const [montant, setMontant] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [achats, setAchats] = useState<Achat[]>([]);

  const conseil = s.plan.recommendedAmount > 0 ? Math.ceil(s.plan.recommendedAmount / 500) * 500 : 0;
  useEffect(() => {
    const q = Number(new URLSearchParams(window.location.search).get("montant"));
    setMontant(String(q >= 1000 ? q : conseil || 5000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vérification du compteur chez Senelec (nom du titulaire) à l'ouverture et au changement de compteur
  useEffect(() => {
    if (!offer || mode !== "server" || !meter) return;
    setCheck(null);
    setError(null);
    void fetch("/api/recharge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verifier", meterId: meter.id }) })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) setCheck(j as Check);
        else setError(ERR[j.error] ?? "Vérification impossible.");
      })
      .catch(() => setError("Connexion impossible."));
    void fetch("/api/recharge", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { achats?: Achat[] }) => setAchats(j.achats ?? []))
      .catch(() => undefined);
  }, [offer, mode, meter]);

  const m = parseNum(montant);
  const frais = useMemo(() => (offer && m > 0 ? Math.round((m * offer.fraisPct) / 100 + offer.fraisFixe) : 0), [offer, m]);
  const valid = m >= 1000 && m <= 200000;

  if (!offer || mode !== "server")
    return (
      <Callout tone="info" title="Bientôt disponible">
        La recharge Woyofal directement dans Woly Elec arrive bientôt. En attendant, rechargez chez votre revendeur habituel puis <Link href="/app" style={{ fontWeight: 700 }}>enregistrez la recharge</Link>.
      </Callout>
    );

  async function pay() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/recharge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "acheter", meterId: meter.id, montant: m }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok && j.url) return window.location.assign(j.url);
    setBusy(false);
    setError(ERR[j.error] ?? "Paiement impossible, réessayez.");
  }

  return (
    <div className="stack" style={{ maxWidth: 620 }}>
      {error && <Callout tone="red" title="Oups">{error}</Callout>}
      <div className="card col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar y"><Icon name="bolt" /></span>
          <div className="fx1">
            <b className="h3">{meter.name}</b>
            <div className="xs mut">Compteur {meter.number}</div>
          </div>
        </div>
        {check ? (
          <div className="alert al-ok" role="status">
            <span className="ai"><Icon name="check" size="s" /></span>
            <div className="fx1"><b>Compteur vérifié chez Senelec</b>{check.nom ? `Au nom de ${check.nom}` : "Compteur trouvé"}{check.adresse ? ` · ${check.adresse}` : ""}</div>
          </div>
        ) : !error ? (
          <div className="skel" style={{ height: 56 }} />
        ) : null}

        <div className="col" style={{ gap: 8 }}>
          <span className="lbl">Montant de la recharge</span>
          <div className="chips">
            {conseil > 0 && (
              <button type="button" className="chip" aria-pressed={m === conseil} onClick={() => setMontant(String(conseil))}>
                {fcfa(conseil)} · conseillé
              </button>
            )}
            {PRESETS.filter((x) => x !== conseil).map((x) => (
              <button key={x} type="button" className="chip" aria-pressed={m === x} onClick={() => setMontant(String(x))}>
                {fcfa(x)}
              </button>
            ))}
          </div>
          <NumField label="Autre montant" unit="F" value={montant} onChange={setMontant} hint="Entre 1 000 et 200 000 F." />
        </div>

        <div className="col" style={{ gap: 4, background: "var(--g1)", borderRadius: 12, padding: 14 }}>
          <div className="row sm"><span className="fx1">Recharge</span><b>{fcfa(valid ? m : 0)}</b></div>
          <div className="row sm"><span className="fx1">Frais de service</span><b>{fcfa(valid ? frais : 0)}</b></div>
          <div className="row" style={{ borderTop: "1px solid var(--ln)", paddingTop: 6, marginTop: 4 }}><b className="fx1 ink">Total à payer</b><b className="ink" style={{ fontSize: 20 }}>{fcfa(valid ? m + frais : 0)}</b></div>
        </div>

        <button type="button" className="btn btn-yel btn-lg btn-blk" disabled={busy || !valid || !check} onClick={() => void pay()}>
          {busy ? "Un instant…" : `Payer ${fcfa(valid ? m + frais : 0)}`}
        </button>
        <p className="xs mut">Paiement sécurisé par Wave, Orange Money ou Free Money. Le code de recharge de 20 chiffres s&apos;affiche ici et vous est envoyé en notification. La recharge est ajoutée à votre historique.</p>
      </div>

      {achats.length > 0 && (
        <div className="card col" style={{ gap: 4 }}>
          <b className="h3" style={{ marginBottom: 6 }}>Mes recharges achetées</b>
          {achats.map((a) => (
            <Link key={a.reference} href={`/app/recharger/retour?ref=${a.reference}`} className="row" style={{ gap: 10, padding: "10px 0", borderTop: "1px solid var(--ln)", textDecoration: "none", color: "inherit" }}>
              <div className="fx1">
                <b className="sm ink">{fcfa(a.montant)} · {a.numeroCompteur}</b>
                <div className="xs mut">{new Date(a.date).toLocaleDateString("fr-FR")} · {a.token ?? STATUT[a.statut] ?? a.statut}</div>
              </div>
              <Icon name="right" size="s" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
