"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Callout, Gauge, NumField, Seg, Switch, TextField } from "@/components/ui";
import { Otp } from "@/components/site/Otp";
import { kwhForAmount, monthPlan, type MeterPhase } from "@/lib/engine";
import { days, fcfa, kwh, parseNum } from "@/lib/format";

type Usage = "Ménage" | "Commerce" | "Location";
type Objective = "mois" | "coupure" | "economiser";
const STEPS = ["Téléphone", "Code SMS", "Compteur", "Relevés", "Recharge", "Préférences", "Résultat"];

export default function Inscription() {
  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
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

  const bal = parseNum(c801), veille = parseNum(c813), mois = parseNum(c814), amt = parseNum(lastAmount), lk = parseNum(lastKwh);
  const today = useMemo(() => new Date(), []);
  const thisMonth = lastDate && lastDate.slice(0, 7) === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const bought = thisMonth ? (lk > 0 ? lk : amt > 0 ? kwhForAmount(amt, { boughtMonthKwh: 0, firstRechargeOfMonth: true, phase }).kwh : 0) : 0;
  // Nouveau client : la moyenne vient de la conso du mois (814) si possible, sinon de la veille (813)
  const avg = mois > 0 && today.getDate() > 1 ? mois / (today.getDate() - 1) : veille;
  const plan = bal >= 0 && avg > 0 ? monthPlan({ date: today, balanceKwh: bal, avgDaily: avg, boughtMonthKwh: bought, firstRechargeOfMonth: !thisMonth, phase, readingsCount: 1 }) : null;

  const canNext = [
    phone.replace(/\D/g, "").length === 9,
    code.length === 6,
    meter.replace(/\D/g, "").length >= 8,
    bal >= 0 && veille >= 0 && mois >= 0,
    true,
    consent,
    true,
  ][step];

  return (
    <div className="center col" style={{ gap: 18, maxWidth: 620 }}>
      <div className="pill-step" aria-label={`Étape ${step + 1} sur ${STEPS.length} : ${STEPS[step]}`}>{STEPS.map((s, i) => <i key={s} className={i <= step ? "on" : ""} />)}</div>
      <div className="card col" style={{ gap: 18, padding: 28 }}>
        <span className="eyebrow">Étape {step + 1} sur {STEPS.length} · {STEPS[step]}</span>

        {step === 0 && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Commencez vos 30 jours gratuits</h1>
            <p className="sm">Accès complet pour un compteur. Pas de carte bancaire, pas d&apos;engagement.</p>
            <TextField label="Numéro de téléphone" value={phone} onChange={setPhone} prefix="+221" placeholder="77 123 45 67" type="tel" autoComplete="tel-national" hint="Vous recevrez un code par SMS pour vous connecter." />
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="h2" style={{ fontSize: 30 }}>Entrez le code reçu</h1>
            <p className="sm">Code envoyé par SMS au +221 {phone}. (Démo : tapez 6 chiffres.)</p>
            <Otp value={code} onChange={setCode} />
          </>
        )}
        {step === 2 && (
          <>
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
          </>
        )}

        {step < 6 && (
          <div className="row" style={{ gap: 10 }}>
            {step > 0 && <button type="button" className="btn btn-line" onClick={() => setStep((s) => s - 1)}>Retour</button>}
            <button type="button" className="btn btn-blue" style={{ flex: 1 }} disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              {step === 0 ? "Recevoir mon code" : step === 4 ? (lastAmount ? "Continuer" : "Passer cette étape") : step === 5 ? "Voir mon estimation" : "Continuer"}
            </button>
          </div>
        )}
      </div>
      {step === 0 && <p className="sm" style={{ textAlign: "center" }}>Déjà inscrit ? <Link href="/connexion" style={{ fontWeight: 700 }}>Se connecter</Link></p>}
    </div>
  );
}
