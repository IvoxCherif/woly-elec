"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon } from "@/components/Icon";
import { Callout, Logo, TextField } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (r.ok) {
        const next = params.get("next");
        router.replace(next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin");
        router.refresh();
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (j.error === "non_configure") setError("L'accès administrateur n'est pas encore configuré sur ce serveur (variables ADMIN_EMAIL, ADMIN_PASSWORD_HASH et ADMIN_SESSION_SECRET).");
      else if (j.error === "bloque") setError(`Trop de tentatives. Réessayez dans ${j.minutes} minute${j.minutes > 1 ? "s" : ""}.`);
      else setError(`E-mail ou mot de passe incorrect.${typeof j.restants === "number" ? ` ${j.restants} essai${j.restants > 1 ? "s" : ""} restant${j.restants > 1 ? "s" : ""}.` : ""}`);
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau.");
    }
    setPassword("");
    setBusy(false);
  }

  return (
    <form className="card col" style={{ gap: 18, padding: 32, width: "100%", maxWidth: 440 }} onSubmit={submit}>
      <div className="row"><Logo size={36} /><span className="sp" /><span className="badge b-trial">Administration</span></div>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="h2" style={{ fontSize: 28 }}>Connexion administrateur</h1>
        <p className="sm">Accès réservé à l&apos;équipe Woly Elec.</p>
      </div>
      {error && <Callout tone="red" icon="lock" title="Accès refusé">{error}</Callout>}
      <TextField label="E-mail" type="email" value={email} onChange={setEmail} autoComplete="username" />
      <div className="field">
        <label htmlFor="admin-pw">Mot de passe</label>
        <div className="inp">
          <input id="admin-pw" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} style={{ color: "var(--mut)", display: "flex" }}>
            <Icon name="eye" size="s" />
          </button>
        </div>
      </div>
      <button type="submit" className="btn btn-blue btn-blk" disabled={busy || !email || !password}>
        <Icon name="lock" size="s" /> {busy ? "Vérification…" : "Se connecter"}
      </button>
      <p className="xs mut" style={{ textAlign: "center" }}>Session de 8 heures · 5 essais maximum par quart d&apos;heure</p>
    </form>
  );
}

export default function AdminLogin() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--g9)" }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
