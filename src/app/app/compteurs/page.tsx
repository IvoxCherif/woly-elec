"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Callout, LevelBadge, Modal, Seg, TextField } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { computeStats, useStore } from "@/lib/store";
import { ago, days, fcfa } from "@/lib/format";
import { PACKS } from "@/lib/pricing";
import type { Usage } from "@/lib/demo";
import type { MeterPhase } from "@/lib/engine";

type Filter = "tous" | "warn" | "risk";

export default function Compteurs() {
  const { state, mode, today, selectMeter, addMeter, notify, loadScenario } = useStore();
  const [filter, setFilter] = useState<Filter>("tous");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const sub = state.subscription;
  const canAdd = sub.status === "actif";

  const rows = useMemo(() => state.meters.map((m) => computeStats(state, m.id, today)), [state, today]);
  const counts = { ok: rows.filter((r) => r.plan.level === "ok").length, warn: rows.filter((r) => r.plan.level === "warn").length, risk: rows.filter((r) => r.plan.level === "risk").length };
  const order = { risk: 0, warn: 1, ok: 2 };
  const shown = rows
    .filter((r) => (filter === "tous" ? true : r.plan.level === filter))
    .filter((r) => `${r.meter.name} ${r.meter.number} ${r.meter.occupant ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => order[a.plan.level] - order[b.plan.level] || a.plan.autonomy - b.plan.autonomy);
  const urgent = rows.find((r) => r.plan.level === "risk");

  return (
    <>
      <div className="kpis">
        <div className="card kpi"><span className="lab">Compteurs suivis</span><span className="v">{rows.length}</span><span className="xs mut">{sub.status === "essai" ? "1 compteur inclus dans l'essai" : "Inclus dans votre abonnement"}</span></div>
        <div className="card kpi"><span className="lab">Statut serein</span><span className="v" style={{ color: "var(--ok)" }}>{counts.ok}</span><span className="xs mut">Plus de 5 jours d&apos;autonomie</span></div>
        <div className="card kpi"><span className="lab">À surveiller</span><span className="v" style={{ color: "#8A6A00" }}>{counts.warn}</span><span className="xs mut">Entre 1 et 5 jours</span></div>
        <div className="card kpi" style={counts.risk ? { borderColor: "#F6B8B8", background: "#FFF8F8" } : undefined}><span className="lab">Urgence</span><span className="v cr">{counts.risk}</span><span className="xs mut">Environ 1 jour ou moins</span></div>
      </div>

      {urgent && (
        <Callout tone="red" title={`${urgent.meter.name}${urgent.meter.occupant ? ` · ${urgent.meter.occupant}` : ""} : environ ${days(urgent.plan.autonomy)} d'électricité`}>
          Dernier relevé {urgent.last ? ago(urgent.last.date, today) : "inconnu"}. Montant minimum pour finir le mois : {fcfa(urgent.plan.minAmount)}.
        </Callout>
      )}

      {state.meters.length === 1 && sub.status !== "actif" && (
        <Callout tone="info" title="Propriétaire, famille, commerce ?">
          Suivez plusieurs compteurs dans un seul tableau de bord : chaque compteur supplémentaire coûte {fcfa(PACKS[sub.pack].extra)}/mois.{" "}
          {mode === "demo" ? (
            <button type="button" className="sm" style={{ color: "var(--blue)", fontWeight: 700 }} onClick={() => { loadScenario("proprietaire"); notify("Démo propriétaire chargée : 6 compteurs"); }}>
              Voir la démo propriétaire
            </button>
          ) : (
            <Link className="sm" href="/app/abonnement/paiement" style={{ fontWeight: 700 }}>M&apos;abonner pour ajouter des compteurs</Link>
          )}
        </Callout>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row wrapf" style={{ padding: "16px 20px", gap: 12 }}>
          <b className="h3">Tous les compteurs</b>
          <span className="sp" />
          <Seg<Filter> label="Filtrer" style={{ width: 380, maxWidth: "100%" }} value={filter} onChange={setFilter} options={[{ value: "tous", label: "Tous" }, { value: "warn", label: "À surveiller" }, { value: "risk", label: "Urgence" }]} />
          <label className="inp" style={{ minHeight: 44, width: 220 }}>
            <Icon name="search" size="s" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" aria-label="Rechercher un compteur" style={{ fontSize: 15 }} />
          </label>
          {canAdd ? (
            <button type="button" className="btn btn-blue btn-sm" onClick={() => setAdding(true)}>
              <Icon name="plus" size="s" /> Ajouter un compteur
            </button>
          ) : (
            <Link className="btn btn-ghost btn-sm" href="/app/abonnement/paiement">
              <Icon name="lock" size="s" /> Ajouter (abonnement requis)
            </Link>
          )}
        </div>
        <div className="scr">
          <table className="tbl" style={{ minWidth: 900 }}>
            <thead>
              <tr><th>Statut</th><th>Compteur</th><th>Occupant / usage</th><th className="n">Autonomie</th><th>Dernier relevé</th><th className="n">À recharger</th><th /></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.meter.id}>
                  <td><LevelBadge level={r.plan.level} /></td>
                  <td><b>{r.meter.name}</b><div className="xs mut">{r.meter.number}</div></td>
                  <td>{r.meter.occupant ?? r.meter.usage}</td>
                  <td className="n"><b className={r.plan.level === "risk" ? "cr" : ""}>≈ {days(r.plan.autonomy)}</b></td>
                  <td>{r.last ? ago(r.last.date, today) : "—"}</td>
                  <td className="n">{r.plan.minAmount ? fcfa(r.plan.minAmount) : "—"}</td>
                  <td style={{ textAlign: "right" }}>
                    {r.plan.level !== "ok" && r.meter.occupant ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => notify(`Relance envoyée à ${r.meter.occupant} par WhatsApp`)}>Relancer</button>
                    ) : (
                      <Link className="btn btn-ghost btn-sm" href="/app" onClick={() => selectMeter(r.meter.id)}>Voir</Link>
                    )}
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 28, color: "var(--mut)" }}>Aucun compteur ne correspond.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="xs mut">Les montants et autonomies sont des estimations d&apos;après les relevés saisis pour chaque compteur. Chaque compteur a son propre quota IA et ses propres alertes.</p>

      <AddMeter open={adding} onClose={() => setAdding(false)} onAdd={(m) => { addMeter(m); notify(`Compteur « ${m.name} » ajouté (+${fcfa(PACKS[sub.pack].extra)}/mois)`); setAdding(false); }} extra={PACKS[sub.pack].extra} />
    </>
  );
}

function AddMeter({ open, onClose, onAdd, extra }: { open: boolean; onClose: () => void; onAdd: (m: { name: string; number: string; usage: Usage; phase: MeterPhase; site: string; occupant?: string; debt: number }) => void; extra: number }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [occupant, setOccupant] = useState("");
  const [usage, setUsage] = useState<Usage>("Location");
  const [phase, setPhase] = useState<MeterPhase>("mono");
  const valid = name.trim() && number.replace(/\D/g, "").length >= 8;
  return (
    <Modal open={open} onClose={onClose} title="Ajouter un compteur" subtitle={`+${fcfa(extra)}/mois sur votre abonnement`}>
      <TextField label="Nom du compteur" value={name} onChange={setName} placeholder="Appartement B3" />
      <TextField label="Numéro de compteur Woyofal" value={number} onChange={setNumber} placeholder="0145 0000 000" hint="Inscrit sur la face avant du compteur." />
      <TextField label="Occupant (facultatif)" value={occupant} onChange={setOccupant} placeholder="M. Ndiaye" />
      <div className="field">
        <span className="lbl">Usage</span>
        <div className="chips" role="group" aria-label="Usage">
          {(["Ménage", "Location", "Commerce", "Parties communes"] as Usage[]).map((u) => (
            <button key={u} type="button" className="chip" aria-pressed={usage === u} onClick={() => setUsage(u)}>{u}</button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="lbl">Type de compteur</span>
        <Seg<MeterPhase> label="Type de compteur" value={phase} onChange={setPhase} options={[{ value: "mono", label: "Monophasé" }, { value: "tri", label: "Triphasé" }]} />
      </div>
      <div className="row wrapf" style={{ justifyContent: "flex-end", gap: 12 }}>
        <button type="button" className="btn btn-line" onClick={onClose}>Annuler</button>
        <button type="button" className="btn btn-blue" disabled={!valid} onClick={() => onAdd({ name: name.trim(), number: number.trim(), usage, phase, site: "Mes compteurs", occupant: occupant.trim() || undefined, debt: 0 })}>Ajouter le compteur</button>
      </div>
    </Modal>
  );
}
