import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NavTracker } from "@/components/BackButton";
import { InstallCatcher } from "@/components/InstallGuide";
import { MetaPixel } from "@/components/MetaPixel";

export const metadata: Metadata = {
  title: { default: "Woly Elec — Saytu sa kuuraŋ · Votre électricité, sous contrôle", template: "%s · Woly Elec" },
  description:
    "Woly Elec vous dit combien recharger, quand recharger et quand votre crédit Woyofal va s'épuiser. Service indépendant, non affilié à la Senelec.",
};

export const viewport: Viewport = { themeColor: "#0B3D2E", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        {/* Écrits en dur (et non via les métadonnées différées) : le téléphone les lit au moment d'ajouter
            l'icône sur l'écran d'accueil. Sans eux, Android affiche la première lettre du titre au lieu du logo.
            Le manifeste (client ou admin) est ajouté par chaque partie du site : voir AppManifest. */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <meta name="application-name" content="Woly Elec" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <NavTracker />
        <InstallCatcher />
        {children}
        <MetaPixel />
      </body>
    </html>
  );
}
