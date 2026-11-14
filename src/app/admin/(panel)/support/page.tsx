"use client";

import { useState } from "react";
import { Seg } from "@/components/ui";
import { adminPost, SourceBadge, useAdmin } from "../useAdmin";

type Demande = { id: number; reference: string; clientId: string | null; nom: string; email: string; categorie: string; sujet: string; message: string; statut: string; createdAt: string };
type F = "ouvert" | "en_cours" | "resolu" | "tous";

const CAT: Record<string, string> = { question: "Question", reclamation: "Réclamation", technique: "Technique", paiement: "Paiement", compte: "Compte" };
const ST: Record<string, { label: string; badge: string }> = {
  ouvert: { label: "Ouvert", badge: "b-risk" },
  en_cours: { label: "En cours", badge: "b-warn" },
  resolu: { label: "Résolu", badge: "b-ok" },
};

export default function SupportAdmin() {
  const [f, setF] = useState<F>("ouvert");
  const [open, setOpen] = useState<number | null>(null);
  const { data, live, reload } = useAdmin<Demande[]>("support");
  const all = data ?? [];
  const list = all.filter((d) => f === "tous" || d.statut === f);
  const count = (s: string) => all.filter((d) => d.statut === s).length;

  async function setStatut(id: number, statut: string) {
    const r = await adminPost({ type: "support", id, statut });
    if (r.ok) void reload();
  }

  return (
    <>
      <div className="row wrapf" style={{ gap: 12 }}>
        <SourceBadge live={live} />
        <span className="sp" />
        <a className="btn btn-line btn-sm" href="https://mail.hostinger.com" target="_blank" rel="noreferrer">Ouvrir la boîte support@wolyelec.com</a>
      </div>
      <div className="kpis">
        <div className="card kpi"><span className="lab">Ouvertes</span><span className="v cr">{count("ouvert")}</span><span className="xs mut">À traiter</span></div>
        <div className="card kpi"><span className="lab">En cours</span><span className="v" style={{ color: "#8A6A00" }}>{count("en_cours")}</span></div>
        <div className="card kpi"><span className="lab">Réclamations</span><span className="v">{all.filter((d) => d.categorie === "reclamation").length}</span><span className="xs mut">Toutes périodes</span></div>
        <div className="card kpi"><span className="lab">Résolues</span><span className="v" style={{ color: "var(--ok)" }}>{count("resolu")}</span></div>
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row wrapf" style={{ padding: "16px 20px", gap: 12 }}>
          <b className="h3">Demandes</b>
          <span className="sp" />
          <Seg<F> label="Statut" style={{ width: 420, maxWidth: "100%" }} value={f} onChange={setF} options={[{ value: "ouvert", label: "Ouvertes" }, { value: "en_cours", label: "En cours" }, { value: "resolu", label: "Résolues" }, { value: "tous", label: "Toutes" }]} />
        </div>
        {live === false && <p className="sm mut" style={{ padding: "0 20px 20px" }}>Base de données non configurée sur ce serveur.</p>}
        {live && list.length === 0 && <p className="sm mut" style={{ padding: "0 20px 24px" }}>Aucune demande.</p>}
        <div className="col" style={{ gap: 0 }}>
          {list.map((d) => (
            <div key={d.id} style={{ borderTop: "1px solid var(--ln)", padding: "14px 20px" }}>
              <button type="button" className="row wrapf" style={{ width: "100%", textAlign: "left", gap: 10 }} onClick={() => setOpen(open === d.id ? null : d.id)} aria-expanded={open === d.id}>
                <span className={`badge ${ST[d.statut]?.badge ?? "b-gr"}`}>{ST[d.statut]?.label ?? d.statut}</span>
                <span className={`badge ${d.categorie === "reclamation" ? "b-warn" : "b-gr"}`}>{CAT[d.categorie] ?? d.categorie}</span>
                <b className="ink" style={{ flex: "1 1 240px" }}>{d.sujet}</b>
                <span className="xs mut">{d.reference} · {d.nom || d.email} · {new Date(d.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </button>
              {open === d.id && (
                <div className="col" style={{ gap: 12, marginTop: 12 }}>
                  <div style={{ whiteSpace: "pre-wrap", background: "var(--bg)", borderRadius: 12, padding: 14, fontSize: 15 }}>{d.message}</div>
                  <div className="row wrapf" style={{ gap: 10 }}>
                    <a className="btn btn-blue btn-sm" href={`mailto:${d.email}?subject=${encodeURIComponent(`[${d.reference}] ${d.sujet}`)}`}>Répondre à {d.email}</a>
                    {d.statut !== "en_cours" && <button type="button" className="btn btn-line btn-sm" onClick={() => setStatut(d.id, "en_cours")}>Marquer en cours</button>}
                    {d.statut !== "resolu" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatut(d.id, "resolu")}>Marquer résolue</button>}
                    {d.statut === "resolu" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatut(d.id, "ouvert")}>Rouvrir</button>}
                    <span className="xs mut">{d.clientId ? "Client inscrit" : "Visiteur (sans compte)"}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
