"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Icon } from "../Icon";
import { Logo } from "../ui";

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/#faq", label: "FAQ" },
  { href: "/aide", label: "Aide" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="hdr">
      <div className="wrap">
        <Logo href="/" />
        <nav aria-label="Navigation principale">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="sp" />
        <Link className="btn btn-line btn-sm" href="/connexion">
          Se connecter
        </Link>
        <Link className="btn btn-yel btn-sm" href="/inscription">
          Commencer mes 30 jours gratuits
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="ft">
      <div className="wrap col" style={{ gap: 28 }}>
        <div className="row wrapf" style={{ gap: 40, alignItems: "flex-start" }}>
          <div className="col" style={{ gap: 14, flex: "1 1 300px" }}>
            <Logo dark tagline />
            <p className="sm" style={{ maxWidth: 420 }}>
              Woly Elec est un service indépendant, non affilié à la Senelec. Il ne vend pas d&apos;électricité : il vous aide à planifier vos recharges et à éviter les coupures.
            </p>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <b className="wh sm">Produit</b>
            <Link className="sm" href="/#fonctionnalites">Fonctionnalités</Link>
            <Link className="sm" href="/tarifs">Tarifs</Link>
            <Link className="sm" href="/#faq">FAQ</Link>
            <Link className="sm" href="/installer">Installer l&apos;application</Link>
            <Link className="sm" href="/app">Tableau de bord</Link>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <b className="wh sm">Légal</b>
            <Link className="sm" href="/mentions-legales">Mentions légales</Link>
            <Link className="sm" href="/confidentialite">Confidentialité</Link>
            <Link className="sm" href="/conditions">Conditions d&apos;utilisation</Link>
          </div>
          <div className="col" style={{ gap: 8 }}>
            <b className="wh sm">Contact</b>
            <span className="sm">Dakar, Sénégal</span>
            <a className="sm" href="https://wa.me/221771234567">WhatsApp : +221 77 123 45 67</a>
            <a className="sm" href="mailto:support@wolyelec.com">support@wolyelec.com</a>
          </div>
        </div>
        <hr className="hr" style={{ background: "rgba(255,255,255,.14)" }} />
        <div className="row wrapf sm">
          <Flag />
          <span>Une solution 100 % sénégalaise</span>
          <span className="sp" />
          <span>© {new Date().getFullYear()} Woly Elec · Code&amp;Créa</span>
        </div>
      </div>
    </footer>
  );
}

export function Faq({ items, compact }: { items: { q: string; a: React.ReactNode }[]; compact?: boolean }) {
  return (
    <div>
      {items.map((it, i) => (
        <details key={it.q} className="acc" open={i === 0 && !compact}>
          <summary style={compact ? { padding: "14px 0", fontSize: 16 } : undefined}>
            {it.q}
            <Icon name="down" size="s" />
          </summary>
          <p>{it.a}</p>
        </details>
      ))}
    </div>
  );
}

export const FAQ_ITEMS = [
  {
    q: "Les chiffres sont-ils fiables ?",
    a: "Ce sont des estimations calculées d'après ce que vous saisissez. Un indicateur vous montre la fiabilité de chaque prévision. Avec des relevés quotidiens pendant deux semaines, elle atteint 85 à 95 % sur l'autonomie et le montant. Woly Elec ne promet jamais 100 %.",
  },
  {
    q: "D'où viennent les chiffres ?",
    a: "De vos relevés (codes 801, 813 et 814 de votre compteur), de vos recharges et de la grille tarifaire en vigueur : 82 F/kWh jusqu'à 150 kWh achetés dans le mois, puis 136,49 F/kWh. La taxe communale (2,5 %) et la redevance mensuelle sont incluses.",
  },
  {
    q: "Dois-je saisir mes relevés tous les jours ?",
    a: "Non. Un relevé par semaine suffit pour commencer ; plus vous en faites, plus les prévisions sont précises. Chaque alerte contient un lien personnel qui ouvre directement le formulaire de mise à jour.",
  },
  {
    q: "Quelle différence entre Woly Elec 1 et Woly Elec IA ?",
    a: "Woly Elec 1 calcule et alerte. Woly Elec IA utilise le même moteur de calcul et ajoute un assistant qui explique vos recharges, commente votre bilan mensuel et vous conseille, avec 30 requêtes par mois et par compteur. L'IA n'invente jamais de chiffres.",
  },
  {
    q: "Comment annuler mon abonnement ?",
    a: "Depuis Mon abonnement, à tout moment. Vos données restent consultables ; seules les alertes et le montant exact sont désactivés.",
  },
];
