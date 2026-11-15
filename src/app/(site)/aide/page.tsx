import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import { Faq } from "@/components/site/SiteChrome";
import { SupportForm } from "@/components/site/SupportForm";

export const metadata: Metadata = { title: "Aide et contact" };

const CODES = [
  ["800", "Consommation totale", "Contrôle de cohérence"],
  ["801", "Crédit restant", "Votre solde : point de départ de l'autonomie"],
  ["813", "Consommation de la veille", "Sert à calculer votre moyenne par jour"],
  ["814", "Consommation du mois en cours", "Sert à prévoir votre consommation"],
  ["820", "Consommation du mois précédent", "Historique (selon le modèle de compteur)"],
];

export default function Aide() {
  return (
    <section className="sec">
      <div className="wrap" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 28, alignItems: "start" }}>
        <div className="card col" style={{ gap: 16, padding: 32 }}>
          <span className="eyebrow">Aide et contact</span>
          <h1 className="h2" style={{ fontSize: 30 }}>Une question, une réclamation ?</h1>
          <p>Écrivez-nous ci-dessous ou à support@wolyelec.com : réponse par e-mail en quelques heures, du lundi au samedi.</p>
          <div id="contact"><SupportForm /></div>
          <hr className="hr" />
          <a className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} href="https://wa.me/221771234567"><Icon name="chat" size="s" /> Ou écrire sur WhatsApp</a>
          <hr className="hr" />
          <div className="tick sm"><Icon name="mail" size="s" /><a href="mailto:support@wolyelec.com">support@wolyelec.com</a></div>
          <div className="tick sm"><Icon name="phone" size="s" /><span>+221 77 123 45 67</span></div>
          <div className="tick sm"><Icon name="pin" size="s" /><span>Dakar, Sénégal</span></div>
          <hr className="hr" />
          <b className="h4">Questions fréquentes</b>
          <Faq
            compact
            items={[
              { q: "Comment installer Woly Elec sur mon téléphone et recevoir les notifications ?", a: "Sur Android : ouvrez wolyelec.com dans Chrome, menu ⋮ puis « Installer l'application ». Sur iPhone : dans Safari, bouton Partager puis « Sur l'écran d'accueil », et ouvrez Woly Elec depuis l'icône. Ensuite, dans Alertes, touchez « Activer les notifications ». Le guide complet, avec chaque étape, est sur wolyelec.com/installer." },
              { q: "Comment relever les codes 801, 813 et 814 ?", a: "Sur le clavier de votre compteur Woyofal, tapez le code (par exemple 801) puis la touche de validation. Le compteur affiche une valeur : recopiez-la dans Woly Elec. Répétez pour 813 et 814." },
              { q: "Mon lien de mise à jour a expiré", a: "Pour votre sécurité, chaque lien n'est valable que quelques jours. Connectez-vous simplement sur wolyelec.com pour mettre votre compteur à jour." },
              { q: "Woly Elec vend-il de l'électricité ?", a: "Non. Achetez votre crédit Woyofal chez votre revendeur habituel (Wave, Orange Money, Free Money, point de vente). Woly Elec vous dit combien et quand recharger, puis vous enregistrez la recharge." },
              { q: "Pourquoi mes kWh varient pour un même montant ?", a: "Au-delà de 150 kWh achetés dans le mois, le kWh passe de 82 F à 136,49 F. La taxe communale (2,5 %) s'applique à chaque recharge et la redevance du compteur une fois par mois, sur la première recharge." },
              { q: "J'ai oublié mon mot de passe", a: "Sur la page Connexion, cliquez sur « Mot de passe oublié ? » : vous recevez un code à 6 chiffres par e-mail, de la part de wolyelec@wolyelec.com, pour choisir un nouveau mot de passe." },
              { q: "Comment supprimer mes données ?", a: "Depuis Profil > Données et confidentialité, ou en écrivant à support@wolyelec.com. Vos données sont supprimées sous 30 jours." },
            ]}
          />
        </div>
        <div className="card col" style={{ gap: 14, padding: 28 }}>
          <span className="eyebrow">Codes du compteur Woyofal</span>
          <h2 className="h3">Les chiffres que Woly Elec vous demande</h2>
          <div className="scr">
            <table className="tbl">
              <thead><tr><th>Code</th><th>Information</th><th>Utilité</th></tr></thead>
              <tbody>{CODES.map(([c, i, u]) => <tr key={c}><td><b>{c}</b></td><td>{i}</td><td className="sm">{u}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="xs mut">Ces codes viennent d&apos;une liste générique de compteurs prépayés ; ils peuvent varier selon le modèle de votre compteur.</p>
          <span className="eyebrow" style={{ marginTop: 10 }}>Grille tarifaire DPP 2026</span>
          <table className="tbl">
            <thead><tr><th>kWh achetés dans le mois</th><th className="n">Prix du kWh</th></tr></thead>
            <tbody><tr><td>0 à 150 kWh</td><td className="n">82 F</td></tr><tr><td>151 à 250 kWh</td><td className="n">136,49 F</td></tr><tr><td>Au-delà de 250 kWh</td><td className="n">136,49 F + TVA</td></tr></tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
