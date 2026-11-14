"use client";

import { useState } from "react";
import { Callout, TextField } from "../ui";
import { Icon } from "../Icon";

const CATEGORIES = [
  { value: "question", label: "Question" },
  { value: "reclamation", label: "Réclamation" },
  { value: "technique", label: "Problème technique" },
  { value: "paiement", label: "Paiement / abonnement" },
  { value: "compte", label: "Mon compte" },
];

const ERR: Record<string, string> = {
  email_invalide: "Adresse e-mail invalide.",
  demande_incomplete: "Indiquez un sujet (3 caractères minimum) et un message (10 caractères minimum).",
  trop_de_demandes: "Vous avez envoyé plusieurs demandes récemment. Réessayez dans une heure, ou écrivez directement à support@wolyelec.com.",
};

/** Formulaire support / réclamations : enregistré en base et envoyé à support@wolyelec.com. */
export function SupportForm({ connected, defaultEmail = "", defaultName = "" }: { connected?: boolean; defaultEmail?: string; defaultName?: string }) {
  const [nom, setNom] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [categorie, setCategorie] = useState("question");
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nom, email, categorie, sujet, message }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setDone(j.reference);
        setSujet("");
        setMessage("");
      } else if (r.status === 503) {
        // Serveur sans base (démonstration) : on ouvre la messagerie
        window.location.href = `mailto:support@wolyelec.com?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(message)}`;
      } else setError(ERR[j.error] ?? "Envoi impossible. Écrivez directement à support@wolyelec.com.");
    } catch {
      setError("Envoi impossible. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <Callout tone="ok" icon="check" title={`Demande ${done} envoyée`}>
        Un e-mail de confirmation vient de vous être envoyé. Notre équipe vous répond par e-mail en quelques heures (du lundi au samedi).{" "}
        <button type="button" style={{ color: "inherit", textDecoration: "underline", fontWeight: 700 }} onClick={() => setDone(null)}>Nouvelle demande</button>
      </Callout>
    );

  return (
    <form className="col" style={{ gap: 14 }} onSubmit={submit}>
      {error && <Callout tone="red" title="Oups">{error}</Callout>}
      <div className="field">
        <span className="lbl">Type de demande</span>
        <div className="chips" role="group" aria-label="Type de demande">
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" className="chip" aria-pressed={categorie === c.value} onClick={() => setCategorie(c.value)}>{c.label}</button>
          ))}
        </div>
      </div>
      {!connected && (
        <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
          <TextField label="Votre nom" value={nom} onChange={setNom} autoComplete="name" />
          <TextField label="Votre e-mail (pour la réponse)" type="email" value={email} onChange={setEmail} autoComplete="email" />
        </div>
      )}
      <TextField label="Sujet" value={sujet} onChange={setSujet} placeholder={categorie === "reclamation" ? "Ex. : montant conseillé incorrect" : "Ex. : comment lire le code 801 ?"} />
      <label className="field">
        <span className="lbl">Message</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          placeholder="Décrivez votre demande : compteur concerné, date, montant…"
          style={{ border: "1.5px solid #C9D6CF", borderRadius: 12, padding: 14, font: "500 15px Inter", color: "var(--g9)", resize: "vertical" }}
        />
      </label>
      <button type="submit" className="btn btn-blue" style={{ alignSelf: "flex-start" }} disabled={busy || sujet.trim().length < 3 || message.trim().length < 10 || (!connected && !email)}>
        <Icon name="send" size="s" /> {busy ? "Envoi…" : "Envoyer ma demande"}
      </button>
      <span className="xs mut">Votre demande est transmise à support@wolyelec.com. Vous recevez une copie avec un numéro de suivi.</span>
    </form>
  );
}
