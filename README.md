# Woly Elec — Votre électricité, sous contrôle

SaaS web (Next.js, web-first / PWA) qui aide les clients Woyofal (électricité prépayée, Sénégal) à faire durer leur crédit tout le mois : **combien recharger, quand recharger et quand le crédit va s'épuiser**, avec des alertes avant coupure. Service indépendant, non affilié à la Senelec.

Sources : cahier des charges v2, présentation Woly Elec, projet Notion « Woly Elec — Projet SaaS » (offres, moteur de calcul, écrans) et maquettes du canvas Claude Design « Woly Elec — Interface complète » (version web).

## Démarrer

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # moteur de calcul, prix, sessions et base de données (PGlite)
npm run build
```

Assistant IA (facultatif) : définir `ANTHROPIC_API_KEY` dans `.env.local`. Sans clé, l'assistant répond avec le moteur de calcul local.

## Base de données

PostgreSQL (Drizzle ORM). Schéma : `src/db/schema.ts` — clients, compteurs, relevés, recharges, appareils, alertes, abonnements, paiements, usage et messages IA, essais, codes SMS, tarifs (versionnés), modèles de messages. Les migrations (`drizzle/`) s'appliquent automatiquement au démarrage.

- **Production** : conteneur `db` du projet Docker `woly-elec` (voir `deploy/woly-elec/docker-compose.yml`), réseau privé, mot de passe généré automatiquement sur le serveur, sauvegarde quotidienne gardée 14 jours.
- **Local** : `DATABASE_URL=pglite:./.pglite` dans `.env.local` (PostgreSQL embarqué, sans Docker).
- **Sans base** : l'application fonctionne en mode démonstration (données dans le navigateur).
- Nouvelle migration après modification du schéma : `npx drizzle-kit generate`.

Comptes clients : connexion **par e-mail + mot de passe** (empreinte scrypt) ou **avec Google** (OpenID Connect). Pour activer Google : créer un identifiant OAuth « Application Web » dans Google Cloud Console, URI de redirection `https://wolyelec.com/api/auth/google/callback`, puis définir `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`. Le numéro de téléphone est facultatif (profil) et sert aux alertes WhatsApp / SMS.

E-mails (messagerie Hostinger) : envoyés depuis `wolyelec@wolyelec.com` (alias de la boîte `support@wolyelec.com`), réponses vers `support@wolyelec.com`. Code à 6 chiffres pour vérifier l'adresse à l'inscription et pour « Mot de passe oublié », e-mail de bienvenue, alertes avant coupure (canal e-mail), accusé de réception du support. Variable requise : `SMTP_PASSWORD` (mot de passe de la boîte support). En développement sans SMTP, les codes s'affichent à l'écran et les e-mails dans la console.

Support : formulaire sur `/aide` et `/app/support`, demandes enregistrées (table `demandes_support`), copie à `support@wolyelec.com`, suivi des statuts dans `/admin/support`.

Phase pilote : les paiements sont simulés et tracés comme tels (`PAYMENT_MODE=demo`).

## Accès administrateur

`/admin` est protégé par `/admin/login` : **identifiant (pseudo) + mot de passe** (middleware, session signée de 8 h, 5 essais par quart d'heure). Pour créer les identifiants :

```bash
npm run admin:credentials
```

Le script demande l'identifiant et le mot de passe (masqué) et affiche `ADMIN_EMAIL` (nom historique : contient l'identifiant), `ADMIN_PASSWORD_HASH` (empreinte scrypt) et `ADMIN_SESSION_SECRET`. `ADMIN_USERNAME` est aussi accepté s'il est défini. Mettez-les dans `.env.local` en local, et dans les variables du projet Docker `woly-elec` sur le VPS. Sans ces variables, l'admin reste fermé.

Mot de passe administrateur oublié : sur `/admin/login`, « Mot de passe oublié ? » envoie un code à 6 chiffres (10 minutes) dans la boîte `support@wolyelec.com`, si l'identifiant saisi est celui de l'admin. Le nouveau mot de passe est enregistré en base (table `parametres`) et remplace celui de hPanel tant que `ADMIN_PASSWORD_HASH` n'est pas régénéré.

## Pages

| Zone | Route | Contenu |
| --- | --- | --- |
| Site | `/` | Accueil : problème des tranches, fonctionnalités, exemple, canaux, IA, tarifs, FAQ |
| | `/tarifs` | Offres mensuel/annuel, comparatif, calculateur de compteurs |
| | `/aide`, `/mentions-legales`, `/confidentialite`, `/conditions` | Aide (codes 801/813/814), pages légales (textes à valider) |
| Accès | `/inscription` | Créer un compte : Google ou e-mail + mot de passe, compteur, codes 801/814/813, dernière recharge, préférences, 1re estimation |
| | `/connexion` | Connexion avec Google ou par e-mail + mot de passe |
| | `/maj/[token]` | Page du lien d'alerte (formulaire, résultat, lien expiré : `/maj/exp`) |
| Application | `/app` | Tableau de bord : jauge, montant à recharger, tranche, frise du mois, courbe, dépenses |
| | `/app/simulateur` | Montant → kWh, tranche, autonomie, détail des frais, aujourd'hui vs le 1er |
| | `/app/plan` | Minimum / recommandé, meilleur jour, jour préféré, objectif |
| | `/app/historique`, `/app/bilan` | Recharges et relevés, export CSV, bilan mensuel imprimable |
| | `/app/compteurs` | Multi-compteurs / vue propriétaire, relances |
| | `/app/appareils`, `/app/alertes`, `/app/assistant` | Appareils énergivores, alertes et canaux, assistant IA |
| | `/app/abonnement`, `/app/abonnement/paiement`, `/app/profil`, `/app/fin-essai` | Abonnement, paiement en 3 étapes, profil, fin d'essai |
| Admin | `/admin`, `/admin/utilisateurs`, `/admin/abonnements`, `/admin/tarifs`, `/admin/messages`, `/admin/alertes` | Indicateurs, utilisateurs, abonnements, table de tarifs administrable, modèles de messages, journal |
| Divers | `/maintenance`, 404 | Pages utilitaires |

## Architecture

- `src/lib/engine.ts` — moteur de calcul (tranches 82 / 136,49 F, taxe communale 2,5 %, redevance mensuelle, autonomie, besoin jusqu'à la fin du mois, marges de sécurité, meilleur jour, simulateur, appareils). Tarifs passés en configuration, jamais en dur.
- `src/lib/pricing.ts` — offres : Woly Elec 1 (1 999 F + 1 000 F/compteur), Woly Elec IA (2 499 F + 1 499 F/compteur), annuel ×11 la 1re année puis ×12.
- `src/lib/store.tsx` + `demo.ts` — état de démonstration (navigateur). 3 scénarios dans Profil : essai, propriétaire (6 compteurs), essai terminé.
- `src/app/api/assistant/route.ts` — Claude Sonnet 5.5 via `@anthropic-ai/sdk`, avec repli serveur en cas de refus ; l'IA reçoit uniquement les chiffres calculés.
- `src/app/design.css` — kit de style du canvas (vert #0B3D2E, bleu #1D4ED8, jaune #FACC15, Montserrat / Inter) ; `globals.css` — compléments interactifs.

## Reste à brancher pour la production

Backend et base PostgreSQL (modèle de données du cahier des charges), authentification OTP SMS, liens signés et expirables, envoi WhatsApp / SMS / push, agrégateur de paiement (Wave, Orange Money, Free Money), OCR des photos de compteur, quota IA côté serveur. Valeurs « à confirmer » (prix au-delà de 250 kWh, redevance, unité du code 801) à calibrer sur de vrais tickets.
