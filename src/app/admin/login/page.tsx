"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { Callout, Logo, TextField } from "@/components/ui";
import { CodeInput, CodeTimer } from "@/components/site/CodeInput";
import { BackButton } from "@/components/BackButton";

type Mode = "connexion" | "oubli" | "nouveau";

const ERR: Record<string, string> = {
  code_invalide: "Code incorrect ou expiré.",
  trop_de_codes: "Trop de codes demandés. Réessayez dans une heure.",
  email_indisponible: "L'envoi d'e-mails est indisponible : vérifiez SMTP_PASSWORD dans hPanel.",
  mot_de_passe_court: "Le mot de passe administrateur doit faire au moins 12 caractères.",
};

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>("connexion");
  const [identifiant, setIdentifiant] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goAdmin = () => {
    const next = params.get("next");
    router.replace(next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
    router.refresh();
  };

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
  }

  async function requestCode() {
    const r = await post("/api/admin/reset-code", { identifiant });
    if (!r.ok) {
      setError(r.data.error === "non_configure" ? "L'accès administrateur n'est pas configuré sur ce serveur." : ERR[r.data.error] ?? "Envoi du code impossible.");
      return false;
    }
    setDemoCode(r.data.demoCode ?? null);
    setSentAt(Date.now());
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "connexion") {
        const r = await post("/api/admin/login", { identifiant, password });
        if (r.ok) return goAdmin();
        if (r.data.error === "non_configure") setError("L'accès administrateur n'est pas encore configuré sur ce serveur (variables ADMIN_EMAIL, ADMIN_PASSWORD_HASH et ADMIN_SESSION_SECRET dans hPanel).");
        else if (r.data.error === "bloque") setError(`Trop de tentatives. Réessayez dans ${r.data.minutes} minute${r.data.minutes > 1 ? "s" : ""}.`);
        else setError(`Identifiant ou mot de passe incorrect.${typeof r.data.restants === "number" ? ` ${r.data.restants} essai${r.data.restants > 1 ? "s" : ""} restant${r.data.restants > 1 ? "s" : ""}.` : ""}`);
        setPassword("");
      } else if (mode === "oubli") {
        if (await requestCode()) {
          setCode("");
          setPassword("");
          setMode("nouveau");
        }
      } else {
        if (password !== password2) return setError("Les deux mots de passe sont différents.");
        const r = await post("/api/admin/reset", { identifiant, code, password });
        if (r.ok) return goAdmin();
        setError(ERR[r.data.error] ?? "Réinitialisation impossible.");
      }
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || (mode === "connexion" ? !identifiant || !password : mode === "oubli" ? !identifiant : code.length < 6 || password.length < 12 || !password2);

  return (
    <form className="card col" style={{ gap: 18, padding: 32, width: "100%", maxWidth: 440 }} onSubmit={submit}>
      <div className="row"><Logo size={36} /><span className="sp" /><span className="badge b-trial">Administration</span></div>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="h2" style={{ fontSize: 28 }}>{mode === "connexion" ? "Connexion administrateur" : mode === "oubli" ? "Mot de passe oublié" : "Nouveau mot de passe"}</h1>
        <p className="sm">
          {mode === "connexion"
            ? "Accès réservé à l'équipe Woly Elec."
            : mode === "oubli"
              ? "Saisissez votre identifiant administrateur : un code à 6 chiffres, valable 10 minutes, sera envoyé dans la boîte support@wolyelec.com."
              : "Si l'identifiant est correct, un code vient d'être envoyé dans la boîte support@wolyelec.com (pensez aux courriers indésirables)."}
        </p>
      </div>
      {error && <Callout tone="red" icon="lock" title="Accès refusé">{error}</Callout>}
      {demoCode && mode === "nouveau" && <Callout tone="info" title={`Code : ${demoCode}`}>Développement : l&apos;envoi d&apos;e-mails n&apos;est pas configuré.</Callout>}

      {mode !== "nouveau" && <TextField label="Identifiant" value={identifiant} onChange={setIdentifiant} autoComplete="username" placeholder="Votre pseudo administrateur" />}
      {mode === "nouveau" && (
        <>
          <CodeInput value={code} onChange={setCode} />
          <CodeTimer sentAt={sentAt} busy={busy} onResend={async () => { setError(null); setCode(""); await requestCode(); }} />
        </>
      )}
      {mode !== "oubli" && (
        <div className="field">
          <label htmlFor="admin-pw">{mode === "nouveau" ? "Nouveau mot de passe (12 caractères minimum)" : "Mot de passe"}</label>
          <div className="inp">
            <input id="admin-pw" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "nouveau" ? "new-password" : "current-password"} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ color: "var(--mut)", display: "flex" }}>
              <Icon name="eye" size="s" />
            </button>
          </div>
          {mode === "connexion" && (
            <button type="button" className="sm" style={{ color: "var(--blue)", fontWeight: 600, alignSelf: "flex-end" }} onClick={() => { setMode("oubli"); setError(null); }}>
              Mot de passe oublié ?
            </button>
          )}
        </div>
      )}
      {mode === "nouveau" && <TextField label="Confirmez le mot de passe" type="password" value={password2} onChange={setPassword2} autoComplete="new-password" />}

      <button type="submit" className="btn btn-blue btn-blk" disabled={disabled}>
        <Icon name="lock" size="s" /> {busy ? "Un instant…" : mode === "connexion" ? "Se connecter" : mode === "oubli" ? "Recevoir le code" : "Changer le mot de passe"}
      </button>
      {mode !== "connexion" ? (
        <button type="button" className="sm" style={{ color: "var(--blue)", fontWeight: 600 }} onClick={() => { setMode("connexion"); setError(null); setPassword(""); setPassword2(""); }}>
          Retour à la connexion
        </button>
      ) : (
        <p className="xs mut" style={{ textAlign: "center" }}>Session de 8 heures · 5 essais maximum par quart d&apos;heure</p>
      )}
    </form>
  );
}

export default function AdminLogin() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, background: "var(--g9)" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <BackButton fallback="/" label="Retour au site" dark />
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
