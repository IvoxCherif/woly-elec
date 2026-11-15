"use client";

import { useState } from "react";
import { Callout, Switch } from "@/components/ui";
import { fcfa } from "@/lib/format";
import { adminPost, ago, SourceBadge, useAdmin } from "../useAdmin";

type Data = {
  mode: "saspay" | "demo" | "off";
  actif: boolean;
  cle: string | null;
  cleStatut: "ok" | "refusee" | "injoignable" | "absente";
  webhook: boolean;
  webhookUrl: string;
  paiements: { reference: string; client: string; libelle: string; moyen: string; montant: number; statut: string; date: string }[];
};

const STATUT: Record<string, { label: string; cls: string }> = {
  confirme: { label: "Payé", cls: "b-ok" },
  simule: { label: "Simulé (démo)", cls: "b-trial" },
  en_attente: { label: "En attente", cls: "b-warn" },
  echec: { label: "Échoué", cls: "b-risk" },
  annule: { label: "Abandonné", cls: "b-risk" },
};

/** Champ secret : jamais pré-rempli, jamais réaffiché. */
function SecretField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="field">
      <span className="lbl">{label}</span>
      <span className="inp"><input type="password" autoComplete="off" spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ fontSize: 15 }} /></span>
    </label>
  );
}

export default function Paiement() {
  const { data, live, reload } = useAdmin<Data>("paiement");
  const [cle, setCle] = useState("");
  const [webhook, setWebhook] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function save(extra: { actif?: boolean } = {}) {
    setBusy(true);
    const r = await adminPost({ type: "saspay", cle: cle || undefined, webhook: webhook || undefined, ...extra });
    setBusy(false);
    if (r.ok) {
      setCle("");
      setWebhook("");
      setMsg({ ok: true, text: extra.actif === undefined ? "Enregistré." : extra.actif ? "Paiement en ligne activé." : "Paiement en ligne désactivé." });
      void reload();
    } else
      setMsg({
        ok: false,
        text:
          r.error === "cle_invalide"
            ? "Le champ « Clé secrète API » doit contenir la clé API SasPay (elle commence par sk_live_). Le secret du webhook va dans le second champ."
            : r.error === "webhook_invalide"
              ? "Le champ « Secret de signature du webhook » contient une clé API (sk_…) : collez-y le secret affiché à la création du webhook."
              : "Enregistrement impossible.",
      });
  }

  if (live === false) return <Callout tone="warn" title="Base non configurée">Le paiement en ligne s&apos;active quand la base de données est branchée.</Callout>;
  if (!data) return <div className="skel" style={{ height: 320 }} aria-busy="true" />;

  const keyBadge = { ok: ["b-ok", "Clé acceptée par SasPay"], refusee: ["b-risk", "Clé refusée par SasPay"], injoignable: ["b-warn", "SasPay injoignable"], absente: ["b-risk", "Aucune clé"] }[data.cleStatut];
  const ready = data.cleStatut === "ok" && data.webhook;

  return (
    <div className="stack">
      <div className="row wrapf" style={{ gap: 12 }}>
        <SourceBadge live={live} />
        <span className={`badge ${data.mode === "saspay" ? "b-ok" : "b-warn"}`}>{data.mode === "saspay" ? "Paiement réel SasPay actif" : data.mode === "demo" ? "Mode démo : paiements simulés" : "Paiement désactivé"}</span>
        <span className={`badge ${keyBadge[0]}`}>{keyBadge[1]}</span>
        <span className={`badge ${data.webhook ? "b-ok" : "b-risk"}`}>{data.webhook ? "Secret du webhook enregistré" : "Secret du webhook manquant"}</span>
      </div>

      <div className="grid2">
        <div className="card col" style={{ gap: 14 }}>
          <b className="h3">Clés SasPay</b>
          <p className="sm">Les clés sont enregistrées chiffrées et ne sont jamais réaffichées. Laissez un champ vide pour garder la valeur actuelle.</p>
          <SecretField label={`Clé secrète API${data.cle ? ` (actuelle : ${data.cle})` : ""}`} value={cle} onChange={setCle} placeholder="sk_live_…" />
          <SecretField label="Secret de signature du webhook" value={webhook} onChange={setWebhook} placeholder={data.webhook ? "•••••••• (enregistré)" : "Affiché une seule fois par SasPay"} />
          <button type="button" className="btn btn-blue" onClick={() => save()} disabled={busy || (!cle && !webhook)}>{busy ? "Enregistrement…" : "Enregistrer les clés"}</button>
          <div className="sep" style={{ height: 1, background: "var(--ln)" }} />
          <Switch checked={data.actif} label="Activer le paiement réel SasPay" onChange={(v) => {
            if (v && !ready) return setMsg({ ok: false, text: "Enregistrez d'abord une clé acceptée et le secret du webhook." });
            if (v && !window.confirm("Activer le paiement réel ? Les clients paieront avec de l'argent réel via SasPay.")) return;
            void save({ actif: v });
          }} />
          {msg && <Callout tone={msg.ok ? "ok" : "red"} title={msg.text} />}
        </div>

        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Webhook à créer dans SasPay</b>
          <p className="sm">Dans le tableau de bord SasPay → <b>Webhooks</b>, créez un point de réception avec cette adresse, abonnez-le aux événements <code>transaction.success</code>, <code>transaction.failed</code> et <code>transaction.cancelled</code>, puis collez ici le secret de signature affiché.</p>
          <div className="row" style={{ gap: 8 }}>
            <code className="sm" style={{ flex: 1, background: "var(--g1)", padding: "10px 12px", borderRadius: 10, wordBreak: "break-all" }}>{data.webhookUrl}</code>
            <button type="button" className="btn btn-line btn-sm" onClick={() => { void navigator.clipboard.writeText(data.webhookUrl); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }}>{copied ? "Copié" : "Copier"}</button>
          </div>
          <Callout tone="warn" title="Pas de bac à sable chez SasPay">Même une clé sk_test_ peut débiter de l&apos;argent réel. Testez avec un vrai petit paiement.</Callout>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <b className="h3" style={{ display: "block", padding: "16px 20px" }}>Derniers paiements</b>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 760 }}>
            <thead><tr><th>Référence</th><th>Client</th><th>Offre</th><th>Moyen</th><th className="n">Montant</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody>
              {data.paiements.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--mut)", padding: 24 }}>Aucun paiement.</td></tr>}
              {data.paiements.map((p) => {
                const s = STATUT[p.statut] ?? { label: p.statut, cls: "b-trial" };
                return (
                  <tr key={p.reference}><td><code className="xs">{p.reference}</code></td><td>{p.client}</td><td>{p.libelle}</td><td>{p.moyen}</td><td className="n">{fcfa(p.montant)}</td><td><span className={`badge ${s.cls}`}>{s.label}</span></td><td>{ago(p.date)}</td></tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
