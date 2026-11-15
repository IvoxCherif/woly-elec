import type { Metadata } from "next";
import { InstallGuide } from "@/components/InstallGuide";

export const metadata: Metadata = { title: "Installer l'application" };

export default function Installer() {
  return <InstallGuide inApp />;
}
