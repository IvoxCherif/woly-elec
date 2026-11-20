"use client";

import { useEffect, useState } from "react";
import { Callout, NumField, Switch, TextField } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { adminPost, SourceBadge, useAdmin } from "../useAdmin";

type Achat = {
  reference: string;
  statut: "en_attente" | "paye" | "en_cours" | "livre" | "annule" | "a_rembourser" | "rembourse";
  montant: number;
  frais: number;
  total: number;
  numeroCompteur: string;
  token: string | null;
  date: string;
  client: string;
  nomSenelec: string;
  fraisDexpay: number | null;
  erreur: string | null;
};
type Data = {
  actif: boolean;
  sandbox: boolean;
  cle: string | null;
  cleStatut: "ok" | "refusee" | "injoignable" | "absente";
  webhook: boolean;
  webhookUrl: string;
  fraisPct: number;
  fraisFixe: number;
  paiement: "saspay" | "demo" | "off";
  achats: Achat[];
};

const STATUT: Record<Achat["statut"], [string, string]> = {
  en_attente: ["Paiement en attente", "b-gr"],
  paye: ["Payé · achat à faire", "b-warn"],
  en_cours: ["Achat en cours", "b-warn"],
  livre: ["Code livré", "b-ok"],
  annule: ["Annulé", "b-gr"],
  a_rembourser: ["À rembourser", "b-risk"],
  rembourse: ["Remboursé", "b-gr"],
};
const KEY_TXT: Record<Data["cleStatut"], [string, string]> = {
  ok: ["Clé DexPay acceptée", "b-ok"],
  refusee: ["Clé DexPay refusée", "b-risk"],
  injoignable: ["DexPay injoignable", "b-warn"],
  absente: ["Aucune clé DexPay", "b-gr"],
};
const ERR: Record<string, string> = {
  cle_invalide: "Clé invalide : elle commence par sk_test_ (bac à sable) ou sk_live_ (production).",
  webhook_invalide: "Secret du webhook invalide (ce n'est pas la clé API).",
  frais_invalides: "Frais invalides : 0 à 20 % et 0 à 5 000 F.",
  compteur_inconnu_senelec: "Compteur inconnu chez Senelec.",
  verification_impossible: "Vérification impossible : clé absente ou DexPay injoignable.",
};
const F = (n: number) => `${n.toLocaleString("fr-FR")} F`;

export default function AdminRecharges() {
  const { data, live, reload } = useAdmin<Data>("recharges");
  const [cle, setCle] = useState("");
  const [webhook, setWebhook] = useState("");
  const [pct, setPct] = useState("");
  const [fixe, setFixe] = useState("");
  const [numero, setNumero] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setPct(String(data.fraisPct).replace(".", ","));
      setFixe(String(data.fraisFixe));
    }
  }, [data]);

  async function send(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    const r = await adminPost(body);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: ERR[r.error ?? ""] ?? "Action impossible." });
    if (r.ok) void reload();
    return r.ok;
  }

  async function saveKeys(e: React.FormEvent) {
    e.preventDefault();
    if (await send({ type: "dexpay", cle: cle || undefined, webhook: webhook || undefined }, "Configuration DexPay enregistrée.")) {
      setCle("");
      setWebhook("");
    }
  }

  async function verify() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/admin/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "dexpay_verifier", numero }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Compteur trouvé chez Senelec : ${j.nom || "nom non communiqué"}${j.adresse ? ` · ${j.adresse}` : ""} · statut ${j.statut || "—"}. Aucun débit.` } : { ok: false, text: ERR[j.error] ?? "Vérification impossible." });
  }

  if (live === false) return <Callout tone="warn" title="Base non configurée">La vente de recharges fonctionne quand la base de données est branchée.</Callout>;
  if (!data) return <div className="skel" style={{ height: 320 }} aria-busy="true" />;
  const k = KEY_TXT[data.cleStatut];
  const ready = data.cleStatut === "ok" && data.paiement === "saspay";
  const livres = data.achats.filter((a) => a.statut === "livre");
  const ventes = livres.reduce((s, a) => s + a.montant, 0);
  const marge = livres.reduce((s, a) => s + a.frais - (a.fraisDexpay ?? 0), 0);
  const aRembourser = data.achats.filter((a) => a.statut === "a_rembourser");

  return (
    <div className="stack">
      <div className="row wrapf" style={{ gap: 10 }}>
        <SourceBadge live={live} />
        <span className={`badge ${k[1]}`}>{k[0]}</span>
        {data.cle && <span className="badge b-gr">{data.sandbox ? "Bac à sable (test)" : "Production"}</span>}
        <span className={`badge ${data.actif ? "b-ok" : "b-gr"}`}>{data.actif ? "Visible par les clients" : "Masqué aux clients"}</span>
        <span className="sp" />
        <button type="button" className="btn btn-line btn-sm" onClick={() => void reload()}>Actualiser</button>
      </div>
      {msg && <Callout tone={msg.ok ? "ok" : "red"} title={msg.ok ? "C'est fait" : "Oups"}>{msg.text}</Callout>}
      {aRembourser.length > 0 && (
        <Callout tone="red" title={`${aRembourser.length} recharge${aRembourser.length > 1 ? "s" : ""} à rembourser`}>
          Payées par le client mais non achetées chez DexPay. Relancez l&apos;achat ou remboursez le client, puis marquez « Remboursé ».
        </Callout>
      )}

      <div className="kpis">
        <div className="card kpi"><span className="lab">Recharges livrées</span><span className="v">{livres.length}</span><span className="xs mut">{F(ventes)} de crédit vendu</span></div>
        <div className="card kpi"><span className="lab">Marge Woly Elec</span><span className="v">{F(marge)}</span><span className="xs mut">frais client − frais DexPay</span></div>
        <div className="card kpi"><span className="lab">Frais client</span><span className="v" style={{ fontSize: 24 }}>{String(data.fraisPct).replace(".", ",")} % + {F(data.fraisFixe)}</span><span className="xs mut">DexPay prend 1 % par recharge</span></div>
      </div>

      <div className="card col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar y"><Icon name="bolt" /></span>
          <div className="fx1">
            <b className="h3">Afficher la vente aux clients</b>
            <p className="sm mut">Masquée tant que vous ne l&apos;activez pas : le bouton « Recharger » n&apos;apparaît nulle part dans l&apos;application.</p>
          </div>
        </div>
        {!ready && (
          <Callout tone="info" title="Avant d'activer">
            {data.cleStatut !== "ok" ? "Enregistrez une clé DexPay valide. " : ""}
            {data.paiement !== "saspay" ? "Le paiement SasPay doit être activé (page Paiement en ligne). " : ""}
            Testez d&apos;abord avec une clé sk_test_ (bac à sable DexPay, sans argent réel) et un solde DexPay approvisionné en production.
          </Callout>
        )}
        <Switch checked={data.actif} onChange={(v) => void send({ type: "dexpay", actif: v }, v ? "Vente activée : les clients voient le bouton « Recharger »." : "Vente masquée aux clients.")} label="Vente de recharges visible dans l'application" />
      </div>

      <form className="card col" style={{ gap: 12 }} onSubmit={saveKeys}>
        <b className="h3">Clés DexPay</b>
        <p className="sm mut">
          Créez votre compte sur dexpay.africa (clés de bac à sable immédiates ; production après validation de votre entreprise). Ne collez jamais ces clés ailleurs qu&apos;ici : elles sont chiffrées.
        </p>
        <TextField label={`Clé secrète${data.cle ? ` (actuelle : ${data.cle})` : ""}`} value={cle} onChange={setCle} placeholder="sk_test_… ou sk_live_…" autoComplete="off" />
        <TextField label={`Secret du webhook${data.webhook ? " (enregistré)" : ""}`} value={webhook} onChange={setWebhook} placeholder="facultatif" autoComplete="off" />
        <div className="col" style={{ gap: 4 }}>
          <span className="lbl">Adresse du webhook à déclarer chez DexPay</span>
          <code className="sm" style={{ background: "var(--g1)", padding: "8px 10px", borderRadius: 8, overflowWrap: "anywhere" }}>{data.webhookUrl}</code>
        </div>
        <button type="submit" className="btn btn-blue" disabled={busy || (!cle && !webhook)}>Enregistrer</button>
      </form>

      <div className="card col" style={{ gap: 12 }}>
        <b className="h3">Frais de service facturés au client</b>
        <p className="sm mut">Ajoutés au prix de la recharge. Exemple avec 1 % + 100 F : une recharge de 10 000 F coûte 10 200 F au client ; DexPay prélève 100 F sur votre solde, il vous reste 100 F.</p>
        <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12 }}>
          <NumField label="Pourcentage" unit="%" value={pct} onChange={setPct} big={false} />
          <NumField label="Montant fixe" unit="F" value={fixe} onChange={setFixe} big={false} />
        </div>
        <button type="button" className="btn btn-line" disabled={busy} onClick={() => void send({ type: "dexpay", fraisPct: Number(pct.replace(",", ".")), fraisFixe: Number(fixe) }, "Frais enregistrés.")}>Enregistrer les frais</button>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <b className="h3">Tester un compteur</b>
        <p className="sm mut">Consulte le compteur chez Senelec via DexPay (nom du titulaire, statut), sans rien acheter.</p>
        <TextField label="Numéro de compteur" value={numero} onChange={setNumero} placeholder="0145 6789 012" />
        <button type="button" className="btn btn-line" disabled={busy || numero.replace(/\D/g, "").length < 8 || data.cleStatut === "absente"} onClick={() => void verify()}>Vérifier</button>
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <b className="h3">Ventes</b>
        {data.achats.length === 0 ? (
          <p className="sm mut">Aucune vente pour le moment.</p>
        ) : (
          <div className="scr">
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th>Client</th><th>Compteur</th><th className="n">Recharge</th><th className="n">Payé</th><th>Statut</th><th>Code</th><th /></tr>
              </thead>
              <tbody>
                {data.achats.map((a) => (
                  <tr key={a.reference}>
                    <td style={{ whiteSpace: "nowrap" }}>{new Date(a.date).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}<div className="xs mut">{a.reference}</div></td>
                    <td>{a.client}{a.nomSenelec && <div className="xs mut">Senelec : {a.nomSenelec}</div>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{a.numeroCompteur}</td>
                    <td className="n">{F(a.montant)}</td>
                    <td className="n">{F(a.total)}</td>
                    <td><span className={`badge ${STATUT[a.statut][1]}`}>{STATUT[a.statut][0]}</span>{a.erreur && <div className="xs cr">{a.erreur}</div>}</td>
                    <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{a.token ?? "—"}</td>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        {(a.statut === "paye" || a.statut === "en_cours" || a.statut === "a_rembourser") && (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm(a.statut === "a_rembourser" ? "Relancer l'achat chez DexPay ? À faire seulement si aucun code n'a été livré." : "Revérifier cette recharge ?") && void send({ type: "recharge_action", reference: a.reference, action: "relancer" }, "Recharge revérifiée.")}>Relancer</button>
                        )}
                        {a.statut === "a_rembourser" && (
                          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => window.confirm(`Confirmer que ${F(a.total)} ont été remboursés au client ?`) && void send({ type: "recharge_action", reference: a.reference, action: "rembourse" }, "Marquée remboursée.")}>Remboursé</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
