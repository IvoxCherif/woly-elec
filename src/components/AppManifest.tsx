/**
 * Manifeste de l'application installable, écrit dans le HTML de la page (React le place dans <head>) :
 * le téléphone le lit dès le chargement. « client » s'ouvre sur /app, « admin » (WE Admin) sur /admin.
 */
export function AppManifest({ kind }: { kind: "client" | "admin" }) {
  return kind === "admin" ? (
    <>
      <link rel="manifest" href="/manifest-admin.webmanifest" />
      <meta name="apple-mobile-web-app-title" content="WE Admin" />
    </>
  ) : (
    <>
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="apple-mobile-web-app-title" content="Woly Elec" />
    </>
  );
}
