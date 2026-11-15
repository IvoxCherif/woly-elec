import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";
import { ElectricCable } from "@/components/site/ElectricCable";
import { ScrollReveal, SiteBackBar } from "@/components/site/SiteEffects";
import { AppManifest } from "@/components/AppManifest";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-root" style={{ width: "100%", background: "var(--bg)" }}>
      <AppManifest kind="client" />
      <ElectricCable />
      <SiteHeader />
      <SiteBackBar />
      <main id="contenu">{children}</main>
      <SiteFooter />
      <ScrollReveal />
    </div>
  );
}
