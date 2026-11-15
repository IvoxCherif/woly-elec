"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Icon } from "../Icon";
import { Logo } from "../ui";
import { trialDaysLeft, useStore } from "@/lib/store";
import { PACKS } from "@/lib/pricing";
import { ReleveModal, RechargeModal } from "./Modals";
import { BackButton, parentOf } from "../BackButton";
import { MenuBackdrop, MenuButton, useMobileMenu } from "../MobileMenu";

const NAV = [
  { href: "/app", label: "Accueil", icon: "home" },
  { href: "/app/simulateur", label: "Simulateur", icon: "calc" },
  { href: "/app/plan", label: "Plan du mois", icon: "calendar" },
  { href: "/app/historique", label: "Historique", icon: "clock" },
  { href: "/app/compteurs", label: "Compteurs", icon: "building" },
  { href: "/app/appareils", label: "Appareils", icon: "plug" },
  { href: "/app/alertes", label: "Alertes", icon: "bell" },
  { href: "/app/assistant", label: "Assistant IA", icon: "sparkle" },
];
const NAV2 = [
  { href: "/app/abonnement", label: "Abonnement", icon: "card" },
  { href: "/app/profil", label: "Profil", icon: "user" },
  { href: "/app/support", label: "Support", icon: "chat" },
  { href: "/app/installer", label: "Installer l'app", icon: "download" },
];

// Barre du bas sur téléphone (le reste est dans le menu)
const TABS = [
  { href: "/app", label: "Accueil", icon: "home" },
  { href: "/app/plan", label: "Plan", icon: "calendar" },
  { href: "/app/alertes", label: "Alertes", icon: "bell" },
];

const TITLES: Record<string, string> = {
  "/app/simulateur": "Simulateur de recharge",
  "/app/plan": "Plan du mois",
  "/app/historique": "Historique",
  "/app/bilan": "Bilan mensuel",
  "/app/compteurs": "Mes compteurs",
  "/app/appareils": "Appareils",
  "/app/alertes": "Alertes",
  "/app/assistant": "Assistant IA",
  "/app/abonnement": "Mon abonnement",
  "/app/abonnement/paiement": "Paiement",
  "/app/profil": "Profil",
  "/app/support": "Support et réclamations",
  "/app/installer": "Installer l'application et activer les notifications",
};

type UI = { openReleve: () => void; openRecharge: () => void };
const UICtx = createContext<UI>({ openReleve: () => {}, openRecharge: () => {} });
export const useAppUI = () => useContext(UICtx);

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { state, ready, today, meter, selectMeter, toasts, mode } = useStore();
  const menu = useMobileMenu();
  const [releve, setReleve] = useState(false);
  const [recharge, setRecharge] = useState(false);
  const openReleve = useCallback(() => setReleve(true), []);
  const openRecharge = useCallback(() => setRecharge(true), []);
  const sub = state.subscription;
  const unread = state.alerts.filter((a) => !a.read).length;
  const left = trialDaysLeft(state, today);
  // Jours restants avant la fin de l'abonnement payé (bandeau de renouvellement à 7 jours ou moins)
  const subLeft =
    sub.status === "actif" && !sub.vip && sub.renewsAt ? Math.round((Date.parse(`${sub.renewsAt}T00:00:00`) - new Date(today).setHours(0, 0, 0, 0)) / 86400000) : null;
  const renewSoon = subLeft !== null && subLeft <= 7 && subLeft >= 0 && !state.pendingPayment && !path.startsWith("/app/abonnement");

  // essai terminé sans abonnement → écran de fin d'essai (sauf pages d'abonnement)
  useEffect(() => {
    if (!ready) return;
    const expired = sub.status === "expire" || (sub.status === "essai" && left === 0);
    if (expired && !path.startsWith("/app/abonnement") && path !== "/app/fin-essai" && path !== "/app/profil") router.replace("/app/fin-essai");
  }, [ready, sub.status, left, path, router]);

  const title = path === "/app" ? `Bonjour ${state.user.name}` : TITLES[path] ?? "Woly Elec";
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  return (
    <UICtx.Provider value={{ openReleve, openRecharge }}>
      <div className="app has-tabs">
        <MenuBackdrop open={menu.open} onClose={menu.close} />
        <aside id="menu-app" className={`side${menu.open ? " open" : ""}`} aria-label="Menu de l'application">
          <div className="brand row" style={{ padding: "6px 10px 20px" }}>
            <Logo dark size={38} href="/" />
            <span className="sp" />
            <span className="only-m"><MenuButton open dark onClick={menu.close} controls="menu-app" /></span>
          </div>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
              {n.href === "/app/alertes" && unread > 0 && (
                <span className="badge b-risk" style={{ marginLeft: "auto", height: 22 }} aria-label={`${unread} non lues`}>
                  {unread}
                </span>
              )}
            </Link>
          ))}
          <div className="sep" />
          {NAV2.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
          <span style={{ flex: 1 }} />
          <div className="trial" style={{ background: "rgba(255,255,255,.08)", borderRadius: 14, padding: 14, color: "#cfe3d8", fontSize: 14, lineHeight: 1.4 }}>
            {sub.status === "essai" ? (
              <>
                <b style={{ color: "#FACC15", fontFamily: "Montserrat" }}>Essai gratuit</b>
                <br />
                {left} jour{left > 1 ? "s" : ""} restant{left > 1 ? "s" : ""}
                <br />
                <span style={{ fontSize: 13, color: "#9CC4B0" }}>1 compteur inclus</span>
              </>
            ) : sub.status === "actif" ? (
              <>
                <b style={{ color: "#FACC15", fontFamily: "Montserrat" }}>{PACKS[sub.pack].name}</b>
                <br />
                {state.meters.length} compteur{state.meters.length > 1 ? "s" : ""}
                <br />
                <span style={{ fontSize: 13, color: "#9CC4B0" }}>Abonnement actif</span>
              </>
            ) : (
              <>
                <b style={{ color: "#FACC15", fontFamily: "Montserrat" }}>Essai terminé</b>
                <br />
                <Link href="/app/abonnement/paiement" style={{ color: "#fff", padding: 0, minHeight: 0, display: "inline" }}>
                  Me réabonner
                </Link>
              </>
            )}
          </div>
        </aside>
        <main id="contenu">
          <div className="topbar">
            <span className="only-m"><MenuButton open={menu.open} onClick={menu.toggle} controls="menu-app" /></span>
            {path !== "/app" && <BackButton fallback={parentOf(path)} compact />}
            <h1 className="mont ink topbar-title" style={{ fontWeight: 800, fontSize: 22 }}>
              {title}
            </h1>
            {path === "/app/compteurs" && sub.status === "actif" && (
              <span className="badge b-ia">
                {PACKS[sub.pack].name} · {state.meters.length} compteurs
              </span>
            )}
            <span className="sp" />
            {state.meters.length > 0 && (
              <label className="sel topbar-meter" style={{ position: "relative" }}>
                <Icon name="plug" size="s" />
                <span className="sr" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                  Compteur affiché
                </span>
                <select
                  value={meter?.id}
                  onChange={(e) => selectMeter(e.target.value)}
                  style={{ border: 0, background: "transparent", font: "600 15px Inter", color: "var(--g9)", outline: 0, cursor: "pointer", maxWidth: 220 }}
                >
                  {state.meters.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="button" className="btn btn-blue btn-sm hide-m" onClick={openReleve}>
              <Icon name="plus" size="s" />
              Nouveau relevé
            </button>
            <Link href="/app/profil" className="avatar" style={{ background: "var(--g9)", color: "var(--yel)", textDecoration: "none" }} aria-label="Mon profil">
              {state.user.initials}
            </Link>
          </div>
          <div className="pad">
            {ready && renewSoon && (
              <div className={`alert ${subLeft! <= 1 ? "al-red" : "al-warn"} no-print`} role="status">
                <span className="ai"><Icon name="card" size="s" /></span>
                <div className="fx1">
                  <b>{subLeft === 0 ? "Votre abonnement se termine aujourd'hui" : subLeft === 1 ? "Votre abonnement se termine demain" : `Votre abonnement se termine dans ${subLeft} jours`}</b>
                  Renouvelez-le pour garder vos alertes avant coupure et votre montant exact.
                </div>
                <Link className="btn btn-yel btn-sm" href="/app/abonnement/paiement">Renouveler</Link>
              </div>
            )}
            {ready && mode === "demo" && (
              <div className="alert al-info no-print" role="note">
                <span className="ai"><Icon name="info" size="s" /></span>
                <div className="fx1">
                  <b>Mode démonstration</b>
                  Ces données sont fictives et restent dans ce navigateur.{" "}
                  <Link href="/inscription" style={{ fontWeight: 700 }}>Créer mon compte</Link> ou <Link href="/connexion" style={{ fontWeight: 700 }}>me connecter</Link> pour suivre mon vrai compteur.
                </div>
              </div>
            )}
            {ready ? children : <Loading />}
          </div>
        </main>
        <nav className="tabbar no-print" aria-label="Navigation rapide">
          <TabLink t={TABS[0]} active={isActive(TABS[0].href)} />
          <TabLink t={TABS[1]} active={isActive(TABS[1].href)} />
          <button type="button" className="tb-main" onClick={openReleve} aria-label="Nouveau relevé">
            <span className="tb-ic"><Icon name="plus" /></span>
            Relevé
          </button>
          <TabLink t={TABS[2]} active={isActive(TABS[2].href)} badge={unread} />
          <button type="button" onClick={menu.toggle} aria-expanded={menu.open} aria-controls="menu-app">
            <span className="tb-ic"><Icon name="menu" /></span>
            Menu
          </button>
        </nav>
      </div>
      {ready && meter && (
        <>
          <ReleveModal open={releve} onClose={() => setReleve(false)} onRecharge={() => { setReleve(false); setRecharge(true); }} />
          <RechargeModal open={recharge} onClose={() => setRecharge(false)} />
        </>
      )}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <Icon name="check" size="s" />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </UICtx.Provider>
  );
}

function TabLink({ t, active, badge = 0 }: { t: (typeof TABS)[number]; active: boolean; badge?: number }) {
  return (
    <Link href={t.href} aria-current={active ? "page" : undefined}>
      <span className="tb-ic">
        <Icon name={t.icon} />
        {badge > 0 && <span className="tb-pip" aria-label={`${badge} non lues`}>{badge > 9 ? "9+" : badge}</span>}
      </span>
      {t.label}
    </Link>
  );
}

function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-label="Chargement">
      <div className="skel" style={{ height: 280 }} />
      <div className="grid2">
        <div className="skel" style={{ height: 200 }} />
        <div className="skel" style={{ height: 200 }} />
      </div>
    </div>
  );
}
