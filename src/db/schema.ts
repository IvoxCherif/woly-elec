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
  statut: text("statut").notNull().default("simule"), // simule | confirme | echec
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

/** Essais déjà consommés : un seul essai par téléphone et par numéro de compteur, même après suppression du compte. */
export const essais = pgTable("essais", {
  cle: text("cle").primaryKey(), // tel:+221… ou compteur:0145…
  createdAt: createdAt(),
});

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
