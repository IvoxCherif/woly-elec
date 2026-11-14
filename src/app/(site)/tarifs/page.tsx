"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Callout, Seg } from "@/components/ui";
import { annualPrice, monthlyPrice, PACKS, type Cycle } from "@/lib/pricing";
import { fcfa } from "@/lib/format";

const ROWS: [string, React.ReactNode, React.ReactNode][] = [
  ["Plan mensuel et montant exact à recharger", true, true],
  ["Alertes avant coupure (5, 3, 1 jour)", true, true],
  ["Simulateur, historique, lien de mise à jour", true, true],
  ["Relances de mise à jour", "2, fixes", "Réglables"],
  ["Assistant IA", false, <b key="q">30 requêtes par mois et par compteur</b>],
  ["Recharges expliquées en mots simples", false, true],
  ["Bilan mensuel commenté", false, true],
  ["Conseils personnalisés", false, true],
  ["Compteur supplémentaire", "+1 000 F/mois", "+1 499 F/mois"],
];

const cell = (v: React.ReactNode) => (v === true ? <span className="cok"><Icon name="check" /></span> : v === false ? <span className="mut">—</span> : v);

export default function Tarifs() {
  const [cycle, setCycle] = useState<Cycle>("annuel");
  const [n, setN] = useState(2);

  return (
    <>
      <section className="sec" style={{ paddingBottom: 40 }}>
        <div className="wrap col" style={{ gap: 28, alignItems: "center", textAlign: "center" }}>
          <div className="row" style={{ background: "var(--yel1)", borderRadius: 99, padding: "8px 18px", gap: 10, color: "#6B4E00", fontWeight: 600, fontSize: 15 }}><Icon name="star" size="s" /> 30 jours gratuits, sans engagement pour essayer</div>
          <h1 className="h1" style={{ maxWidth: 820 }}>Un SaaS peu cher, pour que votre électricité dure tout le mois</h1>
          <p className="lead" style={{ maxWidth: 640 }}>L&apos;essai donne un accès complet pour un compteur. Ensuite, choisissez l&apos;offre qui vous convient.</p>
          <Seg<Cycle> label="Période de facturation" style={{ width: 360, maxWidth: "100%" }} value={cycle} onChange={setCycle} options={[{ value: "mensuel", label: "Mensuel" }, { value: "annuel", label: "Annuel · 1 mois offert" }]} />
        </div>
      </section>

      <section style={{ paddingBottom: 72 }}>
        <div className="wrap g2" style={{ maxWidth: 960, alignItems: "stretch" }}>
          {(["simple", "ia"] as const).map((k) => (
            <div key={k} className="card col" style={{ gap: 16, padding: 28, border: k === "ia" ? "2px solid var(--blue)" : undefined }}>
              <div className="row wrapf"><b className="h3" style={{ fontSize: 24 }}>{PACKS[k].name}</b>{k === "ia" && <><span className="badge b-ia"><Icon name="sparkle" size="s" /> IA</span><span className="sp" /><span className="badge b-trial">Le plus complet</span></>}</div>
              <p className="sm">{k === "ia" ? "Pack IA" : "Pack simple"} · {PACKS[k].tagline}</p>
              <div className="col" style={{ gap: 2 }}>
                {cycle === "annuel" ? (
                  <>
                    <p><span className="big" style={{ fontSize: 48 }}>{fcfa(annualPrice(k, 1))}</span> <span className="mut">/an</span></p>
                    <p className="sm">1re année, soit 11 mois payés. Dès la 2e année : {fcfa(annualPrice(k, 1, 2))}/an.</p>
                    <p className="sm mut">Ou {fcfa(PACKS[k].first)}/mois.</p>
                  </>
                ) : (
                  <>
                    <p><span className="big" style={{ fontSize: 48 }}>{fcfa(PACKS[k].first)}</span> <span className="mut">/mois</span></p>
                    <p className="sm">Sans engagement, résiliable à tout moment.</p>
                    <p className="sm mut">Ou {fcfa(annualPrice(k, 1))}/an la 1re année.</p>
                  </>
                )}
              </div>
              <Link className="btn btn-yel btn-blk" href="/inscription">Commencer mes 30 jours gratuits</Link>
              <hr className="hr" />
              {(k === "ia"
                ? ["Tout Woly Elec 1", "Assistant IA : 30 requêtes par mois et par compteur", "Recharges expliquées en mots simples", "Bilan mensuel commenté, conseils personnalisés", "Nombre de relances réglable"]
                : ["1 compteur : plan mensuel et montant exact", "Alertes avant coupure", "Simulateur, historique, lien de mise à jour", "2 relances"]
              ).map((t) => (
                <div key={t} className="tick sm"><Icon name="check" size="s" /><span>{t}</span></div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="sec w">
        <div className="wrap col" style={{ gap: 32 }}>
          <div className="col" style={{ gap: 8, textAlign: "center", alignItems: "center" }}><span className="eyebrow">Comparatif</span><h2 className="h2">Pack simple ou pack IA ?</h2></div>
          <div className="scr">
            <table className="cmp" style={{ minWidth: 680 }}>
              <thead>
                <tr>
                  <th style={{ width: "44%" }}><span className="sr" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Fonction</span></th>
                  <th className="c">Woly Elec 1<div className="sm mut" style={{ fontWeight: 500, fontFamily: "Inter" }}>L&apos;outil calcule et alerte</div></th>
                  <th className="c hi" style={{ color: "var(--blue)" }}>Woly Elec IA<div className="sm" style={{ fontWeight: 500, fontFamily: "Inter" }}>L&apos;outil calcule, alerte et explique</div></th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, a, b]) => (
                  <tr key={label}><td>{label}</td><td className="c">{cell(a)}</td><td className="c hi">{cell(b)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="wrap g2" style={{ alignItems: "start" }}>
          <div className="card col" style={{ gap: 18 }}>
            <span className="lab">Calculateur de compteurs</span>
            <div className="row" style={{ gap: 16 }}>
              <span className="h4">Nombre de compteurs</span><span className="sp" />
              <button type="button" className="avatar" style={{ background: "#fff", border: "1.5px solid #C9D6CF" }} onClick={() => setN((x) => Math.max(1, x - 1))} aria-label="Un compteur de moins"><Icon name="minus" /></button>
              <span className="big" style={{ fontSize: 32, minWidth: 40, textAlign: "center" }} aria-live="polite">{n}</span>
              <button type="button" className="avatar" style={{ background: "#fff", border: "1.5px solid #C9D6CF" }} onClick={() => setN((x) => Math.min(50, x + 1))} aria-label="Un compteur de plus"><Icon name="plus" /></button>
            </div>
            <hr className="hr" />
            {(["simple", "ia"] as const).map((k) => (
              <div key={k} className="row sm wrapf"><span>{PACKS[k].name} · {n} compteur{n > 1 ? "s" : ""}</span><span className="sp" /><b className="ink" style={{ fontSize: 18 }}>{cycle === "mensuel" ? `${fcfa(monthlyPrice(k, n))}/mois` : `${fcfa(annualPrice(k, n))}/an (1re année)`}</b></div>
            ))}
            <p className="xs mut">Le quota IA est de 30 requêtes par mois pour chaque compteur, non partagé entre compteurs.</p>
          </div>
          <div className="card col" style={{ gap: 14 }}>
            <span className="lab">Moyens de paiement</span>
            <div className="row wrapf" style={{ gap: 12 }}>{["Wave", "Orange Money", "Free Money"].map((m) => <span key={m} className="chip" style={{ minHeight: 52, fontSize: 16 }}>{m}</span>)}</div>
            <p className="sm">Le paiement se fait sur le site, jamais dans l&apos;application mobile. Vous recevez un reçu après chaque paiement.</p>
            <Callout tone="info" title="Essai gratuit">30 jours, un compteur, accès complet. Ensuite, un abonnement est nécessaire pour continuer à recevoir vos alertes.</Callout>
          </div>
        </div>
      </section>

      <section className="sec g" style={{ textAlign: "center" }}>
        <div className="wrap col" style={{ alignItems: "center", gap: 20 }}>
          <h2 className="h2" style={{ color: "#fff" }}>Essayez 30 jours, sans engagement.</h2>
          <Link className="btn btn-yel btn-lg" href="/inscription">Commencer mes 30 jours gratuits</Link>
        </div>
      </section>
    </>
  );
}
