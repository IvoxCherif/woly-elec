"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { Seg } from "./ui";
import { catchInstallPrompt, detectPlatform, useInstallPrompt, type Platform } from "@/lib/install";

/** Capte la proposition d'installation d'Android dès l'ouverture du site (rendu nul). */
export function InstallCatcher() {
  useEffect(() => catchInstallPrompt(), []);
  return null;
}

type Tab = "android" | "iphone";

function Steps({ title, icon, steps, note }: { title: string; icon: string; steps: React.ReactNode[]; note?: React.ReactNode }) {
  return (
    <div className="card col" style={{ gap: 14 }}>
      <div className="row" style={{ gap: 10 }}>
        <span className="avatar" style={{ background: "var(--g9)", color: "var(--yel)" }}><Icon name={icon} size="s" /></span>
        <b className="h3">{title}</b>
      </div>
      <ol className="col" style={{ gap: 12, margin: 0, padding: 0, listStyle: "none", counterReset: "step" }}>
        {steps.map((s, i) => (
          <li key={i} className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <span className="avatar" style={{ width: 28, height: 28, minWidth: 28, fontSize: 14, background: "var(--blue1)", color: "var(--blue)", fontWeight: 800 }}>{i + 1}</span>
            <span className="sm ink" style={{ paddingTop: 4 }}>{s}</span>
          </li>
        ))}
      </ol>
      {note && <div className="xs mut" style={{ background: "var(--g1)", borderRadius: 10, padding: "10px 12px" }}>{note}</div>}
    </div>
  );
}

/**
 * Guide pas à pas : ajouter Woly Elec sur l'écran d'accueil et activer les notifications, Android et iPhone.
 * L'onglet du téléphone utilisé est ouvert automatiquement.
 */
export function InstallGuide({ inApp = false }: { inApp?: boolean }) {
  const [tab, setTab] = useState<Tab>("android");
  const [platform, setPlatform] = useState<Platform>("autre");
  const { canInstall, installed, install } = useInstallPrompt();
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);
    if (p === "iphone") setTab("iphone");
  }, []);

  const alertes = inApp ? "Alertes" : "Alertes (une fois connecté)";

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row wrapf" style={{ gap: 12 }}>
        <Seg<Tab> label="Type de téléphone" style={{ width: 340, maxWidth: "100%" }} value={tab} onChange={setTab} options={[{ value: "android", label: "Android" }, { value: "iphone", label: "iPhone" }]} />
        {platform !== "autre" && <span className="xs mut">Votre téléphone : {platform === "iphone" ? "iPhone" : "Android"}</span>}
      </div>

      {installed ? (
        <div className="alert al-ok" role="status">
          <span className="ai"><Icon name="check" size="s" /></span>
          <div style={{ flex: 1 }}><b>Woly Elec est installé sur ce téléphone</b>Il ne reste qu&apos;à activer les notifications (étape 2).</div>
        </div>
      ) : (
        tab === "android" &&
        canInstall && (
          <div className="alert al-info" role="note">
            <span className="ai"><Icon name="download" size="s" /></span>
            <div style={{ flex: 1 }}><b>Installation en un geste</b>Votre téléphone peut installer Woly Elec directement.</div>
            <button
              type="button"
              className="btn btn-blue btn-sm"
              onClick={async () => setMsg((await install()) ? "Woly Elec est installé : retrouvez l'icône sur votre écran d'accueil." : "Installation annulée.")}
            >
              Installer l&apos;application
            </button>
          </div>
        )
      )}
      {msg && <p className="sm" role="status">{msg}</p>}

      {tab === "android" ? (
        <div className="grid2" style={{ alignItems: "start" }}>
          <Steps
            title="1. Ajouter l'icône sur l'écran d'accueil"
            icon="download"
            steps={[
              <>Ouvrez <b>wolyelec.com</b> dans <b>Chrome</b>.</>,
              <>Touchez le bouton <b>« Installer l&apos;application »</b> ci-dessus s&apos;il apparaît. Sinon, touchez le menu <b>⋮</b> en haut à droite.</>,
              <>Choisissez <b>« Installer l&apos;application »</b> ou <b>« Ajouter à l&apos;écran d&apos;accueil »</b>.</>,
              <>Confirmez avec <b>« Installer »</b> : l&apos;icône Woly Elec (logo vert et jaune) apparaît sur votre écran d&apos;accueil.</>,
            ]}
            note={<>Vous voyez une icône avec une simple lettre (par exemple « T ») ? Elle a été ajoutée avant notre mise à jour : supprimez-la (appui long → Supprimer), puis ajoutez-la à nouveau.</>}
          />
          <Steps
            title="2. Activer les notifications"
            icon="bell"
            steps={[
              <>Ouvrez Woly Elec depuis l&apos;icône et connectez-vous.</>,
              <>Allez dans <b>{alertes}</b> et touchez <b>« Activer les notifications »</b>.</>,
              <>Touchez <b>« Autoriser »</b> quand le téléphone le demande.</>,
              <>Touchez <b>« Envoyer un test »</b> : une notification Woly Elec arrive en quelques secondes.</>,
            ]}
            note={<>Notifications bloquées ? Ouvrez les <b>Paramètres</b> du téléphone → <b>Applications</b> → <b>Woly Elec</b> (ou <b>Chrome</b>) → <b>Notifications</b> → activez-les. Vérifiez aussi que le mode « Ne pas déranger » est coupé.</>}
          />
        </div>
      ) : (
        <div className="grid2" style={{ alignItems: "start" }}>
          <Steps
            title="1. Ajouter l'icône sur l'écran d'accueil"
            icon="download"
            steps={[
              <>Ouvrez <b>wolyelec.com</b> dans <b>Safari</b> (pas dans Chrome ni dans une autre application).</>,
              <>Touchez le bouton <b>Partager</b> : le carré avec une flèche vers le haut, en bas de l&apos;écran.</>,
              <>Faites défiler et touchez <b>« Sur l&apos;écran d&apos;accueil »</b>.</>,
              <>Touchez <b>« Ajouter »</b> en haut à droite : l&apos;icône Woly Elec apparaît sur votre écran d&apos;accueil.</>,
            ]}
            note={<>Il faut un iPhone à jour (iOS 16.4 ou plus récent). Pour vérifier : Réglages → Général → Informations → Version d&apos;iOS.</>}
          />
          <Steps
            title="2. Activer les notifications"
            icon="bell"
            steps={[
              <><b>Ouvrez Woly Elec depuis l&apos;icône</b> de l&apos;écran d&apos;accueil (obligatoire sur iPhone : les notifications ne marchent pas depuis Safari).</>,
              <>Connectez-vous, puis allez dans <b>{alertes}</b>.</>,
              <>Touchez <b>« Activer les notifications »</b>, puis <b>« Autoriser »</b>.</>,
              <>Touchez <b>« Envoyer un test »</b> pour vérifier.</>,
            ]}
            note={<>Notifications bloquées ? Ouvrez <b>Réglages</b> → <b>Notifications</b> → <b>Woly Elec</b> → activez <b>« Autoriser les notifications »</b>. Vérifiez aussi que le mode <b>Concentration</b> est coupé.</>}
          />
        </div>
      )}

      <div className="card col" style={{ gap: 8 }}>
        <b className="h4">Ce que vous recevrez</b>
        <div className="tick sm"><Icon name="bolt" size="s" /><span><b>Alertes avant coupure</b> : 5, 3 et 1 jour avant l&apos;épuisement de votre crédit.</span></div>
        <div className="tick sm"><Icon name="check" size="s" /><span><b>Paiement reçu</b> dès que votre abonnement est payé.</span></div>
        <div className="tick sm"><Icon name="card" size="s" /><span><b>Rappels de renouvellement</b> avant la fin de votre abonnement.</span></div>
        <div className="tick sm"><Icon name="trend" size="s" /><span><b>Bilan de la semaine</b> chaque lundi : consommation, autonomie et montant conseillé.</span></div>
      </div>
    </div>
  );
}
