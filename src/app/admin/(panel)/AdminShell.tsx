"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/ui";

const NAV = [
  { href: "/admin", label: "Tableau de bord", icon: "home", title: "Vue d'ensemble" },
  { href: "/admin/utilisateurs", label: "Utilisateurs", icon: "users", title: "Utilisateurs" },
  { href: "/admin/abonnements", label: "Abonnements", icon: "card", title: "Abonnements" },
  { href: "/admin/tarifs", label: "Table de tarifs", icon: "calc", title: "Table de tarifs" },
  { href: "/admin/messages", label: "Modèles de messages", icon: "chat", title: "Modèles de messages" },
  { href: "/admin/alertes", label: "Journal des alertes", icon: "bell", title: "Journal des alertes" },
  { href: "/admin/support", label: "Support", icon: "chat", title: "Support et réclamations" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const current = NAV.find((n) => (n.href === "/admin" ? path === "/admin" : path.startsWith(n.href)));
  return (
    <div className="app">
      <aside className="side" style={{ background: "#0A2A20" }} aria-label="Menu d'administration">
        <div className="brand" style={{ padding: "6px 10px 6px" }}><Logo dark size={36} href="/" /></div>
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
          <h1 className="mont ink" style={{ fontWeight: 800, fontSize: 22 }}>{current?.title ?? "Administration"}</h1>
          <span className="sp" />
          <span className="avatar" style={{ background: "var(--g9)", color: "var(--yel)" }}>CT</span>
        </div>
        <div className="pad">{children}</div>
      </main>
    </div>
  );
}
