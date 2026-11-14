"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Callout, TextField } from "@/components/ui";
import { Otp } from "@/components/site/Otp";

export default function Connexion() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const ok = phone.replace(/\D/g, "").length === 9;

  return (
    <div className="center card col" style={{ gap: 18, padding: 28 }}>
      <div className="col" style={{ gap: 6 }}>
        <span className="eyebrow">Connexion</span>
        <h1 className="h2" style={{ fontSize: 30 }}>{sent ? "Entrez le code reçu" : "Content de vous revoir"}</h1>
        <p className="sm">{sent ? `Un code à 6 chiffres a été envoyé par SMS au +221 ${phone}.` : "Pas de mot de passe : nous vous envoyons un code par SMS."}</p>
      </div>
      {!sent ? (
        <>
          <TextField label="Numéro de téléphone" value={phone} onChange={setPhone} prefix="+221" placeholder="77 123 45 67" autoComplete="tel-national" type="tel" />
          <button type="button" className="btn btn-blue btn-blk" disabled={!ok} onClick={() => setSent(true)}>Recevoir mon code</button>
        </>
      ) : (
        <>
          <Otp value={code} onChange={setCode} />
          <button type="button" className="btn btn-blue btn-blk" disabled={code.length < 6} onClick={() => router.push("/app")}>Me connecter</button>
          <div className="row wrapf sm" style={{ justifyContent: "space-between" }}>
            <button type="button" style={{ color: "var(--blue)", fontWeight: 600 }} onClick={() => setCode("")}>Renvoyer le code</button>
            <button type="button" style={{ color: "var(--blue)", fontWeight: 600 }} onClick={() => { setSent(false); setCode(""); }}>Changer de numéro</button>
          </div>
          <Callout tone="info" title="Version de démonstration">N&apos;importe quel code à 6 chiffres ouvre le compte de démonstration.</Callout>
        </>
      )}
      <hr className="hr" />
      <p className="sm" style={{ textAlign: "center" }}>Pas encore de compte ? <Link href="/inscription" style={{ fontWeight: 700 }}>Commencer mes 30 jours gratuits</Link></p>
    </div>
  );
}
