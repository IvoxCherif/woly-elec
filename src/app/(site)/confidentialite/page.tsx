import type { Metadata } from "next";
import { LegalPage } from "@/components/site/Legal";

export const metadata: Metadata = { title: "Confidentialité" };

export default function Confidentialite() {
  return (
    <LegalPage eyebrow="Confidentialité" title="Vos données, votre contrôle">
      <p>Vos relevés ne servent qu&apos;à calculer vos prévisions et à vous envoyer vos alertes. Vous donnez votre consentement à l&apos;inscription et pouvez le retirer à tout moment.</p>
      <h2 className="h3">Données collectées</h2>
      <p>Adresse e-mail et nom, mot de passe (stocké uniquement sous forme d&apos;empreinte chiffrée) ou identifiant de votre compte Google, numéro et type de compteur, relevés (codes 801, 813, 814, 820), recharges (date, montant, kWh, codes, revendeur), appareils déclarés, préférences d&apos;alerte. Facultatif : numéro WhatsApp pour les alertes, nombre de personnes, budget.</p>
      <h2 className="h3">Finalités</h2>
      <p>Calcul de l&apos;autonomie, du montant à recharger et du meilleur jour ; envoi des alertes (push, WhatsApp, SMS, e-mail) ; facturation de l&apos;abonnement. Vos données ne sont jamais vendues.</p>
      <h2 className="h3">Cookies de mesure publicitaire</h2>
      <p>Si vous l&apos;acceptez dans le bandeau affiché à votre arrivée, le site utilise le Pixel Meta (Facebook, Instagram) pour savoir quelles publicités vous ont amené à Woly Elec et si vous vous êtes inscrit ou abonné (montant de l&apos;abonnement). Aucun relevé, numéro de compteur ou code de recharge n&apos;est transmis à Meta. Sans votre accord, rien n&apos;est chargé. Pour changer d&apos;avis, effacez les données du site dans votre navigateur : le bandeau reviendra.</p>
      <h2 className="h3">Assistant IA</h2>
      <p>Avec Woly Elec IA, vos chiffres calculés (solde, moyenne, tranche, montant) sont transmis à notre fournisseur d&apos;IA pour produire une explication. Aucun nom ni numéro de téléphone n&apos;est transmis.</p>
      <h2 className="h3">Sécurité et conservation</h2>
      <p>Adresse e-mail confirmée par un code à 6 chiffres, mots de passe stockés en empreinte chiffrée (scrypt), sessions signées, connexion chiffrée (HTTPS). Les e-mails vous sont envoyés depuis wolyelec@wolyelec.com. Durée de conservation après la fin d&apos;un abonnement : [À DÉFINIR].</p>
      <h2 className="h3">Vos droits</h2>
      <p>Accès, rectification, suppression et portabilité (Profil &gt; Télécharger mes données), conformément à la loi sénégalaise sur la protection des données personnelles. Contact : support@wolyelec.com. Vous pouvez saisir la CDP (Commission de protection des données personnelles).</p>
    </LegalPage>
  );
}
