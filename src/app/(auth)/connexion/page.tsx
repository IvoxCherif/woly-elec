"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Callout, TextField } from "@/components/ui";
import { Otp } from "@/components/site/Otp";

const ERR: Record<string, string> = {
  telephone_invalide: "Numéro invalide : 9 chiffres, par exemple 77 123 45 67.",
  trop_de_codes: "Trop de codes demandés pour ce numéro. Réessayez dans une heure.",
  sms_indisponible: "L'envoi de SMS est momentanément indisponible.",
  code_invalide: "Code incorrect ou expiré.",
};

export default function Connexion() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [live, setLive] = useState(true);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = phone.replace(/\D/g, "").length === 9;

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
  }

  async function sendCode() {
    setError(null);
    setBusy(true);
    const r = await post("/api/auth/otp", { phone }).catch(() => null);
    setBusy(false);
    if (!r || (r.status === 503 && r.data.error === "demo")) {
      setLive(false);
      return setSent(true);
    }
    if (!r.ok) return setError(ERR[r.data.error] ?? "Envoi du code impossible.");
    setDemoCode(r.data.demoCode ?? null);
    setSent(true);
  }

  async function verify() {
    if (!live) return router.push("/app");
    setError(null);
    setBusy(true);
    const r = await post("/api/auth/verify", { phone, code }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      setCode("");
      return setError(ERR[r?.data.error] ?? "Vérification impossible.");
    }
    // Numéro vérifié sans compte : on enchaîne sur l'inscription, sans redemander de code
    router.push(r.data.status === "connecte" ? "/app" : "/inscription?verifie=1");
  }

  return (
    <div className="center card col" style={{ gap: 18, padding: 28 }}>
      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">Connexion</span>
        <h1 className="h2" style={{ fontSize: 30 }}>{sent ? "Entrez le code reçu" : "Content de vous revoir"}</h1>
        <p className="sm">{sent ? `Un code à 6 chiffres a été envoyé par SMS au +221 ${phone}.` : "Pas de mot de passe : nous vous envoyons un code par SMS."}</p>
      </div>
      {error && <Callout tone="red" title="Oups">{error}</Callout>}
      {!sent ? (
        <>
          <TextField label="Numéro de téléphone" value={phone} onChange={setPhone} prefix="+221" placeholder="77 123 45 67" autoComplete="tel-national" type="tel" />
          <button type="button" className="btn btn-blue btn-blk" disabled={!ok || busy} onClick={sendCode}>Recevoir mon code</button>
        </>
      ) : (
        <>
          {demoCode && <Callout tone="info" title={`Code : ${demoCode}`}>L&apos;envoi de SMS n&apos;est pas encore branché : en phase pilote, le code s&apos;affiche ici.</Callout>}
          <Otp value={code} onChange={setCode} />
          <button type="button" className="btn btn-blue btn-blk" disabled={code.length < 6 || busy} onClick={verify}>Me connecter</button>
          <div className="row wrapf sm" style={{ justifyContent: "space-between" }}>
            <button type="button" style={{ color: "var(--blue)", fontWeight: 600 }} onClick={() => { setCode(""); void sendCode(); }}>Renvoyer le code</button>
            <button type="button" style={{ color: "var(--blue)", fontWeight: 600 }} onClick={() => { setSent(false); setCode(""); setError(null); }}>Changer de numéro</button>
          </div>
          {!live && <Callout tone="info" title="Version de démonstration">N&apos;importe quel code à 6 chiffres ouvre le compte de démonstration.</Callout>}
        </>
      )}
      <hr className="hr" />
      <p className="sm" style={{ textAlign: "center" }}>Pas encore de compte ? <Link href="/inscription" style={{ fontWeight: 700 }}>Commencer mes 30 jours gratuits</Link></p>
    </div>
  );
}
