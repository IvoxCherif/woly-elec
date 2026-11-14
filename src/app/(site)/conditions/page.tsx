import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Conditions() {
  return (
    <LegalPage eyebrow="Conditions d'utilisation" title="Des estimations, pas des promesses">
      <p>Les montants, durées et dates affichés par Woly Elec sont des estimations calculées d&apos;après vos relevés et la grille tarifaire en vigueur. Ils ne remplacent pas les informations de votre compteur ni celles de la Senelec. Woly Elec ne garantit pas l&apos;absence de coupure.</p>
      <h2 className="h3">Essai gratuit</h2>
      <p>30 jours, un compteur, accès complet. Une seule période d&apos;essai par numéro de téléphone et par numéro de compteur. Rappels à J-7, J-3 et J-1. Sans abonnement à la fin de l&apos;essai, les alertes et le montant exact sont désactivés ; vos données restent consultables.</p>
      <h2 className="h3">Abonnements</h2>
      <p>Woly Elec 1 : 1 999 F/mois pour un compteur, +1 000 F par compteur supplémentaire. Woly Elec IA : 2 499 F/mois, +1 499 F par compteur supplémentaire, assistant limité à 30 requêtes par mois et par compteur. Annuel : 11 mois payés la 1re année, 12 mois à partir de la 2e. Le prix de renouvellement est affiché avant chaque paiement.</p>
      <h2 className="h3">Paiement et résiliation</h2>
      <p>Paiement sur le site par Wave, Orange Money ou Free Money. Résiliation à tout moment depuis Mon abonnement, effective à la fin de la période payée. Remboursement : [À DÉFINIR].</p>
      <h2 className="h3">Responsabilités</h2>
      <p>L&apos;utilisateur s&apos;engage à saisir des relevés exacts. Woly Elec n&apos;est pas responsable des décisions de recharge prises sur la base d&apos;estimations.</p>
    </LegalPage>
  );
}
