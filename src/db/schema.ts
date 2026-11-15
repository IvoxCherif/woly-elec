/**
 * Schéma PostgreSQL de Woly Elec (modèle de données du cahier des charges, § 16, et page Notion « Écrans, données et parcours »).
 * Les noms de colonnes sont en français, comme dans les spécifications.
 */
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, real, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull().default(""),
  // Identifiant de connexion : e-mail (en minuscules), avec mot de passe et/ou compte Google
  email: text("email").unique(),
  motDePasseHash: text("mot_de_passe_hash"), // scrypt, null si connexion Google uniquement
  googleId: text("google_id").unique(),
  emailVerifie: boolean("email_verifie").notNull().default(false),
  // Facultatif : numéro WhatsApp / SMS pour les alertes (format +221XXXXXXXXX)
  telephone: text("telephone").unique(),
  langue: text("langue").notNull().default("Français"),
  canaux: jsonb("canaux").$type<{ push: boolean; whatsapp: boolean; sms: boolean; email: boolean }>().notNull(),
  relances: integer("relances").notNull().default(2),
  jourRecharge: integer("jour_recharge").notNull().default(1),
  objectif: text("objectif").notNull().default("mois"),
  foyer: integer("foyer").notNull().default(1),
  budget: integer("budget").notNull().default(0),
  consentement: boolean("consentement").notNull().default(false),
  // VIP : accès à Woly Elec IA offert par l'administrateur, sans paiement
  vip: boolean("vip").notNull().default(false),
  // Quota de questions IA par compteur et par mois propre à ce client (null = quota général)
  quotaIa: integer("quota_ia"),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
});

export const compteurs = pgTable(
  "compteurs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    nom: text("nom").notNull(),
    numero: text("numero").notNull(),
    typeUsage: text("type_usage").notNull().default("Ménage"),
    typeCompteur: text("type_compteur").notNull().default("mono"), // mono | tri (sert à la redevance)
    retenueDette: integer("retenue_dette").notNull().default(0),
    occupant: text("occupant"),
    site: text("site").notNull().default(""),
    statut: text("statut").notNull().default("actif"),
    createdAt: createdAt(),
  },
  (t) => [index("compteurs_client_idx").on(t.clientId), index("compteurs_numero_idx").on(t.numero)],
);

export const releves = pgTable(
  "releves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compteurId: uuid("compteur_id").notNull().references(() => compteurs.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    soldeKwh: real("solde_kwh").notNull(), // code 801
    consoMoisKwh: real("conso_mois_kwh").notNull(), // code 814
    consoVeilleKwh: real("conso_veille_kwh").notNull(), // code 813
    source: text("source").notNull().default("manuel"), // manuel | ocr | lien
    photoUrl: text("photo_url"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("releves_compteur_date_uq").on(t.compteurId, t.date)],
);

export const recharges = pgTable(
  "recharges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    compteurId: uuid("compteur_id").notNull().references(() => compteurs.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    montantFcfa: integer("montant_fcfa").notNull(),
    kwhRecus: real("kwh_recus").notNull(),
    tokens: text("tokens").array().notNull().default([]), // 3 codes de 20 chiffres
    revendeur: text("revendeur").notNull().default(""),
    tranche: integer("tranche").notNull().default(1),
    premiereDuMois: boolean("premiere_du_mois").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("recharges_compteur_date_idx").on(t.compteurId, t.date)],
);

export const appareils = pgTable("appareils", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  puissanceWatts: real("puissance_watts").notNull(),
  heuresParJour: real("heures_par_jour").notNull(),
  joursParSemaine: integer("jours_par_semaine").notNull().default(7),
  createdAt: createdAt(),
});

export const alertes = pgTable(
  "alertes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    compteurId: uuid("compteur_id").references(() => compteurs.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // alerte_5j, alerte_3j, alerte_1j, recharge, abonnement…
    ton: text("ton").notNull().default("info"), // red | warn | info | ok
    icone: text("icone"),
    titre: text("titre").notNull(),
    message: text("message").notNull(),
    canal: text("canal").notNull().default("push"),
    statut: text("statut").notNull().default("remis"), // remis | en_attente | echec
    lue: boolean("lue").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("alertes_client_idx").on(t.clientId, t.createdAt)],
);

export const abonnements = pgTable("abonnements", {
  clientId: uuid("client_id").primaryKey().references(() => clients.id, { onDelete: "cascade" }),
  offre: text("offre").notNull().default("ia"), // simple | ia
  statut: text("statut").notNull().default("essai"), // essai | actif | expire
  cycle: text("cycle").notNull().default("mensuel"),
  annee: integer("annee").notNull().default(1),
  essaiDebut: date("essai_debut").notNull(),
  essaiFin: date("essai_fin").notNull(),
  renouvellement: date("renouvellement"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const paiements = pgTable("paiements", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(),
  libelle: text("libelle").notNull(),
  moyen: text("moyen").notNull(),
  montant: integer("montant").notNull(),
  statut: text("statut").notNull().default("simule"), // simule | en_attente | confirme | echec | annule
  // Paiement en ligne (SasPay) : session de paiement hébergée et offre achetée, appliquée à la confirmation
  checkoutId: text("checkout_id"),
  transactionId: text("transaction_id"),
  offre: text("offre"),
  cycle: text("cycle"),
  compteurs: integer("compteurs"),
  confirmeAt: timestamp("confirme_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const iaUsage = pgTable(
  "ia_usage",
  {
    compteurId: uuid("compteur_id").notNull().references(() => compteurs.id, { onDelete: "cascade" }),
    mois: text("mois").notNull(), // AAAA-MM
    requetes: integer("requetes").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.compteurId, t.mois] })],
);

export const iaMessages = pgTable("ia_messages", {
  id: serial("id").primaryKey(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // u | a
  texte: text("texte").notNull(),
  createdAt: createdAt(),
});

/** Chaque appel à l'API Claude : tokens consommés et coût, pour le suivi dans l'administration. */
export const iaAppels = pgTable(
  "ia_appels",
  {
    id: serial("id").primaryKey(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    compteurId: uuid("compteur_id").references(() => compteurs.id, { onDelete: "set null" }),
    modele: text("modele").notNull(),
    tokensEntree: integer("tokens_entree").notNull().default(0),
    tokensSortie: integer("tokens_sortie").notNull().default(0),
    coutUsd: real("cout_usd").notNull().default(0),
    statut: text("statut").notNull().default("ok"), // ok | refus
    createdAt: createdAt(),
  },
  (t) => [index("ia_appels_date_idx").on(t.createdAt), index("ia_appels_client_idx").on(t.clientId, t.createdAt)],
);

/** Téléphones et navigateurs abonnés aux notifications push (Web Push), un client peut en avoir plusieurs. */
export const pushAbonnements = pgTable(
  "push_abonnements",
  {
    id: serial("id").primaryKey(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    appareil: text("appareil").notNull().default(""),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("push_abonnements_client_idx").on(t.clientId)],
);

/** Rappels de renouvellement déjà envoyés (clé : client, type de rappel, date de fin) : un rappel n'est jamais envoyé deux fois. */
export const rappels = pgTable("rappels", {
  cle: text("cle").primaryKey(),
  createdAt: createdAt(),
});

/** Essais déjà consommés : un seul essai par téléphone et par numéro de compteur, même après suppression du compte. */
export const essais = pgTable("essais", {
  cle: text("cle").primaryKey(), // tel:+221… ou compteur:0145…
  createdAt: createdAt(),
});

/** Codes à 6 chiffres envoyés par e-mail (vérification d'adresse, mot de passe oublié). « telephone » contient « usage:email ». */
export const codesOtp = pgTable(
  "codes_otp",
  {
    id: serial("id").primaryKey(),
    telephone: text("telephone").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    tentatives: integer("tentatives").notNull().default(0),
    utilise: boolean("utilise").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("codes_otp_tel_idx").on(t.telephone, t.createdAt)],
);

/** Table de tarifs administrable : une ligne par version publiée, une seule active. */
export const tarifs = pgTable("tarifs", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  config: jsonb("config").notNull(), // TariffConfig (limite null = sans limite)
  active: boolean("active").notNull().default(false),
  createdAt: createdAt(),
});

export const modelesMessages = pgTable("modeles_messages", {
  id: text("id").primaryKey(),
  nom: text("nom").notNull(),
  canal: text("canal").notNull(),
  texte: text("texte").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Demandes de support et réclamations des utilisateurs (copie envoyée à support@wolyelec.com). */
export const demandesSupport = pgTable(
  "demandes_support",
  {
    id: serial("id").primaryKey(),
    reference: text("reference").notNull().unique(), // WS-XXXXXX, rappelée dans les e-mails
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    nom: text("nom").notNull().default(""),
    email: text("email").notNull(),
    categorie: text("categorie").notNull().default("question"), // question | reclamation | technique | paiement | compte
    sujet: text("sujet").notNull(),
    message: text("message").notNull(),
    statut: text("statut").notNull().default("ouvert"), // ouvert | en_cours | resolu
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("demandes_support_statut_idx").on(t.statut, t.createdAt)],
);

/** Paramètres modifiables par l'application (ex. mot de passe administrateur réinitialisé par e-mail). */
export const parametres = pgTable("parametres", {
  cle: text("cle").primaryKey(),
  valeur: jsonb("valeur").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Loterie : un client tiré au sort reçoit un mois d'électricité offert (recharge faite par l'équipe). */
export const tirages = pgTable(
  "tirages",
  {
    id: serial("id").primaryKey(),
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
    compteurId: uuid("compteur_id").references(() => compteurs.id, { onDelete: "set null" }),
    nom: text("nom").notNull().default(""),
    email: text("email").notNull().default(""),
    telephone: text("telephone"),
    numeroCompteur: text("numero_compteur").notNull(),
    nomCompteur: text("nom_compteur").notNull().default(""),
    consoMoisKwh: real("conso_mois_kwh"), // estimation d'après les relevés (null si aucun relevé)
    montantMois: integer("montant_mois"), // montant d'une recharge couvrant ce mois, en FCFA
    participants: integer("participants").notNull().default(0),
    statut: text("statut").notNull().default("tire"), // tire | recharge | annule
    montantRecharge: integer("montant_recharge"), // montant réellement rechargé par l'équipe, annoncé au gagnant
    moisOffert: boolean("mois_offert").notNull().default(false), // un mois d'abonnement offert en plus
    createdAt: createdAt(),
    rechargeAt: timestamp("recharge_at", { withTimezone: true }),
  },
  (t) => [index("tirages_date_idx").on(t.createdAt)],
);

/** Téléphones de l'administrateur abonnés aux notifications (nouveaux clients, paiements, support). */
export const adminPushAbonnements = pgTable("admin_push_abonnements", {
  id: serial("id").primaryKey(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  appareil: text("appareil").notNull().default(""),
  createdAt: createdAt(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});
