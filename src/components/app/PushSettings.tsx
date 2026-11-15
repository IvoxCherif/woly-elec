"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../Icon";
import { disablePush, enablePush, pushState, testPush, type PushState } from "@/lib/push";
import { useStore } from "@/lib/store";

const TEXT: Record<PushState, string> = {
  actif: "Activées sur ce téléphone.",
  inactif: "Pas encore activées sur ce téléphone.",
  bloque: "Bloquées par le navigateur. Autorisez les notifications pour wolyelec.com dans les réglages du navigateur (icône du cadenas à côté de l'adresse), puis revenez ici.",
  iphone_installer: "Sur iPhone : touchez le bouton Partager, puis « Sur l'écran d'accueil ». Ouvrez ensuite Woly Elec depuis l'icône et activez les notifications ici.",
  indisponible: "Ce navigateur ne prend pas en charge les notifications. Utilisez Chrome sur Android, ou Safari sur iPhone avec l'application ajoutée à l'écran d'accueil.",
};

/** Activation des notifications push sur l'appareil en cours (compte réel uniquement). */
export function PushSettings({ compact = false }: { compact?: boolean }) {
  const { mode, notify, state, updateUser } = useStore();
  const [s, setS] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setS);
  }, []);

  if (mode !== "server" || s === null) return null;

  async function on() {
    setBusy(true);
    try {
      const next = await enablePush();
      setS(next);
      if (next === "actif") {
        if (!state.user.channels.push) updateUser({ channels: { ...state.user.channels, push: true } });
        notify("Notifications activées sur ce téléphone");
      }
    } catch {
      notify("Activation impossible, réessayez dans un instant");
    }
    setBusy(false);
  }

  async function off() {
    setBusy(true);
    setS(await disablePush());
    setBusy(false);
    notify("Notifications désactivées sur ce téléphone");
  }

  async function test() {
    setBusy(true);
    const n = await testPush();
    setBusy(false);
    notify(n > 0 ? "Notification de test envoyée" : n === 0 ? "Aucun appareil abonné : réactivez les notifications" : "Envoi impossible, réessayez plus tard");
  }

  if (compact) {
    if (s === "iphone_installer")
      return (
        <div className="alert al-info no-print" role="note">
          <span className="ai"><Icon name="bell" size="s" /></span>
          <div className="fx1">
            <b>Recevez vos alertes sur votre iPhone</b>
            Ajoutez d&apos;abord Woly Elec sur l&apos;écran d&apos;accueil, puis activez les notifications.
          </div>
          <Link className="btn btn-blue btn-sm" href="/app/installer">Voir comment</Link>
        </div>
      );
    if (s !== "inactif") return null;
    return (
      <div className="alert al-info no-print" role="note">
        <span className="ai"><Icon name="bell" size="s" /></span>
        <div className="fx1">
          <b>Recevez vos alertes sur ce téléphone</b>
          Coupure proche, paiement reçu : soyez prévenu, même application fermée.
        </div>
        <button type="button" className="btn btn-blue btn-sm" onClick={on} disabled={busy}>Activer</button>
        <Link className="btn btn-ghost btn-sm" href="/app/installer">Aide</Link>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10, padding: "12px 0", borderBottom: "1px solid var(--ln)" }}>
      <div className="row" style={{ gap: 10 }}>
        <div className="fx1">
          <b className="ink sm">Notifications push sur ce téléphone</b>
          <div className="xs mut">{TEXT[s]}</div>
        </div>
        {s === "actif" ? <span className="badge b-ok">Activées</span> : s === "inactif" ? null : <span className="badge b-warn">Action requise</span>}
      </div>
      <div className="row wrapf" style={{ gap: 8 }}>
        {s === "inactif" && <button type="button" className="btn btn-blue btn-sm" onClick={on} disabled={busy}><Icon name="bell" size="s" /> Activer les notifications</button>}
        <Link className="btn btn-ghost btn-sm" href="/app/installer">Comment faire sur Android et iPhone ?</Link>
        {s === "actif" && (
          <>
            <button type="button" className="btn btn-line btn-sm" onClick={test} disabled={busy}>Envoyer un test</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={off} disabled={busy}>Désactiver sur ce téléphone</button>
          </>
        )}
      </div>
    </div>
  );
}
