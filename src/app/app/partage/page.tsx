"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Callout, Seg, TextField } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useStore } from "@/lib/store";

type Role = "consulter" | "gerer";
type Member = { id: string; email: string; nom: string; role: Role; compteurIds: string[] | null; statut: "invite" | "actif" | "expire"; createdAt: string };
type Access = { id: string; titulaireId: string; titulaire: string; role: Role; statut: "invite" | "actif"; tous: boolean };
type ReadLink = { id: number; compteurId: string; token: string; vues: number };
type Data = { limite: number; compteurs: { id: string; nom: string; numero: string }[]; membres: Member[]; acces: Access[]; liens: ReadLink[] };

const ERR: Record<string, string> = {
  email_invalide: "Adresse e-mail invalide.",
  invitation_soi_meme: "Vous ne pouvez pas vous inviter vous-même.",
  limite_partage: "Nombre maximum de personnes atteint pour votre offre : retirez un accès ou passez à Woly Elec IA.",
  abonnement_requis: "Le partage demande un essai ou un abonnement actif.",
  compteurs_invalides: "Choisissez au moins un compteur.",
  invitation_invalide: "Cette invitation n'est plus valable.",
  trop_de_requetes: "Trop d'invitations envoyées : réessayez dans une heure.",
};
const ROLE_TXT: Record<Role, string> = { consulter: "Consulter", gerer: "Gérer les relevés" };

async function call(body: unknown) {
  const r = await fetch("/api/partage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, data: await r.json().catch(() => ({})) };
}

export default function Partage() {
  const { mode, state, notify } = useStore();
  const [data, setData] = useState<Data | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("consulter");
  const [tous, setTous] = useState(true);
  const [choix, setChoix] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/partage", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setData((await r.json()) as Data);
  }, []);
  useEffect(() => {
    if (mode === "server") void load();
  }, [mode, load]);

  if (mode !== "server")
    return (
      <Callout tone="info" title="Partager votre compte">
        Créez votre compte pour inviter votre famille ou vos locataires à suivre l&apos;électricité.{" "}
        <Link href="/inscription" style={{ fontWeight: 700 }}>Créer mon compte</Link>
      </Callout>
    );
  if (!data) return <div className="skel" style={{ height: 320 }} aria-busy="true" />;

  const owner = data.compteurs.length > 0;
  const used = data.membres.length;
  const viewingShared = state.access && state.access.role !== "titulaire";

  async function run(body: unknown, ok: string, after?: () => void) {
    setBusy(true);
    setMsg(null);
    const r = await call(body);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: ERR[r.data.error] ?? "Action impossible, réessayez." });
    if (r.data.membres) setData(r.data as Data);
    else void load();
    setMsg({ ok: true, text: ok });
    after?.();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!tous && !choix.length) return setMsg({ ok: false, text: ERR.compteurs_invalides });
    await run({ action: "inviter", email, role, compteurIds: tous ? null : choix }, `Invitation envoyée à ${email.trim().toLowerCase()} : elle est valable 7 jours.`, () => {
      setEmail("");
      setChoix([]);
    });
  }

  const metersTxt = (ids: string[] | null) =>
    ids === null ? "Tous les compteurs" : data.compteurs.filter((m) => ids.includes(m.id)).map((m) => m.nom).join(", ") || "—";
  const linkUrl = (token: string) => `${window.location.origin}/c/${token}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      notify("Lien copié");
    } catch {
      window.prompt("Copiez le lien :", text);
    }
  }

  return (
    <div className="stack">
      {msg && <Callout tone={msg.ok ? "ok" : "red"} title={msg.ok ? "C'est fait" : "Oups"}>{msg.text}</Callout>}

      {/* Comptes que d'autres personnes partagent avec moi */}
      {data.acces.length > 0 && (
        <div className="card col" style={{ gap: 12 }}>
          <b className="h3">Comptes partagés avec moi</b>
          {data.acces.map((a) => (
            <div key={a.id} className="row wrapf" style={{ gap: 10, padding: "10px 0", borderTop: "1px solid var(--ln)" }}>
              <span className="avatar b"><Icon name="users" size="s" /></span>
              <div className="fx1">
                <b className="sm ink">{a.titulaire}</b>
                <div className="xs mut">{ROLE_TXT[a.role]} · {a.tous ? "tous ses compteurs" : "certains compteurs"}</div>
              </div>
              {a.statut === "invite" ? (
                <>
                  <button type="button" className="btn btn-blue btn-sm" disabled={busy} onClick={() => void run({ action: "accepter", id: a.id }, "Invitation acceptée.", () => window.location.assign("/app"))}>Accepter</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run({ action: "refuser", id: a.id }, "Invitation refusée.")}>Refuser</button>
                </>
              ) : (
                <>
                  {state.access?.accountId !== a.titulaireId && (
                    <button type="button" className="btn btn-blue btn-sm" disabled={busy} onClick={() => void run({ action: "compte", id: a.titulaireId }, "", () => window.location.assign("/app"))}>Ouvrir</button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => window.confirm(`Ne plus suivre le compte de ${a.titulaire} ?`) && void run({ action: "quitter", id: a.titulaireId }, "Vous ne suivez plus ce compte.", () => window.location.assign("/app"))}
                  >
                    Quitter
                  </button>
                </>
              )}
            </div>
          ))}
          {viewingShared && owner && (
            <button type="button" className="btn btn-line btn-sm" onClick={() => void run({ action: "compte", id: state.access?.accounts.find((x) => x.role === "titulaire")?.id }, "", () => window.location.assign("/app"))}>Revenir à mon compte</button>
          )}
        </div>
      )}

      {owner && !viewingShared && (
        <>
          <form className="card col" style={{ gap: 14 }} onSubmit={invite}>
            <div className="row" style={{ gap: 12 }}>
              <span className="avatar y"><Icon name="users" /></span>
              <div className="fx1">
                <b className="h3">Inviter une personne</b>
                <p className="sm mut">Famille, locataire, gérant : chacun garde ses propres identifiants et reçoit les alertes avant coupure sur son téléphone.</p>
              </div>
            </div>
            {data.limite === 0 ? (
              <Callout tone="warn" title="Abonnement nécessaire">Le partage est disponible pendant l&apos;essai et avec un abonnement actif. <Link href="/app/abonnement" style={{ fontWeight: 700 }}>Voir les offres</Link></Callout>
            ) : (
              <>
                <TextField label="Adresse e-mail de la personne" type="email" value={email} onChange={setEmail} placeholder="awa@exemple.com" autoComplete="off" />
                <div className="col" style={{ gap: 6 }}>
                  <span className="lbl">Ce qu&apos;elle peut faire</span>
                  <Seg<Role> label="Rôle" value={role} onChange={setRole} options={[{ value: "consulter", label: "Consulter" }, { value: "gerer", label: "Gérer les relevés" }]} />
                  <span className="xs mut">{role === "consulter" ? "Voir le crédit restant, le plan du mois et les alertes." : "En plus : faire les relevés et enregistrer les recharges."} Seul vous pouvez payer l&apos;abonnement et gérer les compteurs.</span>
                </div>
                {data.compteurs.length > 1 && (
                  <div className="col" style={{ gap: 6 }}>
                    <span className="lbl">Compteurs partagés</span>
                    <Seg<"tous" | "choix"> label="Compteurs" value={tous ? "tous" : "choix"} onChange={(v) => setTous(v === "tous")} options={[{ value: "tous", label: "Tous" }, { value: "choix", label: "Choisir" }]} />
                    {!tous && (
                      <div className="col" style={{ gap: 6 }}>
                        {data.compteurs.map((m) => (
                          <label key={m.id} className="row sm" style={{ gap: 10, minHeight: 40, cursor: "pointer" }}>
                            <input type="checkbox" checked={choix.includes(m.id)} onChange={(e) => setChoix((c) => (e.target.checked ? [...c, m.id] : c.filter((x) => x !== m.id)))} style={{ width: 20, height: 20 }} />
                            <span className="ink"><b>{m.nom}</b> <span className="mut">· {m.numero}</span></span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="row wrapf" style={{ gap: 10 }}>
                  <span className="xs mut">{used} / {data.limite} personne{data.limite > 1 ? "s" : ""} avec votre offre</span>
                  <span className="sp" />
                  <button type="submit" className="btn btn-blue" disabled={busy || !email || used >= data.limite}>
                    <Icon name="chat" size="s" /> Envoyer l&apos;invitation
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="card col" style={{ gap: 4 }}>
            <b className="h3" style={{ marginBottom: 6 }}>Personnes invitées</b>
            {data.membres.length === 0 ? (
              <p className="sm mut">Personne pour le moment.</p>
            ) : (
              data.membres.map((m) => (
                <div key={m.id} className="col" style={{ gap: 8, padding: "12px 0", borderTop: "1px solid var(--ln)" }}>
                  <div className="row wrapf" style={{ gap: 10 }}>
                    <span className="avatar">{(m.nom || m.email).slice(0, 2).toUpperCase()}</span>
                    <div className="fx1" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                      <b className="sm ink">{m.nom || m.email}</b>
                      <div className="xs mut">{m.nom ? `${m.email} · ` : ""}{metersTxt(m.compteurIds)}</div>
                    </div>
                    <span className={`badge ${m.statut === "actif" ? "b-ok" : m.statut === "expire" ? "b-risk" : "b-warn"}`}>{m.statut === "actif" ? "Active" : m.statut === "expire" ? "Invitation expirée" : "Invitation envoyée"}</span>
                  </div>
                  <div className="row wrapf" style={{ gap: 8, paddingLeft: 52 }}>
                    <select
                      className="btn btn-ghost btn-sm"
                      value={m.role}
                      aria-label={`Rôle de ${m.nom || m.email}`}
                      onChange={(e) => void run({ action: "modifier", id: m.id, role: e.target.value }, "Rôle mis à jour.")}
                      style={{ appearance: "auto" }}
                    >
                      <option value="consulter">Consulter</option>
                      <option value="gerer">Gérer les relevés</option>
                    </select>
                    {m.statut !== "actif" && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run({ action: "inviter", email: m.email, role: m.role, compteurIds: m.compteurIds }, "Invitation renvoyée.")}>Renvoyer</button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => window.confirm(`Retirer l'accès de ${m.nom || m.email} ?`) && void run({ action: "retirer", id: m.id }, "Accès retiré.")}
                    >
                      Retirer
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card col" style={{ gap: 4 }}>
            <b className="h3">Lien de lecture</b>
            <p className="sm mut" style={{ marginBottom: 6 }}>
              Un lien à envoyer par WhatsApp : il montre le crédit restant et la date de coupure prévue, sans compte. Toute personne qui a le lien peut le voir : désactivez-le quand vous voulez.
            </p>
            {data.compteurs.map((m) => {
              const l = data.liens.find((x) => x.compteurId === m.id);
              return (
                <div key={m.id} className="row wrapf" style={{ gap: 8, padding: "10px 0", borderTop: "1px solid var(--ln)" }}>
                  <div className="fx1">
                    <b className="sm ink">{m.nom}</b>
                    <div className="xs mut">{l ? `Lien actif · ${l.vues} vue${l.vues > 1 ? "s" : ""}` : "Aucun lien"}</div>
                  </div>
                  {l ? (
                    <>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void copy(linkUrl(l.token))}>Copier</button>
                      <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`Suivez l'électricité de « ${m.nom} » sur Woly Elec : ${linkUrl(l.token)}`)}`} target="_blank" rel="noreferrer">WhatsApp</a>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void run({ action: "lien_retirer", id: l.id }, "Lien désactivé : il ne fonctionne plus.")}>Désactiver</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-line btn-sm" disabled={busy || data.limite === 0} onClick={() => void run({ action: "lien", compteurId: m.id }, "Lien créé : copiez-le ou envoyez-le par WhatsApp.")}>Créer un lien</button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {!owner && data.acces.length === 0 && <Callout tone="info" title="Aucun compte partagé">Quand quelqu&apos;un vous invite, son invitation apparaît ici.</Callout>}
    </div>
  );
}
