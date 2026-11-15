"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * Menu latéral repliable sur téléphone : ouvert par le bouton ☰, fermé au changement de page,
 * par la touche Échap ou en touchant le fond. Le défilement de la page est bloqué pendant l'ouverture.
 */
export function useMobileMenu() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("menu-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("menu-open");
    };
  }, [open]);
  return { open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false) };
}

export function MenuButton({ open, onClick, controls, dark }: { open: boolean; onClick: () => void; controls: string; dark?: boolean }) {
  return (
    <button
      type="button"
      className={`menu-btn${dark ? " dark" : ""}`}
      aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
      aria-expanded={open}
      aria-controls={controls}
      onClick={onClick}
    >
      <Icon name={open ? "x" : "menu"} />
    </button>
  );
}

export function MenuBackdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <div className={`menu-backdrop${open ? " on" : ""}`} onClick={onClose} aria-hidden="true" />;
}
