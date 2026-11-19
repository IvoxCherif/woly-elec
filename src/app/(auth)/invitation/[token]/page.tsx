"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Callout, TextField } from "@/components/ui";
import { Icon } from "@/components/Icon";

type Preview = { ownerName: string; role: "consulter" | "gerer"; compteurs: string[]; email: string; compteExiste: boolean; connecte: boolean };
const ERR: Record<string, string> = {
  invitation_invalide: "Cette invitation n'est plus valable : elle a expiré, a déjà été acceptée ou a été annulée. Demandez une nouvelle invitation.",
  nom_requis: "Indiquez votre nom.",
  mot_de_passe_court: "Le mot de passe doit faire au moins 8 caractères.",
  deja_inscrit: "Cette adresse a déjà un compte : connectez-vous, l'invitation vous attend dans « Partage ».",
  invitation_soi_meme: "Vous ne pouvez pas accepter votre propre invitation.",
  trop_de_requetes: "Trop d'essais : réessayez dans une heure.",
};

/** Page ouverte depuis l'e-mail d'invitation : accepter (connecté) ou créer son accès. */
export default function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [p, setP] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch(`/api/invitation/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setP((await r.json()) as Preview) : setError(ERR.invitation_invalide)))
      .catch(() => setError("Connexion impossible. Vérifiez votre réseau."));
  }, [token]);

  async function send(body: unknown) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/invitation/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok) return window.location.assign("/app");
    setError(ERR[j.error] ?? "Action impossible, réessayez.");
  }

  return (
    <div className="center col" style={{ gap: 14, maxWidth: 480 }}>
      <div className="card col" style={{ gap: 16, padding: 28 }}>
        <span className="eyebrow">Invitation</span>
        {error && <Callout tone="red" title="Oups">{error}</Callout>}
        {!p && !error && <div className="skel" style={{ height: 160 }} />}
        {p && (
          <>
            <h1 className="h2" style={{ fontSize: 28 }}>{p.ownerName} vous invite sur Woly Elec</h1>
            <div className="col" style={{ gap: 8 }}>
              <div className="tick sm"><Icon name="bolt" size="s" /><span>Compteur{p.compteurs.length > 1 ? "s" : ""} : <b>{p.compteurs.join(", ")}</b></span></div>
              <div className="tick sm"><Icon name="check" size="s" /><span>Vous pourrez {p.role === "gerer" ? "voir le crédit, recevoir les alertes avant coupure, et faire les relevés et les recharges" : "voir le crédit restant et recevoir les alertes avant coupure"}.</span></div>
              <div className="tick sm"><Icon name="user" size="s" /><span>Vous gardez vos propres identifiants : rien n&apos;est partagé.</span></div>
            </div>
            {p.connecte ? (
              <button type="button" className="btn btn-blue btn-blk" disabled={busy} onClick={() => void send({ accepter: true })}>
                {busy ? "Un instant…" : "Accepter l'invitation"}
              </button>
            ) : p.compteExiste ? (
              <>
                <Callout tone="info" title="Vous avez déjà un compte">Connectez-vous avec {p.email} : l&apos;invitation vous attend dans le menu « Partage ».</Callout>
                <Link className="btn btn-blue btn-blk" href="/connexion">Me connecter</Link>
              </>
            ) : (
              <form className="col" style={{ gap: 12 }} onSubmit={(e) => { e.preventDefault(); void send({ name, password }); }}>
                <p className="sm">Créez votre accès pour <b>{p.email}</b> :</p>
                <TextField label="Votre nom" value={name} onChange={setName} autoComplete="name" placeholder="Awa Diop" />
                <TextField label="Mot de passe (8 caractères minimum)" type="password" value={password} onChange={setPassword} autoComplete="new-password" />
                <button type="submit" className="btn btn-blue btn-blk" disabled={busy || name.trim().length < 2 || password.length < 8}>
                  {busy ? "Un instant…" : "Créer mon accès et accepter"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
