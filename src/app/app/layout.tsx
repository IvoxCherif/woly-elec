import type { Metadata } from "next";
import { AppShell } from "@/components/app/AppShell";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = { title: "Tableau de bord", robots: { index: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <AppShell>{children}</AppShell>
    </StoreProvider>
  );
}
