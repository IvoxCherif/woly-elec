"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart, Callout, NumField } from "@/components/ui";
import { adminPost, SourceBadge, useAdmin } from "../useAdmin";

type Sum = { appels: number; tokensEntree: number; tokensSortie: number; coutUsd: number };
type IaData = {
  mois: Sum;
  total: Sum;
  parJour: (Sum & { jour: string })[];
  parMois: (Sum & { mois: string })[];
  top: (Sum & { id: string; name: string; email: string; vip: boolean })[];
  vips: number;
  quota: number;
  modele: string;
  cle: "absente" | "ok" | "refusee" | "modele_indisponible" | "injoignable";
};

// Conversion indicative pour lire le coût en francs CFA (1 $ ≈ 600 F)
const USD_XOF = 600;
const usd = (v: number) => (v === 0 ? "0 $" : `${v < 1 ? v.toFixed(4) : v.toFixed(2)} $`);
const fcfa = (v: number) => `≈ ${Math.round(v * USD_XOF).toLocaleString("fr-FR")} F`;
const n = (v: number) => v.toLocaleString("fr-FR");
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const moisLabel = (m: string) => `${MOIS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

const KEY: Record<IaData["cle"], { tone: "ok" | "warn" | "red"; text: string }> = {
  ok: { tone: "ok", text: "Clé Claude active" },
  absente: { tone: "red", text: "Clé absente : ajoutez ANTHROPIC_API_KEY dans hPanel puis redéployez" },
  refusee: { tone: "red", text: "Clé refusée par Anthropic : vérifiez-la ou créez-en une nouvelle" },
  modele_indisponible: { tone: "warn", text: "Modèle indisponible pour cette clé" },
  injoignable: { tone: "warn", text: "API Anthropic injoignable pour le moment" },
};

export default function AdminIa() {
  const { data, live, reload } = useAdmin<IaData>("ia");
  const [quota, setQuota] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setQuota(String(data.quota));
  }, [data]);

  async function saveQuota() {
    const v = Number(quota.replace(/\s/g, ""));
    if (!Number.isInteger(v) || v < 0 || v > 10000) return setMsg({ ok: false, text: "Entrez un nombre entier entre 0 et 10 000." });
    setSaving(true);
    const r = await adminPost({ type: "ia_quota", valeur: v });
    setSaving(false);
    setMsg(r.ok ? { ok: true, text: `Quota général enregistré : ${v} questions par compteur et par mois.` } : { ok: false, text: "Enregistrement impossible." });
    if (r.ok) void reload();
  }

  if (live === false) return <Callout tone="warn" title="Base non configurée">La consommation de l&apos;IA s&apos;affiche quand la base de données est branchée.</Callout>;
  if (!data) return <div className="skel" style={{ height: 320 }} aria-busy="true" />;
  const k = KEY[data.cle];
  const perCall = data.mois.appels ? data.mois.coutUsd / data.mois.appels : 0;

  return (
    <div className="stack">
      <div className="row wrapf" style={{ gap: 12 }}>
        <SourceBadge live={live} />
        <span className={`badge ${k.tone === "ok" ? "b-ok" : k.tone === "warn" ? "b-warn" : "b-risk"}`}>{k.text}</span>
        <span className="badge b-ia">Modèle : {data.modele}</span>
        <span className="sp" />
        <button type="button" className="btn btn-line btn-sm" onClick={() => void reload()}>Actualiser</button>
      </div>

      <div className="kpis">
        <div className="card kpi"><span className="lab">Coût ce mois-ci</span><span className="v">{usd(data.mois.coutUsd)}</span><span className="xs mut">{fcfa(data.mois.coutUsd)}</span></div>
        <div className="card kpi"><span className="lab">Questions à Claude ce mois-ci</span><span className="v">{n(data.mois.appels)}</span><span className="xs mut">{data.mois.appels ? `${usd(perCall)} par question en moyenne` : "Aucune question encore"}</span></div>
        <div className="card kpi"><span className="lab">Tokens ce mois-ci</span><span className="v">{n(data.mois.tokensEntree + data.mois.tokensSortie)}</span><span className="xs mut">{n(data.mois.tokensEntree)} lus · {n(data.mois.tokensSortie)} écrits</span></div>
        <div className="card kpi"><span className="lab">Depuis le début</span><span className="v">{usd(data.total.coutUsd)}</span><span className="xs mut">{n(data.total.appels)} questions · {fcfa(data.total.coutUsd)}</span></div>
      </div>

      <div className="grid2">
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Questions par jour · 30 derniers jours</b>
          <BarChart
            label="Questions à Claude par jour"
            data={data.parJour.map((d, i) => ({ label: i % 5 === 4 || i === 29 ? d.jour.slice(8, 10) : "", value: d.appels, hint: `${d.jour.slice(8, 10)}/${d.jour.slice(5, 7)} : ${d.appels} question(s) · ${usd(d.coutUsd)}` }))}
          />
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Quota de questions</b>
          <p className="sm">Nombre de questions à l&apos;assistant par compteur et par mois, pour tous les clients Woly Elec IA. Un quota propre à un client se règle dans <Link href="/admin/utilisateurs">Utilisateurs</Link>.</p>
          <NumField label="Questions par compteur et par mois" value={quota} onChange={setQuota} unit="questions" big={false} />
          <div className="row" style={{ gap: 12 }}>
            <button type="button" className="btn btn-blue" onClick={saveQuota} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer le quota"}</button>
            <span className="xs mut">{data.vips} client{data.vips > 1 ? "s" : ""} VIP</span>
          </div>
          {msg && <Callout tone={msg.ok ? "ok" : "red"} title={msg.text} />}
        </div>
      </div>

      <div className="grid2">
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <b className="h3" style={{ display: "block", padding: "16px 20px" }}>Par mois</b>
          <div className="scr">
            <table className="tbl">
              <thead><tr><th>Mois</th><th className="n">Questions</th><th className="n">Tokens</th><th className="n">Coût</th></tr></thead>
              <tbody>
                {data.parMois.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--mut)", padding: 24 }}>Aucune consommation.</td></tr>}
                {data.parMois.map((m) => (
                  <tr key={m.mois}><td><b>{moisLabel(m.mois)}</b></td><td className="n">{n(m.appels)}</td><td className="n">{n(m.tokensEntree + m.tokensSortie)}</td><td className="n">{usd(m.coutUsd)} <span className="xs mut">{fcfa(m.coutUsd)}</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <b className="h3" style={{ display: "block", padding: "16px 20px" }}>Plus gros utilisateurs ce mois-ci</b>
          <div className="scr">
            <table className="tbl">
              <thead><tr><th>Client</th><th className="n">Questions</th><th className="n">Coût</th></tr></thead>
              <tbody>
                {data.top.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "var(--mut)", padding: 24 }}>Aucune question ce mois-ci.</td></tr>}
                {data.top.map((u) => (
                  <tr key={u.id}><td><b>{u.name}</b> {u.vip && <span className="badge b-ia">VIP</span>}<br /><span className="xs mut">{u.email}</span></td><td className="n">{n(u.appels)}</td><td className="n">{usd(u.coutUsd)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="xs mut">Coût calculé à partir des tokens renvoyés par l&apos;API Claude (tarif Haiku 5.5 : 0,10 $ par million de tokens lus, 0,50 $ par million écrits). Le montant facturé fait foi sur console.anthropic.com. Les réponses du moteur de calcul local ne coûtent rien et ne sont pas comptées.</p>
    </div>
  );
}
