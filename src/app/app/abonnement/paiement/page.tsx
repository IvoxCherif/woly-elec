"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Seg, TextField } from "@/components/ui";
import { useStore } from "@/lib/store";
import { ddmmyyyy, fcfa, isoDate } from "@/lib/format";
import { annualPrice, monthlyPrice, PACKS, PAYMENT_METHODS, type Cycle, type Pack, type PaymentMethod } from "@/lib/pricing";

export default function Paiement() {
  const { state, today, subscribe, notify } = useStore();
  const online = state.paymentMode === "saspay";
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pack, setPack] = useState<Pack>(state.subscription.pack);
  const [cycle, setCycle] = useState<Cycle>("annuel");
  const [meters, setMeters] = useState(Math.max(1, state.meters.length));
  const [method, setMethod] = useState<PaymentMethod>("Wave");
  const [phone, setPhone] = useState(state.user.phone.replace("+221 ", ""));
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<{ id: string; amount: number; until: string } | null>(null);

  const year = state.subscription.year;
  const p = PACKS[pack];
  const base = cycle === "mensuel" ? p.first : p.first * (year <= 1 ? 11 : 12);
  const extra = cycle === "mensuel" ? (meters - 1) * p.extra : (meters - 1) * p.extra * (year <= 1 ? 11 : 12);
  const total = cycle === "mensuel" ? monthlyPrice(pack, meters) : annualPrice(pack, meters, year);
  const renewal = cycle === "annuel" ? annualPrice(pack, meters, 2) : monthlyPrice(pack, meters);
  const phoneOk = phone.replace(/\D/g, "").length === 9;

  async function payOnline() {
    // Paiement réel : la page sécurisée SasPay propose Wave, Orange Money, Free Money ou la carte bancaire
    setPaying(true);
    setError(null);
    try {
      const r = await fetch("/api/paiement", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pack, cycle, meters }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && typeof j.url === "string") {
        window.location.href = j.url;
        return;
      }
      setError(j.error === "trop_de_requetes" ? "Trop de tentatives, réessayez dans un moment." : "Le paiement en ligne est momentanément indisponible. Réessayez plus tard ou écrivez à support@wolyelec.com.");
    } catch {
      setError("Connexion impossible. Vérifiez votre connexion internet.");
    }
    setPaying(false);
  }

  function pay() {
    if (online) return void payOnline();
    if (state.paymentMode === "off") return notify("Le paiement est momentanément indisponible");
    setPaying(true);
    // Démo : en production, redirection vers l'agrégateur (Wave / Orange Money / Free Money), puis webhook de confirmation.
    setTimeout(() => {
      setReceipt(subscribe(pack, cycle, meters, method));
      setPaying(false);
      setStep(3);
    }, 1200);
  }

  return (
    <>
      <div className="row wrapf">
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Paiement sur le site</span>
          <h2 className="h2" style={{ fontSize: 32 }}>Choisir, vérifier, payer</h2>
        </div>
        <span className="sp" />
        <span className="badge b-gr"><Icon name="lock" size="s" /> Paiement sécurisé · jamais dans l&apos;app mobile</span>
      </div>
      <div className="pill-step" aria-label={`Étape ${step} sur 3`}>{[1, 2, 3].map((i) => <i key={i} className={i <= step ? "on" : ""} />)}</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 24, alignItems: "stretch" }}>
        <section className="card col" style={{ gap: 16, padding: 26, opacity: step === 1 ? 1 : 0.65 }} aria-label="Étape 1">
          <div className="row"><span className="avatar" style={{ background: "var(--g9)", color: "var(--yel)" }}>1</span><b className="h3">Choisissez votre offre</b></div>
          {(["ia", "simple"] as Pack[]).map((k) => (
            <button key={k} type="button" className="radio" aria-pressed={pack === k} onClick={() => setPack(k)} disabled={step !== 1} style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <span className="row" style={{ width: "100%" }}><b className="h4">{PACKS[k].name}</b>{k === "ia" && <span className="badge b-ia">IA</span>}<span className="sp" /><span className="dot" style={{ background: pack === k ? "var(--blue)" : "#C9D6CF" }} /></span>
              <span className="sm">{PACKS[k].tagline}</span>
              <b className="mont ink">{cycle === "mensuel" ? `${fcfa(PACKS[k].first)}/mois` : `${fcfa(PACKS[k].first * 11)}/an · 1re année`}</b>
            </button>
          ))}
          <div className="field"><span className="lbl">Période</span><Seg<Cycle> label="Période" value={cycle} onChange={(v) => step === 1 && setCycle(v)} options={[{ value: "mensuel", label: "Mensuel" }, { value: "annuel", label: "Annuel · 1 mois offert" }]} /></div>
          <div className="field">
            <span className="lbl">Nombre de compteurs</span>
            <div className="row" style={{ gap: 14 }}>
              <button type="button" className="avatar" style={{ background: "#fff", border: "1.5px solid #C9D6CF" }} onClick={() => setMeters((m) => Math.max(1, m - 1))} disabled={step !== 1} aria-label="Un compteur de moins"><Icon name="minus" /></button>
              <span className="big" style={{ fontSize: 30 }}>{meters}</span>
              <button type="button" className="avatar" style={{ background: "#fff", border: "1.5px solid #C9D6CF" }} onClick={() => setMeters((m) => Math.min(50, m + 1))} disabled={step !== 1} aria-label="Un compteur de plus"><Icon name="plus" /></button>
              <span className="sm mut">{meters > 1 ? `+${fcfa(p.extra)}/mois par compteur supplémentaire` : "1 compteur inclus"}</span>
            </div>
          </div>
          <span className="sp" />
          <button type="button" className="btn btn-blue btn-blk" onClick={() => setStep(2)} disabled={step !== 1}>Continuer</button>
        </section>

        <section className="card col" style={{ gap: 16, padding: 26, opacity: step === 2 ? 1 : 0.65 }} aria-label="Étape 2">
          <div className="row"><span className="avatar" style={{ background: "var(--g9)", color: "var(--yel)" }}>2</span><b className="h3">Récapitulatif</b></div>
          <div className="col" style={{ gap: 0 }}>
            <Line label={`${p.name} · 1 compteur`} value={fcfa(base)} />
            {meters > 1 && <Line label={`${meters - 1} compteur${meters > 2 ? "s" : ""} supplémentaire${meters > 2 ? "s" : ""}`} value={fcfa(extra)} />}
            <Line label="Période" value={cycle === "mensuel" ? "1 mois" : "12 mois (11 payés)"} />
            <div className="row" style={{ padding: "14px 0" }}><b className="h4">Total à payer</b><span className="sp" /><b className="big" style={{ fontSize: 30 }}>{fcfa(total)}</b></div>
            <span className="xs mut">Renouvellement : {fcfa(renewal)}{cycle === "annuel" ? "/an à partir de la 2e année" : "/mois"}.</span>
          </div>
          {online ? (
            <div className="card flat col" style={{ gap: 6, background: "var(--bg)" }}>
              <span className="lab">Moyen de paiement</span>
              <span className="sm">Wave, Orange Money, Free Money ou carte bancaire : vous choisissez sur la page de paiement sécurisée SasPay.</span>
            </div>
          ) : (<>
          <span className="lab">Moyen de paiement</span>
          <div className="col" style={{ gap: 10 }} role="radiogroup" aria-label="Moyen de paiement">
            {PAYMENT_METHODS.map((m) => (
              <button key={m} type="button" role="radio" className="radio" aria-checked={method === m} onClick={() => setMethod(m)} disabled={step !== 2}>
                <b className="ink">{m}</b><span className="sp" />{method === m && <span className="dot" style={{ background: "var(--blue)" }} />}
              </button>
            ))}
          </div>
          <TextField label="Numéro de téléphone" value={phone} onChange={setPhone} prefix="+221" placeholder="77 123 45 67" autoComplete="tel-national" />
          </>)}
          {error && <p className="sm" role="alert" style={{ color: "var(--red)" }}>{error}</p>}
          <span className="sp" />
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="btn btn-line" onClick={() => setStep(1)} disabled={step !== 2}>Retour</button>
            <button type="button" className="btn btn-yel" style={{ flex: 1 }} onClick={pay} disabled={step !== 2 || (!online && !phoneOk) || paying}>
              {online ? (paying ? "Ouverture de la page de paiement…" : `Payer ${fcfa(total)}`) : paying ? "Confirmez sur votre téléphone…" : `Payer ${fcfa(total)} avec ${method}`}
            </button>
          </div>
        </section>

        <section className="card col" style={{ gap: 16, padding: 26, alignItems: "center", textAlign: "center", opacity: step === 3 ? 1 : 0.65 }} aria-label="Étape 3">
          <div className="row" style={{ alignSelf: "flex-start" }}><span className="avatar" style={{ background: "var(--g9)", color: "var(--yel)" }}>3</span><b className="h3">Confirmation</b></div>
          {receipt ? (
            <>
              <span className="avatar" style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--ok1)", color: "var(--ok)", marginTop: 10 }}><Icon name="check" size="l" /></span>
              <h2 className="h2" style={{ fontSize: 28 }}>Paiement reçu</h2>
              <p className="sm">Votre abonnement {p.name} est actif jusqu&apos;au {ddmmyyyy(receipt.until)}.</p>
              <div className="card flat col" style={{ gap: 0, width: "100%", textAlign: "left", background: "var(--bg)" }}>
                <span className="lab" style={{ marginBottom: 8 }}>Reçu n° {receipt.id}</span>
                <Line label="Montant" value={fcfa(receipt.amount)} />
                <Line label="Moyen" value={method} />
                <Line label="Date" value={ddmmyyyy(isoDate(today))} />
              </div>
              <span className="sp" />
              <button type="button" className="btn btn-line btn-blk" onClick={() => window.print()}><Icon name="download" size="s" /> Télécharger le reçu</button>
              <Link className="btn btn-blue btn-blk" href="/app">Retour au tableau de bord</Link>
            </>
          ) : (
            <p className="sm mut" style={{ marginTop: 20 }}>Votre reçu s&apos;affichera ici après la confirmation du paiement sur votre téléphone.</p>
          )}
        </section>
      </div>
    </>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="row sm" style={{ padding: "10px 0", borderBottom: "1px solid var(--ln)" }}>
      <span>{label}</span><span className="sp" /><b className="ink">{value}</b>
    </div>
  );
}
