"use client";

import { useEffect, useState } from "react";
import { Callout } from "@/components/ui";
import { DEFAULT_TARIFF, kwhForAmount, tariffFromJson, tariffToJson, type TariffConfig, type TariffJson } from "@/lib/engine";
import { adminPost, SourceBadge, useAdmin } from "../useAdmin";

type TarifRow = { id: number; version: string; config: TariffJson; active: boolean; createdAt: string };
const fr = (n: number, d = 2) => num(n, d).replace(/ /g, " ");
import { annualPrice, monthlyPrice, PACKS } from "@/lib/pricing";
import { fcfa, kwh, num, parseNum } from "@/lib/format";

export default function AdminTarifs() {
  const [t1, setT1] = useState("82");
  const [t2, setT2] = useState("136,49");
  const [t3, setT3] = useState(num(DEFAULT_TARIFF.tiers[2].price, 2));
  const [tax, setTax] = useState("2,5");
  const [mono, setMono] = useState("429");
  const [tri, setTri] = useState("1427");
  const [version, setVersion] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { data, live, reload } = useAdmin<TarifRow[]>("tariffs");
  const active = data?.find((r) => r.active);

  // Pré-remplit le formulaire avec la version active en base
  useEffect(() => {
    if (!active) return;
    const c = tariffFromJson(active.config);
    setT1(fr(c.tiers[0]?.price ?? 0));
    setT2(fr(c.tiers[1]?.price ?? 0));
    setT3(fr(c.tiers[2]?.price ?? 0));
    setTax(fr(c.communalTax * 100, 2));
    setMono(String(c.redevance.mono));
    setTri(String(c.redevance.tri));
  }, [active]);

  async function publish() {
    setMsg(null);
    if (!live) return setMsg({ ok: false, text: "Base de données non configurée : la publication est impossible sur ce serveur." });
    const r = await adminPost({ type: "tarif", config: tariffToJson(cfg), version: version || `Version du ${new Date().toLocaleDateString("fr-FR")}` });
    if (r.ok) {
      setMsg({ ok: true, text: "Nouvelle version publiée : elle s'applique dès maintenant à toutes les prévisions." });
      setVersion("");
      void reload();
    } else setMsg({ ok: false, text: r.error === "tarif_invalide" ? "Valeurs invalides : vérifiez les prix et la taxe." : "Publication impossible." });
  }

  const cfg: TariffConfig = {
    ...DEFAULT_TARIFF,
    tiers: [{ limit: 150, price: parseNum(t1) || 0 }, { limit: 250, price: parseNum(t2) || 0 }, { limit: Infinity, price: parseNum(t3) || 0 }],
    communalTax: (parseNum(tax) || 0) / 100,
    redevance: { mono: parseNum(mono) || 0, tri: parseNum(tri) || 0 },
  };
  const ex1 = kwhForAmount(10000, { boughtMonthKwh: 0, firstRechargeOfMonth: true }, cfg).kwh;
  const ex2 = kwhForAmount(10000, { boughtMonthKwh: 150, firstRechargeOfMonth: false }, cfg).kwh;


  return (
    <>
      <div className="row wrapf" style={{ gap: 12 }}>
        <span className="badge b-gr">Version active : {active?.version ?? "Décision CRSE 2025-140 (01/01/2026)"}</span>
        <SourceBadge live={live} />
        <span className="sp" />
        <label className="inp" style={{ minHeight: 44, width: 260 }}><input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Nom de la version (facultatif)" aria-label="Nom de la nouvelle version" style={{ fontSize: 14 }} /></label>
        <button type="button" className="btn btn-blue btn-sm" onClick={publish}>Publier une nouvelle version</button>
      </div>
      {msg && <Callout tone={msg.ok ? "ok" : "red"} title={msg.ok ? "Publié" : "Erreur"}>{msg.text}</Callout>}
      <Callout tone="info" title="Aucun tarif en dur dans le code">Le moteur de calcul lit cette table. Une modification s&apos;applique aux prévisions dès la publication. Les valeurs « à confirmer » doivent être calibrées sur de vrais tickets de recharge.</Callout>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Tranches · domestique petite puissance (DPP)</b></div>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 640 }}>
            <thead><tr><th>Tranche</th><th className="n">De (kWh achetés)</th><th className="n">À</th><th className="n">Prix du kWh</th><th>Statut</th></tr></thead>
            <tbody>
              <tr><td><b>Tranche 1</b></td><td className="n">0</td><td className="n">150</td><td className="n"><Inp v={t1} set={setT1} label="Prix tranche 1" unit="F" /></td><td><span className="badge b-ok">Confirmé</span></td></tr>
              <tr><td><b>Tranche 2</b></td><td className="n">151</td><td className="n">250</td><td className="n"><Inp v={t2} set={setT2} label="Prix tranche 2" unit="F" /></td><td><span className="badge b-ok">Confirmé</span></td></tr>
              <tr><td><b>Au-delà</b></td><td className="n">251</td><td className="n">Sans limite</td><td className="n"><Inp v={t3} set={setT3} label="Prix au-delà de 250 kWh" unit="F" /></td><td><span className="badge b-warn">À confirmer (TVA 18 %)</span></td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,260px),1fr))", gap: 20 }}>
        <div className="card col" style={{ gap: 10 }}><span className="lab">Taxe communale</span><label className="inp"><input value={tax} onChange={(e) => setTax(e.target.value)} aria-label="Taxe communale" /><span className="u">% à chaque recharge</span></label></div>
        <div className="card col" style={{ gap: 10 }}><span className="lab">Redevance · monophasé</span><label className="inp"><input value={mono} onChange={(e) => setMono(e.target.value)} aria-label="Redevance monophasé" /><span className="u">F · 1re recharge du mois</span></label></div>
        <div className="card col" style={{ gap: 10 }}><span className="lab">Redevance · triphasé</span><label className="inp"><input value={tri} onChange={(e) => setTri(e.target.value)} aria-label="Redevance triphasé" /><span className="u">F · 1re recharge du mois</span></label></div>
        <div className="card col" style={{ gap: 10 }}><span className="lab">Remise à zéro des tranches</span><div className="inp">Le 1er de chaque mois</div></div>
      </div>
      <div className="card col" style={{ gap: 8 }}>
        <span className="lab">Aperçu avec ces valeurs</span>
        <p className="sm">10 000 F, 1re recharge du mois : <b className="ink">≈ {kwh(ex1)}</b> · 10 000 F avec 150 kWh déjà achetés : <b className="ink">≈ {kwh(ex2)}</b></p>
      </div>
      {data && data.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Historique des versions</b></div>
          <div className="scr">
            <table className="tbl" style={{ minWidth: 640 }}>
              <thead><tr><th>Version</th><th>Publiée le</th><th className="n">Tranche 1</th><th className="n">Tranche 2</th><th className="n">Taxe</th><th>Statut</th></tr></thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id}>
                    <td>{r.version}</td><td>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
                    <td className="n">{fr(r.config.tiers[0]?.price ?? 0)} F</td><td className="n">{fr(r.config.tiers[1]?.price ?? 0)} F</td>
                    <td className="n">{fr(r.config.communalTax * 100, 1)} %</td>
                    <td>{r.active ? <span className="badge b-ok">Active</span> : <span className="badge b-gr">Archivée</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "18px 20px" }}><b className="h3">Offres et prix</b></div>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead><tr><th>Offre</th><th className="n">Mensuel</th><th className="n">Annuel · 1re année</th><th className="n">Annuel · dès la 2e</th><th className="n">Compteur en plus</th></tr></thead>
            <tbody>
              {(["simple", "ia"] as const).map((k) => (
                <tr key={k}><td><b>{PACKS[k].name}</b></td><td className="n">{fcfa(monthlyPrice(k, 1))}</td><td className="n">{fcfa(annualPrice(k, 1))}</td><td className="n">{fcfa(annualPrice(k, 1, 2))}</td><td className="n">+{fcfa(PACKS[k].extra)}/mois</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Inp({ v, set, label, unit }: { v: string; set: (s: string) => void; label: string; unit?: string }) {
  return (
    <label className="inp" style={{ minHeight: 40, width: 140, marginLeft: "auto", fontSize: 15 }}>
      <input value={v} onChange={(e) => set(e.target.value)} aria-label={label} inputMode="decimal" style={{ textAlign: "right" }} />
      {unit && <span className="u" style={{ marginLeft: 0 }}>{unit}</span>}
    </label>
  );
}
