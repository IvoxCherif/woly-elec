"use client";

import { useEffect, useState } from "react";
import { Callout, Switch } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { adminPushState, disableAdminPush, enableAdminPush, testAdminPush, type PushState } from "@/lib/push";
import { detectPlatform, isInstalled, useInstallPrompt } from "@/lib/install";

type Prefs = { inscription: boolean; paiement: boolean; support: boolean; loterie: boolean };
const LABELS: [keyof Prefs, string, string][] = [
  ["inscription", "Nouvel utilisateur", "À chaque création de compte (nom, e-mail, compteur, essai ou non)."],
  ["paiement", "Nouvel abonnement et renouvellement", "À chaque paiement SasPay confirmé, avec le montant."],
  ["support", "Demande de support ou réclamation", "À chaque nouveau message envoyé depuis l'application ou le site."],
  ["loterie", "Loterie", "Quand un gagnant a été prévenu de sa recharge."],
];

const STATE_TEXT: Record<PushState, string> = {
  actif: "Ce téléphone reçoit les notifications de l'administration.",
  inactif: "Ce téléphone ne reçoit pas encore les notifications.",
  bloque: "Notifications bloquées par le navigateur : autorisez-les pour wolyelec.com dans les réglages, puis revenez ici.",
  iphone_installer: "Sur iPhone, ajoutez d'abord l'application Admin à l'écran d'accueil (voir plus bas), puis ouvrez-la depuis l'icône.",
  indisponible: "Ce navigateur ne gère pas les notifications. Utilisez Chrome sur Android ou Safari sur iPhone.",
};

export default function AdminNotifications() {
  const [st, setSt] = useState<{ state: PushState; appareils: number } | null>(null);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [platform, setPlatform] = useState<"android" | "iphone" | "autre">("autre");
  const [installed, setInstalled] = useState(false);
  const { canInstall, install } = useInstallPrompt();

  async function refresh() {
    setSt(await adminPushState());
    const r = await fetch("/api/admin/push", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setPrefs(((await r.json()) as { prefs: Prefs }).prefs);
  }
  useEffect(() => {
    void refresh();
    setPlatform(detectPlatform());
    setInstalled(isInstalled());
  }, []);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
    } catch {
      setMsg({ ok: false, text: "Action impossible, réessayez." });
    }
    await refresh();
    setBusy(false);
  }

  async function savePref(k: keyof Prefs, v: boolean) {
    if (!prefs) return;
    setPrefs({ ...prefs, [k]: v });
    await fetch("/api/admin/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefs: { [k]: v } }) });
  }

  return (
    <div className="stack">
      <div className="card col" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <span className="avatar b"><Icon name="bell" /></span>
          <div className="fx1">
            <b className="h3">Notifications sur ce téléphone</b>
            <p className="sm mut">{st ? STATE_TEXT[st.state] : "Vérification…"}</p>
          </div>
          {st?.state === "actif" && <span className="badge b-ok">Activées</span>}
        </div>
        {st && <p className="xs mut">{st.appareils} téléphone{st.appareils > 1 ? "s" : ""} reçoi{st.appareils > 1 ? "vent" : "t"} les notifications de l&apos;administration.</p>}
        <div className="row wrapf" style={{ gap: 10 }}>
          {st?.state === "inactif" && (
            <button type="button" className="btn btn-blue" disabled={busy} onClick={() => void run(async () => { const s = await enableAdminPush(); if (s !== "actif") throw new Error(s); }, "Notifications activées sur ce téléphone.")}>
              <Icon name="bell" size="s" /> Activer sur ce téléphone
            </button>
          )}
          {st?.state === "actif" && (
            <>
              <button type="button" className="btn btn-line" disabled={busy} onClick={() => void run(async () => { if ((await testAdminPush()) < 1) throw new Error(); }, "Notification de test envoyée.")}>Envoyer un test</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run(disableAdminPush, "Ce téléphone ne recevra plus les notifications de l'administration.")}>Désactiver ici</button>
            </>
          )}
        </div>
        {msg && <p className={`sm ${msg.ok ? "cok" : "cr"}`} role="status" style={{ fontWeight: 600 }}>{msg.text}</p>}
      </div>

      <div className="card col" style={{ gap: 4 }}>
        <b className="h3" style={{ marginBottom: 8 }}>Ce que je veux recevoir</b>
        {!prefs ? (
          <div className="skel" style={{ height: 120 }} />
        ) : (
          LABELS.map(([k, label, hint]) => (
            <div key={k} className="row" style={{ gap: 12, padding: "10px 0", borderBottom: "1px solid var(--ln)" }}>
              <div className="fx1">
                <b className="sm ink">{label}</b>
                <div className="xs mut">{hint}</div>
              </div>
              <Switch checked={prefs[k]} onChange={(v) => void savePref(k, v)} label={label} />
            </div>
          ))
        )}
      </div>

      <div className="card col" style={{ gap: 12 }}>
        <b className="h3">Installer « WE Admin » sur mon téléphone</b>
        {installed ? (
          <Callout tone="ok" title="Application installée">Vous utilisez l&apos;application Admin depuis l&apos;écran d&apos;accueil.</Callout>
        ) : canInstall ? (
          <button type="button" className="btn btn-yel" onClick={() => void install()}><Icon name="download" size="s" /> Installer l&apos;application Admin</button>
        ) : null}
        {platform !== "iphone" ? (
          <ol className="sm" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>Ouvrez <b>wolyelec.com/admin</b> dans <b>Chrome</b> et connectez-vous.</li>
            <li>Touchez le menu <b>⋮</b> puis <b>« Installer l&apos;application »</b> (ou « Ajouter à l&apos;écran d&apos;accueil »).</li>
            <li>Ouvrez <b>WE Admin</b> depuis l&apos;icône, puis touchez <b>« Activer sur ce téléphone »</b> ci-dessus.</li>
          </ol>
        ) : (
          <ol className="sm" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li>Ouvrez <b>wolyelec.com/admin</b> dans <b>Safari</b>.</li>
            <li>Touchez <b>Partager</b> (carré avec une flèche) puis <b>« Sur l&apos;écran d&apos;accueil »</b> → <b>Ajouter</b>.</li>
            <li>Ouvrez <b>WE Admin</b> depuis l&apos;icône, connectez-vous, puis touchez <b>« Activer sur ce téléphone »</b>.</li>
          </ol>
        )}
        <p className="xs mut">L&apos;application Admin est séparée de l&apos;application client : vous pouvez avoir les deux icônes sur le même téléphone.</p>
      </div>
    </div>
  );
}
