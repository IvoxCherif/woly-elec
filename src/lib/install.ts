"use client";

import { useEffect, useState } from "react";

/**
 * Installation de l'application sur l'écran d'accueil (Android / Chrome) : le navigateur propose l'installation
 * via l'événement « beforeinstallprompt », capté dès le chargement et gardé pour le bouton « Installer ».
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const w = () => window as unknown as { __wolyInstall?: InstallEvent | null };

export function catchInstallPrompt() {
  if (typeof window === "undefined" || (window as unknown as { __wolyInstallCatcher?: boolean }).__wolyInstallCatcher) return;
  (window as unknown as { __wolyInstallCatcher?: boolean }).__wolyInstallCatcher = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    w().__wolyInstall = e as InstallEvent;
    window.dispatchEvent(new Event("woly-install-ready"));
  });
  window.addEventListener("appinstalled", () => {
    w().__wolyInstall = null;
    window.dispatchEvent(new Event("woly-install-ready"));
  });
}

export type Platform = "android" | "iphone" | "autre";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "autre";
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iphone";
  if (/android/i.test(ua)) return "android";
  return "autre";
}

export const isInstalled = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

/** Bouton « Installer l'application » : disponible quand le navigateur le permet (Android / Chrome, ordinateur). */
export function useInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    catchInstallPrompt();
    const sync = () => {
      setReady(!!w().__wolyInstall);
      setInstalled(isInstalled());
    };
    sync();
    window.addEventListener("woly-install-ready", sync);
    return () => window.removeEventListener("woly-install-ready", sync);
  }, []);
  async function install(): Promise<boolean> {
    const e = w().__wolyInstall;
    if (!e) return false;
    await e.prompt();
    const { outcome } = await e.userChoice;
    w().__wolyInstall = null;
    setReady(false);
    return outcome === "accepted";
  }
  return { canInstall: ready, installed, install };
}
