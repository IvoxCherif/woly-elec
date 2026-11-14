"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Confidence, Gauge, NumField, Switch } from "@/components/ui";
import { monthPlan, reliability } from "@/lib/engine";
import { days, fcfa, kwh, parseNum } from "@/lib/format";

/**
 * Page ouverte par le lien personnel de chaque alerte (ex. woly-elec.sn/maj/k3F9?token=…).
 * En production : le jeton est signé et expirable, vérifié côté serveur avant d'afficher le formulaire.
 * Démo : un jeton contenant « exp » affiche l'état « lien expiré ».
 */
export default function MiseAJour({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const expired = token.toLowerCase().includes("exp");
  const [bal, setBal] = useState("");
  const [mois, setMois] = useState("");
  const [veille, setVeille] = useState("");
  const [recharged, setRecharged] = useState(false);
  const [done, setDone] = useState(false);
  const [resent, setResent] = useState(false);
  const today = useMemo(() => new Date(), []);

  const b = parseNum(bal), m = parseNum(mois), v = parseNum(veille);
  const valid = b >= 0 && m >= 0 && v > 0;
  // La tranche dépend des kWh ACHETÉS (historique des recharges côté serveur), pas du code 814.
  // Démo : achats du mois connus du compte = 114 kWh. La moyenne vient du 814 (sinon du 813).
  const avg = m > 0 && today.getDate() > 1 ? m / (today.getDate() - 1) : v;
  const plan = valid ? monthPlan({ date: today, balanceKwh: b, avgDaily: avg, boughtMonthKwh: 114, firstRechargeOfMonth: false, readingsCount: 15 }) : null;

  if (expired)
    return (
      <div className="center card col" style={{ gap: 16, padding: 32, alignItems: "center", textAlign: "center", maxWidth: 460 }}>
        <span className="avatar" style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--yel1)", color: "#8A6A00" }}><Icon name="clock" size="l" /></span>
        <h1 className="mont ink" style={{ fontWeight: 800, fontSize: 26 }}>Ce lien a expiré</h1>
        <p>Pour votre sécurité, les liens de mise à jour ne fonctionnent que quelques jours.</p>
        <button type="button" className="btn btn-blue btn-blk btn-lg" onClick={() => setResent(true)} disabled={resent}>{resent ? "Nouveau lien envoyé" : "Recevoir un nouveau lien"}</button>
        <p className="xs mut">Le lien est envoyé par WhatsApp au +221 77 ••• •• 67.</p>
      </div>
    );

  if (done && plan)
    return (
      <div className="center card col" style={{ gap: 14, padding: 28, maxWidth: 460 }}>
        <div className="row"><h1 className="mont ink" style={{ fontWeight: 800, fontSize: 24 }}>Votre montant exact</h1><span className="sp" /><span className="badge b-ok"><Icon name="check" size="s" /> Relevé enregistré</span></div>
        <div className="card" style={{ padding: "8px 0 2px", display: "flex", flexDirection: "column", alignItems: "center", background: "var(--bg)" }}>
          <Gauge fraction={plan.coversMonth ? 1 : plan.autonomy / Math.max(1, plan.daysLeft)} level={plan.level} value={kwh(b)} detail={`≈ ${days(plan.autonomy)}`} size={200} />
          <span className="xs mut" style={{ paddingBottom: 8 }}>{plan.coversMonth ? "Crédit suffisant jusqu'à la fin du mois" : `Crédit jusqu'au ${plan.depletionDate?.getDate()} · estimé`}</span>
        </div>
        <div className="mc" style={{ border: "2px solid var(--blue)" }}>
          <span className="k">Pour tenir jusqu&apos;à la fin du mois</span>
          <span className="v" style={{ fontSize: 32 }}>{plan.minAmount ? fcfa(plan.minAmount) : "0 F"}</span>
          <span className="xs mut">{plan.minAmount ? `Minimum · recommandé : ${fcfa(plan.recommendedAmount)} · frais inclus (estimation)` : "Rechargez le 1er pour repartir en tranche 1"}</span>
        </div>
        <Confidence {...reliability(15)} count={15} />
        <Link className="btn btn-blue btn-blk btn-lg" href="/app">Ouvrir mon tableau de bord</Link>
      </div>
    );

  return (
    <div className="center card col" style={{ gap: 14, padding: 28, maxWidth: 460 }}>
      <div className="row"><span className="badge b-gr"><Icon name="lock" size="s" /> Lien personnel</span></div>
      <div className="col" style={{ gap: 4 }}>
        <h1 className="mont ink" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.1 }}>Mettez à jour votre compteur</h1>
        <span className="sm"><b className="ink">Maison de Dakar</b> · 0145 6789 012</span>
      </div>
      <NumField label="Solde (code 801)" unit="kWh" value={bal} onChange={setBal} autoFocus />
      <NumField label="Consommation du mois (814)" unit="kWh" value={mois} onChange={setMois} />
      <NumField label="Consommation de la veille (813)" unit="kWh" value={veille} onChange={setVeille} />
      <div style={{ padding: "10px 0", borderTop: "1px solid var(--ln)" }}><Switch checked={recharged} onChange={setRecharged} label="Avez-vous rechargé ?" /></div>
      <button type="button" className="btn btn-blue btn-blk btn-lg" disabled={!valid} onClick={() => setDone(true)}>Voir mon montant exact</button>
    </div>
  );
}
