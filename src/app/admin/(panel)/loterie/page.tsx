"use client";

import { useState } from "react";
import { Callout, Switch } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { adminPost, SourceBadge, useAdmin } from "../useAdmin";

type Tirage = {
  id: number;
  clientId: string | null;
  nom: string;
  email: string;
  telephone: string | null;
  numeroCompteur: string;
  nomCompteur: string;
  consoMoisKwh: number | null;
  montantMois: number | null;
  participants: number;
  statut: "tire" | "recharge" | "annule";
  createdAt: string;
  rechargeAt: string | null;
  releves?: number;
};
type Data = { tirages: Tirage[]; participants: number };

const ERR: Record<string, string> = {
  aucun_participant: "Aucun client ne remplit les conditions du tirage.",
  tirage_deja_traite: "Ce tirage a déjà été traité.",
};
const F = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("fr-FR")} F`);
const K = (v: number | null) => (v === null ? "Pas encore de relevé" : `${Math.round(v).toLocaleString("fr-FR")} kWh / mois`);
const date = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const STATUT: Record<Tirage["statut"], [string, string]> = { tire: ["À recharger", "b-warn"], recharge: ["Rechargé", "b-ok"], annule: ["Annulé", "b-gr"] };

export default function AdminLoterie() {
  const [exclure, setExclure] = useState(true);
  const [actifs, setActifs] = useState(false);
  const { data, live, reload } = useAdmin<Data>("loterie", `&exclure=${exclure ? 1 : 0}&actifs=${actifs ? 1 : 0}`);
  const [winner, setWinner] = useState<Tirage | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function draw() {
    if (!window.confirm(`Tirer au sort un gagnant parmi ${data?.participants ?? 0} participant(s) ?`)) return;
    setBusy(true);
    setMsg(null);
    setCopied(false);
    const r = await adminPost<Tirage>({ type: "loterie_tirage", exclure, actifs });
    setBusy(false);
    if (!r.ok || !r.gagnant) return setMsg({ ok: false, text: ERR[r.error ?? ""] ?? "Tirage impossible." });
    setWinner(r.gagnant);
    void reload();
  }

  async function setStatus(t: Tirage, statut: "recharge" | "annule") {
    const q =
      statut === "recharge"
        ? `Confirmer que le compteur ${t.numeroCompteur} a été rechargé ? ${t.nom || "Le gagnant"} recevra une alerte et une notification.`
        : "Annuler ce tirage ? Le client pourra être tiré à nouveau.";
    if (!window.confirm(q)) return;
    const r = await adminPost({ type: "loterie_statut", id: t.id, statut });
    setMsg(r.ok ? { ok: true, text: statut === "recharge" ? "Recharge confirmée : le gagnant a été prévenu." : "Tirage annulé." } : { ok: false, text: ERR[r.error ?? ""] ?? "Mise à jour impossible." });
    if (winner?.id === t.id) setWinner({ ...winner, statut });
    void reload();
  }

  async function copy(v: string) {
    try {
      await navigator.clipboard.writeText(v.replace(/\s/g, ""));
      setCopied(true);
    } catch {
      /* presse-papiers indisponible */
    }
  }

  if (live === false) return <Callout tone="warn" title="Base non configurée">La loterie fonctionne quand la base de données est branchée.</Callout>;

  return (
    <div className="stack">
      <div className="row wrapf" style={{ gap: 12 }}>
        <SourceBadge live={live} />
        <span className="sp" />
        <button type="button" className="btn btn-line btn-sm" onClick={() => void reload()}>Actualiser</button>
      </div>

      <div className="card col" style={{ gap: 16 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar y"><Icon name="gift" /></span>
          <div className="fx1">
            <b className="h3">Offrir un mois d&apos;électricité</b>
            <p className="sm mut">Un client est tiré au hasard, avec la même chance pour chacun. Vous rechargez ensuite son compteur du montant indiqué.</p>
          </div>
        </div>
        <div className="col" style={{ gap: 10 }}>
          <Switch checked={exclure} onChange={setExclure} label="Exclure les clients déjà gagnants" />
          <Switch checked={actifs} onChange={setActifs} label="Seulement les clients actifs (relevé dans les 30 derniers jours)" />
        </div>
        <div className="row wrapf" style={{ gap: 12 }}>
          <span className="sm ink"><b>{data ? data.participants.toLocaleString("fr-FR") : "…"}</b> participant{(data?.participants ?? 0) > 1 ? "s" : ""}</span>
          <span className="sp" />
          <button type="button" className="btn btn-yel" onClick={() => void draw()} disabled={busy || !data || data.participants === 0}>
            <Icon name="gift" size="s" /> {busy ? "Tirage…" : "Lancer le tirage"}
          </button>
        </div>
        {msg && <p className={`sm ${msg.ok ? "cok" : "cr"}`} role="status" style={{ fontWeight: 600 }}>{msg.text}</p>}
      </div>

      {winner && (
        <div className="card col" style={{ gap: 14, border: "2px solid var(--yel)" }} role="status">
          <div className="row wrapf" style={{ gap: 10 }}>
            <span className="eyebrow">Gagnant du tirage</span>
            <span className={`badge ${STATUT[winner.statut][1]}`}>{STATUT[winner.statut][0]}</span>
            <span className="sp" />
            <span className="xs mut">parmi {winner.participants} participant{winner.participants > 1 ? "s" : ""}</span>
          </div>
          <b className="h2">{winner.nom || winner.email}</b>
          <div className="kpis">
            <div className="mc">
              <span className="k">Numéro du compteur</span>
              <span className="v" style={{ fontSize: 22, wordBreak: "break-all" }}>{winner.numeroCompteur}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy(winner.numeroCompteur)}>{copied ? "Copié" : "Copier le numéro"}</button>
            </div>
            <div className="mc">
              <span className="k">Consommation par mois</span>
              <span className="v" style={{ fontSize: 22 }}>{K(winner.consoMoisKwh)}</span>
              <span className="xs mut">{winner.nomCompteur}</span>
            </div>
            <div className="mc">
              <span className="k">Montant à recharger</span>
              <span className="v" style={{ fontSize: 22 }}>{F(winner.montantMois)}</span>
              <span className="xs mut">Un mois complet, taxe et redevance comprises</span>
            </div>
          </div>
          <div className="sm">
            {winner.email && <div>E-mail : <a href={`mailto:${winner.email}`}>{winner.email}</a></div>}
            {winner.telephone && <div>Téléphone : <a href={`tel:${winner.telephone}`}>{winner.telephone}</a></div>}
          </div>
          {winner.consoMoisKwh === null && (
            <Callout tone="warn" title="Consommation inconnue">Ce client n&apos;a pas de relevé récent : demandez-lui sa consommation, ou relancez le tirage avec « Seulement les clients actifs ».</Callout>
          )}
          {winner.statut === "tire" && (
            <div className="row wrapf" style={{ gap: 10 }}>
              <button type="button" className="btn btn-blue" onClick={() => void setStatus(winner, "recharge")}><Icon name="check" size="s" /> J&apos;ai rechargé ce compteur</button>
              <button type="button" className="btn btn-line" onClick={() => void setStatus(winner, "annule")}>Annuler le tirage</button>
            </div>
          )}
        </div>
      )}

      <div className="card col" style={{ gap: 12 }}>
        <b className="h3">Historique des tirages</b>
        {!data ? (
          <div className="skel" style={{ height: 120 }} />
        ) : data.tirages.length === 0 ? (
          <p className="sm mut">Aucun tirage pour le moment.</p>
        ) : (
          <div className="scr">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Gagnant</th>
                  <th>Compteur</th>
                  <th className="n">Conso / mois</th>
                  <th className="n">Montant</th>
                  <th>Statut</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.tirages.map((t) => (
                  <tr key={t.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{date(t.createdAt)}</td>
                    <td>{t.nom || "—"}<div className="xs mut">{t.email}</div></td>
                    <td style={{ whiteSpace: "nowrap" }}>{t.numeroCompteur}<div className="xs mut">{t.nomCompteur}</div></td>
                    <td className="n">{t.consoMoisKwh === null ? "—" : `${Math.round(t.consoMoisKwh)} kWh`}</td>
                    <td className="n">{F(t.montantMois)}</td>
                    <td><span className={`badge ${STATUT[t.statut][1]}`}>{STATUT[t.statut][0]}</span></td>
                    <td>
                      {t.statut === "tire" && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void setStatus(t, "recharge")}>Rechargé</button>
                      )}
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
