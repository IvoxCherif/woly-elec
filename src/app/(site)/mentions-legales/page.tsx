import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";

export const metadata: Metadata = { title: "Mentions légales" };

export default function Mentions() {
  return (
    <LegalPage eyebrow="Mentions légales" title="Woly Elec, un service indépendant">
      <p>Woly Elec est un service numérique d&apos;aide à la gestion de l&apos;électricité prépayée. Il ne vend pas d&apos;électricité et n&apos;est pas affilié à la Senelec.</p>
      <h2 className="h3">Éditeur</h2>
      <p>Code&amp;Créa — [FORME JURIDIQUE, ADRESSE, NINEA ET RCCM À COMPLÉTER] — Dakar, Sénégal.<br />Contact : contact@woly-elec.sn · +221 77 123 45 67.</p>
      <h2 className="h3">Directeur de la publication</h2>
      <p>[NOM À COMPLÉTER]</p>
      <h2 className="h3">Hébergement</h2>
      <p>[HÉBERGEUR, ADRESSE À COMPLÉTER]</p>
      <h2 className="h3">Marques</h2>
      <p>« Woyofal » et « Senelec » sont des marques de leurs propriétaires respectifs, citées uniquement pour décrire le service. Le nom et le logo Woly Elec appartiennent à leur éditeur.</p>
    </LegalPage>
  );
}
