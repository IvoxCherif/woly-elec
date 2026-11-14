import { SiteFooter, SiteHeader } from "@/components/site/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", background: "var(--bg)" }}>
      <SiteHeader />
      <main id="contenu">{children}</main>
      <SiteFooter />
    </div>
  );
}
