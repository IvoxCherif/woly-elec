"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Callout, TextField } from "@/components/ui";
import { GoogleButton, OrSeparator } from "@/components/site/GoogleButton";
import { CodeInput } from "@/components/site/CodeInput";

const ERR: Record<string, string> = {
  identifiants: "E-mail ou mot de passe incorrect.",
  compte_google: "Ce compte a été créé avec Google : utilisez le bouton « Se connecter avec Google », ou choisissez un mot de passe avec « Mot de passe oublié ».",
  google_indisponible: "La connexion avec Google n'est pas encore activée. Utilisez votre e-mail.",
  google_annule: "Connexion avec Google annulée.",
  google_session: "La connexion avec Google a expiré : recommencez.",
  google_refuse: "Google n'a pas pu confirmer votre compte.",
  code_invalide: "Code incorrect ou expiré.",
  trop_de_codes: "Trop de codes demandés. Réessayez dans une heure.",
  email_indisponible: "L'envoi d'e-mails est momentanément indisponible. Écrivez à support@wolyelec.com.",
  mot_de_passe_court: "Le mot de passe doit faire au moins 8 caractères.",
  email_invalide: "Adresse e-mail invalide.",
};

type Mode = "connexion" | "oubli" | "nouveau";

export default function Connexion() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("erreur");
    if (err) setError(ERR[err] ?? "Connexion impossible.");
  }, []);

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "connexion") {
        const r = await post("/api/auth/login", { email, password });
        if (r.ok) return router.push("/app");
        if (r.status === 503 && r.data.error === "demo") return router.push("/app");
        if (r.data.error === "bloque") setError(`Trop de tentatives. Réessayez dans ${r.data.minutes} minute${r.data.minutes > 1 ? "s" : ""}.`);
        else setError(ERR[r.data.error] ?? "Connexion impossible.");
        setPassword("");
      } else if (mode === "oubli") {
        const r = await post("/api/auth/email-code", { email, usage: "reinitialisation" });
        if (!r.ok) return setError(ERR[r.data.error] ?? "Envoi du code impossible.");
        setDemoCode(r.data.demoCode ?? null);
        setInfo(`Si un compte existe pour ${email.trim().toLowerCase()}, un code à 6 chiffres vient d'être envoyé par wolyelec@wolyelec.com.`);
        setCode("");
        setMode("nouveau");
      } else {
        if (password !== password2) return setError("Les deux mots de passe sont différents.");
        const r = await post("/api/auth/reset", { email, code, password });
        if (r.ok) return router.push("/app");
        setError(ERR[r.data.error] ?? "Réinitialisation impossible.");
      }
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setBusy(false);
    }
  }

  const back = () => {
    setMode("connexion");
    setError(null);
    setInfo(null);
    setPassword("");
    setPassword2("");
  };

  return (
    <div className="center col" style={{ gap: 14, maxWidth: 460 }}>
      <form className="card col" style={{ gap: 16, padding: 28 }} onSubmit={submit}>
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">{mode === "connexion" ? "Connexion" : "Mot de passe oublié"}</span>
          <h1 className="h2" style={{ fontSize: 30 }}>{mode === "connexion" ? "Content de vous revoir" : mode === "oubli" ? "Recevoir un code" : "Nouveau mot de passe"}</h1>
          <p className="sm">
            {mode === "connexion" ? "Connectez-vous pour suivre votre compteur." : mode === "oubli" ? "Indiquez l'adresse e-mail de votre compte : nous vous envoyons un code à 6 chiffres." : "Saisissez le code reçu par e-mail, puis choisissez un nouveau mot de passe."}
          </p>
        </div>
        {error && <Callout tone="red" title="Oups">{error}</Callout>}
        {info && mode === "nouveau" && <Callout tone="info" title="Vérifiez votre boîte mail">{info} Pensez aux courriers indésirables.</Callout>}
        {demoCode && mode === "nouveau" && <Callout tone="info" title={`Code : ${demoCode}`}>Développement : l&apos;envoi d&apos;e-mails n&apos;est pas configuré.</Callout>}

        {mode === "connexion" && (
          <>
            <GoogleButton mode="connexion" />
            <OrSeparator />
          </>
        )}
        {mode !== "nouveau" && <TextField label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="vous@exemple.com" />}
        {mode === "nouveau" && <CodeInput value={code} onChange={setCode} />}
        {mode !== "oubli" && (
          <div className="field">
            <label htmlFor="pw">{mode === "nouveau" ? "Nouveau mot de passe (8 caractères minimum)" : "Mot de passe"}</label>
            <div className="inp">
              <input id="pw" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "nouveau" ? "new-password" : "current-password"} />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ color: "var(--mut)", display: "flex" }}>
                <Icon name="eye" size="s" />
              </button>
            </div>
          </div>
        )}
        {mode === "nouveau" && <TextField label="Confirmez le mot de passe" type="password" value={password2} onChange={setPassword2} autoComplete="new-password" />}

        <button
          type="submit"
          className="btn btn-blue btn-blk"
          disabled={busy || (mode === "connexion" ? !email || !password : mode === "oubli" ? !email : code.length < 6 || password.length < 8 || !password2)}
        >
          {busy ? "Un instant…" : mode === "connexion" ? "Se connecter" : mode === "oubli" ? "Recevoir mon code" : "Changer mon mot de passe"}
        </button>
        {mode === "connexion" ? (
          <button type="button" className="sm" style={{ color: "var(--blue)", fontWeight: 600 }} onClick={() => { setMode("oubli"); setError(null); }}>
            Mot de passe oublié ?
          </button>
        ) : (
          <button type="button" className="sm" style={{ color: "var(--blue)", fontWeight: 600 }} onClick={back}>
            Retour à la connexion
          </button>
        )}
      </form>
      <div className="card row wrapf" style={{ gap: 12, justifyContent: "center", padding: 18 }}>
        <span className="sm">Pas encore de compte ?</span>
        <Link className="btn btn-yel btn-sm" href="/inscription">Créer un compte</Link>
      </div>
      <p className="xs mut" style={{ textAlign: "center" }}>
        Un problème ? <Link href="/aide#contact">Contactez le support</Link> · support@wolyelec.com
      </p>
    </div>
  );
}
