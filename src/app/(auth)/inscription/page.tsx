"use client";

import Link from "next/link";
import { track } from "@/lib/pixel";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Callout, Gauge, NumField, Seg, Switch, TextField } from "@/components/ui";
import { GoogleButton, OrSeparator } from "@/components/site/GoogleButton";
import { CodeInput, CodeTimer } from "@/components/site/CodeInput";
import { kwhForAmount, monthPlan, type MeterPhase } from "@/lib/engine";
import { days, fcfa, kwh, parseNum } from "@/lib/format";

type Usage = "Ménage" | "Commerce" | "Location";
type Objective = "mois" | "coupure" | "economiser";
const STEPS = ["Compte", "Vérification", "Compteur", "Relevés", "Recharge", "Préférences", "Résultat"];

const GOOGLE_ERR: Record<string, string> = {
  google_indisponible: "La connexion avec Google n'est pas encore activée. Utilisez votre e-mail.",
  google_annule: "Connexion avec Google annulée.",
  google_session: "La connexion avec Google a expiré : recommencez.",
  google_refuse: "Google n'a pas pu confirmer votre compte.",
};

export default function Inscription() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [meter, setMeter] = useState("");
  const [meterName, setMeterName] = useState("Maison");
  const [usage, setUsage] = useState<Usage>("Ménage");
  const [phase, setPhase] = useState<MeterPhase>("mono");
  const [c801, set801] = useState("");
  const [c813, set813] = useState("");
  const [c814, set814] = useState("");
  const [lastAmount, setLastAmount] = useState("");
  const [lastKwh, setLastKwh] = useState("");
  const [lastDate, setLastDate] = useState("");
  const [rechargeDay, setRechargeDay] = useState(1);
  const [objective, setObjective] = useState<Objective>("mois");
  const [whatsapp, setWhatsapp] = useState(true);
  const [consent, setConsent] = useState(false);
  const router = useRouter();
  // Compte réel si le serveur a une base de données ; sinon parcours de démonstration
  const [live, setLive] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Retour de Google (nouveau compte) ou erreur de connexion Google
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const err = q.get("erreur");
    if (err) setError(GOOGLE_ERR[err] ?? "La connexion avec Google a échoué.");
    if (q.get("google") === "1") {
      fetch("/api/auth/pending")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j?.email) return setError("Votre connexion Google a expiré : recommencez.");
          setGoogleEmail(j.email);
          setName(j.name ?? "");
          setLive(true);
          setStep(2); // Google a déjà vérifié l'adresse
        })
        .catch(() => undefined);
    }
  }, []);

  const bal = parseNum(c801), veille = parseNum(c813), mois = parseNum(c814), amt = parseNum(lastAmount), lk = parseNum(lastKwh);
  const today = useMemo(() => new Date(), []);
  const thisMonth = lastDate && lastDate.slice(0, 7) === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const bought = thisMonth ? (lk > 0 ? lk : amt > 0 ? kwhForAmount(amt, { boughtMonthKwh: 0, firstRechargeOfMonth: true, phase }).kwh : 0) : 0;
  // Nouveau client : la moyenne vient de la conso du mois (814) si possible, sinon de la veille (813)
  const avg = mois > 0 && today.getDate() > 1 ? mois / (today.getDate() - 1) : veille;
  const plan = bal >= 0 && avg > 0 ? monthPlan({ date: today, balanceKwh: bal, avgDaily: avg, boughtMonthKwh: bought, firstRechargeOfMonth: !thisMonth, phase, readingsCount: 1 }) : null;

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canNext = [
    emailOk && password.length >= 8 && password === password2,
    code.length === 6 || live === false,
    meter.replace(/\D/g, "").length >= 8,
    bal >= 0 && veille >= 0 && mois >= 0,
    true,
    consent,
    true,
  ][step];

  const ERR: Record<string, string> = {
    email_invalide: "Adresse e-mail invalide.",
    email_pris: "Cette adresse a déjà un compte : connectez-vous.",
    code_invalide: "Code incorrect ou expiré. Vérifiez le dernier e-mail reçu.",
    trop_de_codes: "Trop de codes demandés. Réessayez dans une heure.",
    email_indisponible: "L'envoi d'e-mails est momentanément indisponible. Réessayez plus tard ou écrivez à support@wolyelec.com.",
    email_non_verifie: "Votre adresse n'est pas encore confirmée : recommencez la vérification.",
    mot_de_passe_court: "Le mot de passe doit faire au moins 8 caractères.",
    deja_inscrit: "Cette adresse a déjà un compte : connectez-vous.",
    compteur_invalide: "Numéro de compteur invalide.",
    compteur_deja_utilise: "Ce compteur est déjà enregistré sur Woly Elec. Vérifiez le numéro ou écrivez à support@wolyelec.com s'il s'agit du vôtre.",
    consentement_requis: "Votre accord est nécessaire pour calculer vos prévisions.",
    trop_de_comptes: "Trop de comptes créés depuis cette connexion. Réessayez plus tard.",
  };

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
  }

  async function sendCode() {
    setBusy(true);
    const r = await post("/api/auth/email-code", { email, usage: "verification" }).catch(() => null);
    setBusy(false);
    if (!r || (r.status === 503 && r.data.error === "demo")) {
      setLive(false); // pas de base : parcours de démonstration
      return true;
    }
    if (!r.ok) {
      setError(ERR[r.data.error] ?? "Envoi du code impossible.");
      return false;
    }
    setLive(true);
    setDemoCode(r.data.demoCode ?? null);
    setSentAt(Date.now());
    return true;
  }

  async function next() {
    setError(null);
    if (step === 0) {
      setCode("");
      if (await sendCode()) setStep(1);
      return;
    }
    if (step === 1 && live) {
      setBusy(true);
      const r = await post("/api/auth/email-verify", { email, code }).catch(() => null);
      setBusy(false);
      if (!r?.ok) {
        setCode("");
        return setError(ERR[r?.data.error] ?? "Vérification impossible.");
      }
      return setStep(2);
    }
    if (step === 2 && live) {
      setBusy(true);
      const r = await post("/api/auth/check-meter", { numero: meter }).catch(() => null);
      setBusy(false);
      if (r?.ok && r.data.disponible === false) return setError(ERR.compteur_deja_utilise);
      if (r && !r.ok && r.data.error === "compteur_invalide") return setError(ERR.compteur_invalide);
    }
    if (step === 5 && live) {
      setBusy(true);
      const r = await post("/api/auth/signup", {
        name,
        account: googleEmail ? undefined : { email, password },
        meter: { number: meter, name: meterName, usage, phase },
        reading: { balanceKwh: bal, monthKwh: mois, yesterdayKwh: veille },
        lastRecharge: lastDate && amt > 0 ? { date: lastDate, amount: amt, kwh: lk > 0 ? lk : undefined } : undefined,
        prefs: { rechargeDay, objective, whatsapp, consent },
      }).catch(() => null);
      setBusy(false);
      if (!r?.ok) return setError(ERR[r?.data.error] ?? "Création du compte impossible.");
      track("CompleteRegistration", { content_name: "Essai gratuit 30 jours", status: true });
      track("StartTrial", { value: 0, currency: "XOF", predicted_ltv: 1999 * 12 });
      return setStep(6);
    }
    setStep((x) => x + 1);
  }

  return (
    <div className="center col" style={{ gap: 18, maxWidth: 620 }}>
      <div className="pill-step" aria-label={`Étape ${step + 1} sur ${STEPS.length} : ${STEPS[step]}`}>{STEPS.map((s, i) => <i key={s} className={i <= step ? "on" : ""} />)}</div>
      <div className="card col" style={{ gap: 18, padding: 28 }}>
        <span className="eyebrow">Étape {step + 1} sur {STEPS.length} · {STEPS[step]}</span>
        {error && <Callout tone="red" title="Oups">{error}{error.includes("connectez-vous") && <> <Link href="/connexion">Se connecter</Link> · <Link href="/connexion?oubli=1">Mot de passe oublié ?</Link></>}</Callout>}

        {step === 0 && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Créer mon compte</h1>
            <p className="sm">30 jours gratuits, accès complet pour un compteur. Pas de carte bancaire, pas d&apos;engagement.</p>
            <GoogleButton mode="inscription" />
            <OrSeparator />
            <TextField label="Votre nom" value={name} onChange={setName} autoComplete="name" placeholder="Awa Diallo" />
            <TextField label="Adresse e-mail" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="vous@exemple.com" />
            <TextField label="Mot de passe" type="password" value={password} onChange={setPassword} autoComplete="new-password" hint="8 caractères minimum." />
            <TextField label="Confirmez le mot de passe" type="password" value={password2} onChange={setPassword2} autoComplete="new-password" />
            {password2 && password !== password2 && <span className="hint e">Les deux mots de passe sont différents.</span>}
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Vérifiez votre e-mail</h1>
            <p className="sm">
              {live === false ? "Démonstration : tapez 6 chiffres." : <>Nous avons envoyé un code à 6 chiffres à <b className="ink">{email.trim().toLowerCase()}</b>, depuis wolyelec@wolyelec.com. Il est valable 10 minutes. Pensez à regarder dans les courriers indésirables.</>}
            </p>
            {demoCode && <Callout tone="info" title={`Code : ${demoCode}`}>Développement : l&apos;envoi d&apos;e-mails n&apos;est pas configuré, le code s&apos;affiche ici.</Callout>}
            <CodeInput value={code} onChange={setCode} />
            {live && <CodeTimer sentAt={sentAt} busy={busy} onResend={async () => { setError(null); setCode(""); await sendCode(); }} />}
          </>
        )}
        {step === 2 && (
          <>
            {googleEmail && <Callout tone="ok" icon="check" title="Compte Google vérifié">{googleEmail}</Callout>}
            <h1 className="h2" style={{ fontSize: 30 }}>Ajoutez votre compteur</h1>
            <TextField label="Numéro de compteur Woyofal" value={meter} onChange={setMeter} placeholder="0145 6789 012" hint="Inscrit sur la face avant du compteur ou sur votre ticket de recharge." />
            <TextField label="Nom du compteur" value={meterName} onChange={setMeterName} placeholder="Maison de Dakar" />
            <div className="field"><span className="lbl">Type d&apos;usage</span><div className="chips">{(["Ménage", "Commerce", "Location"] as Usage[]).map((u) => <button key={u} type="button" className="chip" aria-pressed={usage === u} onClick={() => setUsage(u)}>{u}</button>)}</div></div>
            <div className="field"><span className="lbl">Type de compteur</span><Seg<MeterPhase> label="Type de compteur" value={phase} onChange={setPhase} options={[{ value: "mono", label: "Monophasé (le plus courant)" }, { value: "tri", label: "Triphasé" }]} /></div>
          </>
        )}
        {step === 3 && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Saisissez 3 chiffres</h1>
            <p className="sm">Sur le clavier du compteur, tapez chaque code puis recopiez la valeur affichée.</p>
            <NumField label="Crédit restant · code 801" unit="kWh" value={c801} onChange={set801} autoFocus hint="Lisez la valeur affichée sur le compteur." />
            <NumField label="Consommation du mois · code 814" unit="kWh" value={c814} onChange={set814} />
            <NumField label="Consommation de la veille · code 813" unit="kWh" value={c813} onChange={set813} />
            <div className="row sm mut" style={{ gap: 8 }}><Icon name="camera" size="s" /> Bientôt : prenez une photo du compteur, les chiffres seront lus automatiquement.</div>
          </>
        )}
        {step === 4 && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Votre dernière recharge</h1>
            <p className="sm">Elle permet de savoir combien de kWh vous avez déjà achetés ce mois-ci, donc votre tranche. Facultatif.</p>
            <div className="field"><label htmlFor="ld">Date</label><div className="inp"><input id="ld" type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} /></div></div>
            <NumField label="Montant" unit="F" value={lastAmount} onChange={setLastAmount} big={false} />
            <NumField label="kWh reçus (sur le ticket)" unit="kWh" value={lastKwh} onChange={setLastKwh} big={false} hint={amt > 0 && !lk ? `Estimé : ≈ ${kwh(kwhForAmount(amt, { boughtMonthKwh: 0, firstRechargeOfMonth: true, phase }).kwh)}` : undefined} />
          </>
        )}
        {step === 5 && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Vos préférences</h1>
            <div className="field"><span className="lbl">Jour de recharge préféré</span><div className="chips">{[1, 5, 10, 15, 20, 25].map((d) => <button key={d} type="button" className="chip" aria-pressed={rechargeDay === d} onClick={() => setRechargeDay(d)}>{d === 1 ? "1er" : d}</button>)}</div></div>
            <div className="field"><span className="lbl">Votre objectif</span><Seg<Objective> label="Objectif" value={objective} onChange={setObjective} options={[{ value: "mois", label: "Tenir tout le mois" }, { value: "coupure", label: "Éviter la coupure" }, { value: "economiser", label: "Économiser" }]} /></div>
            <Switch checked={whatsapp} onChange={setWhatsapp} label="Recevoir mes alertes sur WhatsApp" />
            <Switch checked={consent} onChange={setConsent} label="J'accepte l'utilisation de mes relevés pour mes prévisions" />
            <p className="xs mut">En continuant, vous acceptez les <Link href="/conditions">conditions d&apos;utilisation</Link> et la <Link href="/confidentialite">politique de confidentialité</Link>. Woly Elec n&apos;est pas affilié à la Senelec.</p>
          </>
        )}
        {step === 6 && plan && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Votre première estimation</h1>
            <div className="row wrapf" style={{ gap: 24, justifyContent: "center" }}>
              <Gauge fraction={plan.coversMonth ? 1 : plan.autonomy / Math.max(1, plan.daysLeft)} level={plan.level} value={kwh(bal)} detail={`≈ ${days(plan.autonomy)}`} size={220} />
              <div className="col" style={{ gap: 10, flex: "1 1 200px" }}>
                <div className="mc"><span className="k">Pour tenir jusqu&apos;à la fin du mois</span><span className="v">{plan.minAmount ? fcfa(plan.minAmount) : "0 F"}</span><span className="xs mut">{plan.minAmount ? `Recommandé : ${fcfa(plan.recommendedAmount)} · marge nouveau client 20 %` : "Votre crédit couvre le mois"}</span></div>
                <div className="mc"><span className="k">Tranche actuelle</span><span className="v">{bought >= 150 ? "Tranche 2" : "Tranche 1"}</span><span className="xs mut">{kwh(bought, 0)} achetés ce mois-ci</span></div>
              </div>
            </div>
            <Callout tone="info" title="Une estimation de départ">Fiabilité faible avec un seul relevé : faites un relevé par jour pendant deux semaines pour atteindre 85 à 95 %.</Callout>
            <Link className="btn btn-blue btn-blk btn-lg" href="/app">Ouvrir mon tableau de bord</Link>
            {live === false && <p className="xs mut" style={{ textAlign: "center" }}>Démonstration : aucun compte n&apos;a été créé.</p>}
          </>
        )}

        {step < 6 && (
          <div className="row" style={{ gap: 10 }}>
            {step > 0 && !(step === 2 && googleEmail) && <button type="button" className="btn btn-line" onClick={() => { setError(null); setStep((s) => s - 1); }}>Retour</button>}
            <button type="button" className="btn btn-blue" style={{ flex: 1 }} disabled={!canNext || busy} onClick={next}>
              {step === 0 ? "Continuer avec mon e-mail" : step === 1 ? "Vérifier mon e-mail" : step === 4 ? (lastAmount ? "Continuer" : "Passer cette étape") : step === 5 ? "Voir mon estimation" : "Continuer"}
            </button>
          </div>
        )}
      </div>
      {step === 0 && <p className="sm" style={{ textAlign: "center" }}>Déjà inscrit ? <Link href="/connexion" style={{ fontWeight: 700 }}>Se connecter</Link></p>}
    </div>
  );
}
