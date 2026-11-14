"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Seg } from "@/components/ui";
import { sampleUsers, type AdminRow as AdminUser } from "../data";
import { ago, SourceBadge, useAdmin } from "../useAdmin";

type F = "tous" | "Actif" | "Essai" | "Expiré";
export default function Utilisateurs() {
  const [f, setF] = useState<F>("tous");
  const [q, setQ] = useState("");
  const { data, live } = useAdmin<AdminUser[]>("users");
  const all = live ? data ?? [] : live === false ? sampleUsers() : [];
  const list = all.filter((u) => (f === "tous" || u.status === f) && `${u.name} ${u.email ?? ""} ${u.phone}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div className="row wrapf" style={{ padding: "16px 20px", gap: 12 }}>
        <b className="h3">{list.length} utilisateur{list.length > 1 ? "s" : ""}</b>
        <SourceBadge live={live} />
        <span className="sp" />
        <Seg<F> label="Statut" style={{ width: 380, maxWidth: "100%" }} value={f} onChange={setF} options={[{ value: "tous", label: "Tous" }, { value: "Actif", label: "Actifs" }, { value: "Essai", label: "Essais" }, { value: "Expiré", label: "Expirés" }]} />
        <label className="inp" style={{ minHeight: 44, width: 220 }}><Icon name="search" size="s" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou e-mail" aria-label="Rechercher un utilisateur" style={{ fontSize: 15 }} /></label>
      </div>
      <div className="scr">
        <table className="tbl" style={{ minWidth: 1040 }}>
          <thead><tr><th>Utilisateur</th><th>E-mail</th><th>Connexion</th><th>WhatsApp</th><th className="n">Compteurs</th><th className="n">Relevés</th><th>Offre</th><th>Inscrit</th><th>Dernière visite</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--mut)", padding: 28 }}>{live === null ? "Chargement…" : "Aucun utilisateur."}</td></tr>}
            {list.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td><td>{u.email ?? "—"}</td><td>{u.method ?? "—"}</td><td>{u.phone}</td><td className="n">{u.meters}</td><td className="n">{u.readings}</td>
                <td><span className={`badge ${u.status === "Actif" ? "b-ok" : u.status === "Essai" ? "b-trial" : "b-risk"}`}>{u.pack}</span></td>
                <td>{u.createdAt ? ago(u.createdAt) : "—"}</td><td>{live ? ago(u.lastSeen) : u.lastSeen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="xs mut" style={{ padding: "12px 20px" }}>Numéros masqués : l&apos;accès complet aux données personnelles est réservé aux demandes de support tracées.</p>
    </div>
  );
}
