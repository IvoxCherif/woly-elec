"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/ui";
import { BackButton } from "@/components/BackButton";
import { MenuBackdrop, MenuButton, useMobileMenu } from "@/components/MobileMenu";
import { Splash } from "@/components/app/Splash";
import { useEffect, useState } from "react";
import { ADMIN_UNLOCK } from "@/lib/admin-unlock";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: "home", title: "Vue d'ensemble" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "users", title: "Utilisateurs" },
  { href: "/admin/abonnements", label: "Abonnements", icon: "card", title: "Abonnements" },
  { href: "/admin/paiement", label: "Paiement en ligne", icon: "wallet", title: "Paiement en ligne · SasPay" },
  { href: "/admin/tarifs", label: "Table de tarifs", icon: "calc", title: "Table de tarifs" },
  { href: "/admin/messages", label: "Modèles de messages", icon: "chat", title: "Modèles de messages" },
  { href: "/admin/recharges", label: "Recharges Woyofal", icon: "bolt", title: "Recharges Woyofal · vente dans l'application" },
  { href: "/admin/loterie", label: "Loterie", icon: "gift", title: "Loterie · un mois d'électricité offert" },
  { href: "/admin/alertes", label: "Journal des alertes", icon: "bell", title: "Journal des alertes" },
  { href: "/admin/ia", label: "Assistant IA", icon: "sparkle", title: "Assistant IA · consommation Claude" },
  { href: "/admin/support", label: "Support", icon: "chat", title: "Support et réclamations" },
  { href: "/admin/notifications", label: "Notifications", icon: "bell", title: "Notifications sur mon téléphone" },
];

// Barre du bas sur téléphone
const TABS = [
  { href: "/admin", label: "Accueil", icon: "home" },
  { href: "/admin/utilisateurs", label: "Clients", icon: "users" },
  { href: "/admin/paiement", label: "Paiements", icon: "wallet" },
  { href: "/admin/support", label: "Support", icon: "chat" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const current = NAV.find((n) => (n.href === "/admin" ? path === "/admin" : path.startsWith(n.href)));
  const menu = useMobileMenu();
  const isActive = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

  // À chaque ouverture de l'admin (nouvel onglet, appli relancée), les identifiants sont redemandés
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    let ok = false;
    try {
      ok = sessionStorage.getItem(ADMIN_UNLOCK) === "1";
    } catch {
      ok = false;
    }
    if (ok) return setUnlocked(true);
    void fetch("/api/admin/logout", { method: "POST" })
      .catch(() => undefined)
      .finally(() => window.location.replace(`/admin/login?next=${encodeURIComponent(window.location.pathname)}`));
  }, []);


  return (
    <div className="app has-tabs">
      <Splash ready={unlocked} min={400} label="Ouverture de l'administration…" />
      <MenuBackdrop open={menu.open} onClose={menu.close} />
      <aside id="menu-admin" className={`side${menu.open ? " open" : ""}`} style={{ background: "#0A2A20" }} aria-label="Menu d'administration">
        <div className="brand row" style={{ padding: "6px 10px 6px" }}>
          <Logo dark size={36} href="/" />
          <span className="sp" />
          <span className="only-m"><MenuButton open dark onClick={menu.close} controls="menu-admin" /></span>
        </div>
        <span className="badge b-trial trial" style={{ alignSelf: "flex-start", margin: "0 10px 16px" }}>Administration</span>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={current?.href === n.href ? "page" : undefined}><Icon name={n.icon} /> {n.label}</Link>
        ))}
        <div className="sep" />
        <Link href="/app"><Icon name="arrow" /> Espace client</Link>
        <span style={{ flex: 1 }} />
        <form action="/api/admin/logout" method="post">
          <button type="submit" className="row" style={{ minHeight: 46, padding: "0 14px", gap: 12, color: "#cfe3d8", font: "600 15px Inter", width: "100%" }}>
            <Icon name="logout" /> Se déconnecter
          </button>
        </form>
      </aside>
      <main id="contenu">
        <div className="topbar">
          <span className="only-m"><MenuButton open={menu.open} onClick={menu.toggle} controls="menu-admin" /></span>
          {path !== "/admin" && <BackButton fallback="/admin" compact />}
          <h1 className="mont ink topbar-title" style={{ fontWeight: 800, fontSize: 22 }}>{current?.title ?? "Administration"}</h1>
          <span className="sp" />
          <span className="avatar" style={{ background: "var(--g9)", color: "var(--yel)" }}>CT</span>
        </div>
        <div className="pad">{unlocked ? children : null}</div>
      </main>
      <nav className="tabbar no-print" aria-label="Navigation rapide de l'administration">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} aria-current={isActive(t.href) ? "page" : undefined}>
            <span className="tb-ic"><Icon name={t.icon} /></span>
            {t.label}
          </Link>
        ))}
        <button type="button" onClick={menu.toggle} aria-expanded={menu.open} aria-controls="menu-admin">
          <span className="tb-ic"><Icon name="menu" /></span>
          Menu
        </button>
      </nav>
    </div>
  );
}
