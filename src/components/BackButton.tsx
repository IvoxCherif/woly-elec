"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./Icon";

const KEY = "woly-nav-depth";

/** Compte les pages vues dans l'onglet : permet de savoir si « Retour » peut revenir en arrière dans le site. */
export function NavTracker() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, String(Number(sessionStorage.getItem(KEY) ?? 0) + 1));
    } catch {
      /* stockage indisponible : « Retour » utilisera la page parente */
    }
  }, [pathname]);
  return null;
}

/** Page parente : /app/abonnement/paiement → /app/abonnement, /tarifs → /, /admin/tarifs → /admin. */
export function parentOf(path: string): string {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  if (parts.length <= 1) return parts[0] === "app" || parts[0] === "admin" ? `/${parts[0]}` : "/";
  return `/${parts.slice(0, -1).join("/")}`;
}

/**
 * Bouton « Retour » : revient à la page précédente du site si l'on a navigué dans le site,
 * sinon (lien direct, nouvel onglet) ouvre la page parente.
 */
export function BackButton({ fallback, dark, label = "Retour", compact }: { fallback?: string; dark?: boolean; label?: string; compact?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = () => {
    let depth = 0;
    try {
      depth = Number(sessionStorage.getItem(KEY) ?? 0);
    } catch {
      /* ignore */
    }
    if (depth > 1 && window.history.length > 1) router.back();
    else router.push(fallback ?? parentOf(pathname));
  };
  return (
    <button type="button" className={`back-btn${dark ? " dark" : ""}${compact ? " compact" : ""}`} onClick={go} aria-label={label}>
      <Icon name="left" size="s" />
      <span>{label}</span>
    </button>
  );
}
