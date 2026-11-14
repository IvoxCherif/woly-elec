"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Callout, TextField } from "@/components/ui";
import { GoogleButton, OrSeparator } from "@/components/site/GoogleButton";

const ERR: Record<string, string> = {
  identifiants: "E-mail ou mot de passe incorrect.",
  compte_google: "Ce compte a été créé avec Google : utilisez le bouton « Se connecter avec Google ».",
  google_indisponible: "La connexion avec Google n'est pas encore activée. Utilisez votre e-mail.",
  google_annule: "Connexion avec Google annulée.",
  google_session: "La connexion avec Google a expiré : recommencez.",
  google_refuse: "Google n'a pas pu confirmer votre compte.",
};

export default function Connexion() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("erreur");
    if (err) setError(ERR[err] ?? "Connexion impossible.");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return router.push("/app");
      if (r.status === 503 && j.error === "demo") {
        setDemo(true);
        return router.push("/app");
      }
      if (j.error === "bloque") setError(`Trop de tentatives. Réessayez dans ${j.minutes} minute${j.minutes > 1 ? "s" : ""}.`);
      else setError(ERR[j.error] ?? "Connexion impossible.");
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setBusy(false);
    }
    setPassword("");
  }

  return (
    <div className="center col" style={{ gap: 14, maxWidth: 460 }}>
      <form className="card col" style={{ gap: 16, padding: 28 }} onSubmit={submit}>
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Connexion</span>
          <h1 className="h2" style={{ fontSize: 30 }}>Content de vous revoir</h1>
          <p className="sm">Connectez-vous pour suivre votre compteur.</p>
        </div>
        {error && <Callout tone="red" title="Oups">{error}</Callout>}
        {demo && <Callout tone="info" title="Version de démonstration">Ce serveur n&apos;a pas de base de données : ouverture du compte de démonstration.</Callout>}
        <GoogleButton mode="connexion" />
        <OrSeparator />
        <TextField label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="vous@exemple.com" />
        <div className="field">
          <label htmlFor="pw">Mot de passe</label>
          <div className="inp">
            <input id="pw" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ color: "var(--mut)", display: "flex" }}>
              <Icon name="eye" size="s" />
            </button>
          </div>
        </div>
        <button type="submit" className="btn btn-blue btn-blk" disabled={busy || !email || !password}>{busy ? "Connexion…" : "Se connecter"}</button>
        <p className="xs mut" style={{ textAlign: "center" }}>
          Mot de passe oublié ? <a href="https://wa.me/221771234567">Écrivez-nous sur WhatsApp</a>, nous vous aidons à le réinitialiser.
        </p>
      </form>
      <div className="card row wrapf" style={{ gap: 12, justifyContent: "center", padding: 18 }}>
        <span className="sm">Pas encore de compte ?</span>
        <Link className="btn btn-yel btn-sm" href="/inscription">Créer un compte</Link>
      </div>
    </div>
  );
}
