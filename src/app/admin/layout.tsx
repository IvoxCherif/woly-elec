import { AppManifest } from "@/components/AppManifest";

/** Toute l'administration (y compris la page de connexion) s'installe comme l'application « WE Admin ». */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppManifest kind="admin" />
      {children}
    </>
  );
}
