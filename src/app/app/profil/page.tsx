"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Seg, Switch, TextField } from "@/components/ui";
import { useMeterStats, useStore } from "@/lib/store";
import { PACKS } from "@/lib/pricing";
import type { Objective, Scenario, Usage } from "@/lib/demo";
import type { MeterPhase } from "@/lib/engine";

export default function Profil() {
  const { state, mode, updateUser, updateMeter, removeMeter, loadScenario, notify, logout } = useStore();
  const s = useMeterStats();
  const u = state.user;
  const [name, setName] = useState(u.name);
  const [phone, setPhone] = useState(u.phone);
  const [mName, setMName] = useState(s.meter.name);
  const [debt, setDebt] = useState(String(s.meter.debt));

  return (
    <div className="grid2" style={{ alignItems: "start" }}>
      <div className="col" style={{ gap: 20 }}>
        <div className="card row" style={{ gap: 14 }}>
          <span className="avatar" style={{ width: 56, height: 56, fontSize: 20, background: "var(--g9)", color: "var(--yel)" }}>{u.initials}</span>
          <div className="fx1"><b className="mont ink" style={{ fontSize: 18 }}>{u.name}</b><div className="sm mut">{u.email || "Compte de démonstration"}</div></div>
          <span className={`badge ${state.subscription.status === "essai" ? "b-trial" : "b-ok"}`}>{state.subscription.status === "essai" ? "Essai" : PACKS[state.subscription.pack].name}</span>
        </div>
        <div className="card col" style={{ gap: 14 }}>
          <b className="h3">Informations personnelles</b>
          <TextField label="Nom" value={name} onChange={setName} autoComplete="name" />
          <div className="field"><span className="lbl">Adresse e-mail (connexion et résumé mensuel)</span><div className="inp" style={{ background: "var(--bg)" }}>{u.email || "—"}</div></div>
          <TextField label="Numéro WhatsApp pour les alertes (facultatif)" type="tel" value={phone} onChange={setPhone} prefix="+221" placeholder="77 123 45 67" autoComplete="tel-national" hint="Pour recevoir vos alertes avant coupure par WhatsApp ou SMS." />
          <div className="field"><span className="lbl">Langue</span><Seg label="Langue" value={u.lang} onChange={(v) => updateUser({ lang: v })} options={[{ value: "Français", label: "Français" }, { value: "Wolof", label: "Wolof (bientôt)" }]} /></div>
          <div className="field">
            <span className="lbl">Personnes dans le foyer</span>
            <div className="chips">{[1, 2, 3, 4, 5, 6, 8, 10].map((n) => <button key={n} type="button" className="chip" aria-pressed={u.household === n} onClick={() => updateUser({ household: n })}>{n}{n === 10 ? "+" : ""}</button>)}</div>
          </div>
          <button type="button" className="btn btn-blue" style={{ alignSelf: "flex-start" }} onClick={() => { updateUser({ name, phone: phone.replace(/^\+221\s*/, ""), initials: name.replace(/^(M\.|Mme)\s*/, "").split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase() || u.initials }); notify("Profil enregistré"); }}>Enregistrer</button>
        </div>
        <div className="card col" style={{ gap: 14 }}>
          <b className="h3">Préférences de recharge</b>
          <div className="field"><span className="lbl">Jour de recharge préféré</span><div className="chips">{[1, 5, 10, 15, 20, 25].map((d) => <button key={d} type="button" className="chip" aria-pressed={u.rechargeDay === d} onClick={() => updateUser({ rechargeDay: d })}>{d === 1 ? "1er" : d}</button>)}</div></div>
          <div className="field"><span className="lbl">Objectif</span><Seg<Objective> label="Objectif" value={u.objective} onChange={(v) => updateUser({ objective: v })} options={[{ value: "mois", label: "Tenir tout le mois" }, { value: "coupure", label: "Éviter la coupure" }, { value: "economiser", label: "Économiser" }]} /></div>
          <Link href="/app/alertes" className="row sm" style={{ fontWeight: 600 }}><Icon name="bell" size="s" /> Canaux d&apos;alerte et relances <Icon name="right" size="s" /></Link>
        </div>
      </div>

      <div className="col" style={{ gap: 20 }}>
        <div className="card col" style={{ gap: 14 }}>
          <b className="h3">Compteur affiché</b>
          <TextField label="Nom du compteur" value={mName} onChange={setMName} />
          <div className="field"><span className="lbl">Numéro Woyofal</span><div className="inp" style={{ background: "var(--bg)" }}>{s.meter.number}</div></div>
          <div className="field"><span className="lbl">Type d&apos;usage</span><div className="chips">{(["Ménage", "Commerce", "Location", "Parties communes"] as Usage[]).map((x) => <button key={x} type="button" className="chip" aria-pressed={s.meter.usage === x} onClick={() => updateMeter(s.meter.id, { usage: x })}>{x}</button>)}</div></div>
          <div className="field"><span className="lbl">Type de compteur (sert à la redevance)</span><Seg<MeterPhase> label="Type de compteur" value={s.meter.phase} onChange={(v) => updateMeter(s.meter.id, { phase: v })} options={[{ value: "mono", label: "Monophasé · 429 F/mois" }, { value: "tri", label: "Triphasé · 1 427 F/mois" }]} /></div>
          <TextField label="Retenue de dette Senelec par recharge (F)" value={debt} onChange={(v) => setDebt(v.replace(/\D/g, ""))} hint="Laissez 0 si aucune somme n'est retenue sur vos recharges." />
          <div className="row wrapf" style={{ gap: 10 }}>
            <button type="button" className="btn btn-blue" onClick={() => { updateMeter(s.meter.id, { name: mName.trim() || s.meter.name, debt: Number(debt) || 0 }); notify("Compteur mis à jour"); }}>Enregistrer</button>
            {state.meters.length > 1 && <button type="button" className="btn btn-red" onClick={() => { if (confirm(`Supprimer « ${s.meter.name} » et son historique ?`)) { removeMeter(s.meter.id); notify("Compteur supprimé"); } }}>Supprimer ce compteur</button>}
          </div>
        </div>
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Données et confidentialité</b>
          <Switch checked={u.consent} onChange={(v) => updateUser({ consent: v })} label="J'accepte l'utilisation de mes relevés pour mes prévisions" />
          <p className="sm">Vos relevés ne servent qu&apos;à calculer vos prévisions et à vous envoyer vos alertes. <Link href="/confidentialite">Politique de confidentialité</Link></p>
          <div className="row wrapf" style={{ gap: 10 }}>
            <button type="button" className="btn btn-line btn-sm" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "woly-elec-mes-donnees.json"; a.click(); URL.revokeObjectURL(url); }}><Icon name="download" size="s" /> Télécharger mes données</button>
            {mode === "server" ? (
              <button type="button" className="btn btn-line btn-sm" onClick={logout}><Icon name="logout" size="s" /> Se déconnecter</button>
            ) : (
              <Link className="btn btn-line btn-sm" href="/connexion"><Icon name="user" size="s" /> Me connecter</Link>
            )}
          </div>
        </div>
        {mode === "demo" && <div className="card col" style={{ gap: 12, background: "var(--yel1)", borderColor: "#F3DC8A" }}>
          <b className="h4">Données de démonstration</b>
          <p className="sm" style={{ color: "#6B4E00" }}>Vous n&apos;êtes pas connecté : vos saisies restent dans ce navigateur. Changez de scénario pour explorer l&apos;interface.</p>
          <div className="chips">
            {([["essai", "Essai · 1 compteur"], ["proprietaire", "Propriétaire · 6 compteurs"], ["fin-essai", "Essai terminé"]] as [Scenario, string][]).map(([k, l]) => (
              <button key={k} type="button" className="chip" aria-pressed={state.scenario === k} onClick={() => { loadScenario(k); notify(`Scénario chargé : ${l}`); }}>{l}</button>
            ))}
          </div>
        </div>}
      </div>
    </div>
  );
}
