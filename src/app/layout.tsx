import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Woly Elec — Votre électricité, sous contrôle", template: "%s · Woly Elec" },
  description:
    "Woly Elec vous dit combien recharger, quand recharger et quand votre crédit Woyofal va s'épuiser. Service indépendant, non affilié à la Senelec.",
  icons: { icon: "/logo-mark.png" },
};

export const viewport: Viewport = { themeColor: "#0B3D2E", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Montserrat:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
