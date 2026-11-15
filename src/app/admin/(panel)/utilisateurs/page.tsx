"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Seg } from "@/components/ui";
import { sampleUsers, type AdminRow as AdminUser } from "../data";
import { adminPost, ago, SourceBadge, useAdmin } from "../useAdmin";

type F = "tous" | "Actif" | "Essai" | "Expiré" | "VIP";

/** Interrupteur VIP : accès Woly Elec IA offert, sans paiement. */
function VipToggle({ u, live, onDone }: { u: AdminUser; live: boolean | null; onDone: (msg: string) => void }) {
  const [on, setOn] = useState(!!u.vip);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setOn(!!u.vip);
  }, [u.vip]);
  async function toggle() {
    if (!live || busy) return;
    const next = !on;
    if (!next && !window.confirm(`Retirer le statut VIP de ${u.name} ? Le client retrouvera son abonnement d'origine.`)) return;
    setBusy(true);
    setOn(next);
    const r = await adminPost({ type: "vip", id: u.id, vip: next });
    setBusy(false);
    if (!r.ok) setOn(!next);
    onDone(r.ok ? (next ? `${u.name} est VIP : Woly Elec IA offert.` : `${u.name} n'est plus VIP.`) : "Modification impossible.");
  }
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={`VIP pour ${u.name}`} className="sw" onClick={toggle} disabled={!live || busy} title={live ? undefined : "Données d'exemple"} />
  );
}

/** Quota de questions IA propre au client (vide = quota général). */
function QuotaCell({ u, live, onDone }: { u: AdminUser; live: boolean | null; onDone: (msg: string) => void }) {
  const initial = u.quotaIa == null ? "" : String(u.quotaIa);
  const [v, setV] = useState(initial);
  useEffect(() => {
    setV(initial);
  }, [initial]);
  async function save() {
    if (!live || v === initial) return;
    const clean = v.replace(/\s/g, "");
    const valeur = clean === "" ? null : Number(clean);
    if (valeur !== null && (!Number.isInteger(valeur) || valeur < 0 || valeur > 10000)) {
      setV(initial);
      return onDone("Quota invalide : entier entre 0 et 10 000, ou vide pour le quota général.");
    }
    const r = await adminPost({ type: "quota_client", id: u.id, valeur });
    if (!r.ok) setV(initial);
    onDone(r.ok ? (valeur === null ? `${u.name} : quota général.` : `${u.name} : ${valeur} questions par compteur et par mois.`) : "Modification impossible.");
  }
  return (
    <label className="inp" style={{ minHeight: 38, width: 92, padding: "0 10px" }}>
      <input
        inputMode="numeric"
        value={v}
        placeholder="Général"
        aria-label={`Quota IA de ${u.name}`}
        disabled={!live}
        onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        style={{ fontSize: 14, width: "100%" }}
      />
    </label>
  );
}

export default function Utilisateurs() {
  const [f, setF] = useState<F>("tous");
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const { data, live, reload } = useAdmin<AdminUser[]>("users");
  const all = live ? data ?? [] : live === false ? sampleUsers() : [];
  const list = all.filter((u) => (f === "tous" || (f === "VIP" ? u.vip : u.status === f)) && `${u.name} ${u.email ?? ""} ${u.phone}`.toLowerCase().includes(q.toLowerCase()));
  const done = (m: string) => {
    setToast(m);
    void reload();
    window.setTimeout(() => setToast(null), 4000);
  };
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row wrapf" style={{ padding: "16px 20px", gap: 12 }}>
        <b className="h3">{list.length} utilisateur{list.length > 1 ? "s" : ""}</b>
        <SourceBadge live={live} />
        <span className="sp" />
        <Seg<F> label="Statut" style={{ width: 460, maxWidth: "100%" }} value={f} onChange={setF} options={[{ value: "tous", label: "Tous" }, { value: "Actif", label: "Actifs" }, { value: "Essai", label: "Essais" }, { value: "Expiré", label: "Expirés" }, { value: "VIP", label: "VIP" }]} />
        <label className="inp" style={{ minHeight: 44, width: 220 }}><Icon name="search" size="s" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou e-mail" aria-label="Rechercher un utilisateur" style={{ fontSize: 15 }} /></label>
      </div>
      {toast && <div className="badge b-ok" role="status" style={{ margin: "0 20px 12px" }}>{toast}</div>}
      <div className="scr">
        <table className="tbl" style={{ minWidth: 1220 }}>
          <thead><tr><th>Utilisateur</th><th>E-mail</th><th>Connexion</th><th>WhatsApp</th><th className="n">Compteurs</th><th className="n">Relevés</th><th>Offre</th><th>VIP</th><th>Quota IA</th><th>Inscrit</th><th>Dernière visite</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--mut)", padding: 28 }}>{live === null ? "Chargement…" : "Aucun utilisateur."}</td></tr>}
            {list.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td><td>{u.email ?? "—"}</td><td>{u.method ?? "—"}</td><td>{u.phone}</td><td className="n">{u.meters}</td><td className="n">{u.readings}</td>
                <td><span className={`badge ${u.vip ? "b-ia" : u.status === "Actif" ? "b-ok" : u.status === "Essai" ? "b-trial" : "b-risk"}`}>{u.pack}</span></td>
                <td><VipToggle u={u} live={live} onDone={done} /></td>
                <td><QuotaCell u={u} live={live} onDone={done} /></td>
                <td>{u.createdAt ? ago(u.createdAt) : "—"}</td><td>{live ? ago(u.lastSeen) : u.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="xs mut" style={{ padding: "12px 20px" }}>VIP : accès à Woly Elec IA offert, sans paiement. Quota IA : questions par compteur et par mois pour ce client ; laissez vide pour appliquer le quota général (réglable dans Assistant IA). Numéros masqués : l&apos;accès complet aux données personnelles est réservé aux demandes de support tracées.</p>
    </div>
  );
}
