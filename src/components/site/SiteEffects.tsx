"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { BackButton } from "../BackButton";

/** Barre « Retour » sous l'en-tête, sur toutes les pages du site sauf l'accueil. */
export function SiteBackBar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div className="wrap back-bar">
      <BackButton />
    </div>
  );
}

/**
 * Apparition progressive des blocs au défilement (titres, cartes, messages…).
 * Sans effet si l'utilisateur a demandé de réduire les animations.
 */
export function ScrollReveal() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        "main .sec .eyebrow, main .sec h2, main .sec .lead, main .sec .card, main .sec .tick, main .sec .wa, main .sec .sms, main .sec .push, main .sec .acc, main .sec .avatar + b, main .sec .frise, main .sec .col > .avatar",
      ),
    ).filter((el) => !el.closest(".hero") && !el.classList.contains("rv"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("rv-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => {
      // Décalage en cascade entre éléments voisins
      const siblings = el.parentElement ? Array.from(el.parentElement.children) : [];
      el.style.setProperty("--rv-delay", `${Math.min(5, Math.max(0, siblings.indexOf(el))) * 80}ms`);
      el.classList.add("rv");
      io.observe(el);
    });
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
