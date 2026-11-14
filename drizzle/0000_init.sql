CREATE TABLE "abonnements" (
	"client_id" uuid PRIMARY KEY NOT NULL,
	"offre" text DEFAULT 'ia' NOT NULL,
	"statut" text DEFAULT 'essai' NOT NULL,
	"cycle" text DEFAULT 'mensuel' NOT NULL,
	"annee" integer DEFAULT 1 NOT NULL,
	"essai_debut" date NOT NULL,
	"essai_fin" date NOT NULL,
	"renouvellement" date,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"compteur_id" uuid,
	"type" text NOT NULL,
	"ton" text DEFAULT 'info' NOT NULL,
	"icone" text,
	"titre" text NOT NULL,
	"message" text NOT NULL,
	"canal" text DEFAULT 'push' NOT NULL,
	"statut" text DEFAULT 'remis' NOT NULL,
	"lue" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appareils" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"puissance_watts" real NOT NULL,
	"heures_par_jour" real NOT NULL,
	"jours_par_semaine" integer DEFAULT 7 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" text DEFAULT '' NOT NULL,
	"telephone" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"langue" text DEFAULT 'Français' NOT NULL,
	"canaux" jsonb NOT NULL,
	"relances" integer DEFAULT 2 NOT NULL,
	"jour_recharge" integer DEFAULT 1 NOT NULL,
	"objectif" text DEFAULT 'mois' NOT NULL,
	"foyer" integer DEFAULT 1 NOT NULL,
	"budget" integer DEFAULT 0 NOT NULL,
	"consentement" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_telephone_unique" UNIQUE("telephone")
);
--> statement-breakpoint
CREATE TABLE "codes_otp" (
	"id" serial PRIMARY KEY NOT NULL,
	"telephone" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"tentatives" integer DEFAULT 0 NOT NULL,
	"utilise" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compteurs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"nom" text NOT NULL,
	"numero" text NOT NULL,
	"type_usage" text DEFAULT 'Ménage' NOT NULL,
	"type_compteur" text DEFAULT 'mono' NOT NULL,
	"retenue_dette" integer DEFAULT 0 NOT NULL,
	"occupant" text,
	"site" text DEFAULT '' NOT NULL,
	"statut" text DEFAULT 'actif' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "essais" (
	"cle" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ia_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"role" text NOT NULL,
	"texte" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ia_usage" (
	"compteur_id" uuid NOT NULL,
	"mois" text NOT NULL,
	"requetes" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ia_usage_compteur_id_mois_pk" PRIMARY KEY("compteur_id","mois")
);
--> statement-breakpoint
CREATE TABLE "modeles_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"canal" text NOT NULL,
	"texte" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paiements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"libelle" text NOT NULL,
	"moyen" text NOT NULL,
	"montant" integer NOT NULL,
	"statut" text DEFAULT 'simule' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "paiements_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "recharges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compteur_id" uuid NOT NULL,
	"date" date NOT NULL,
	"montant_fcfa" integer NOT NULL,
	"kwh_recus" real NOT NULL,
	"tokens" text[] DEFAULT '{}' NOT NULL,
	"revendeur" text DEFAULT '' NOT NULL,
	"tranche" integer DEFAULT 1 NOT NULL,
	"premiere_du_mois" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"compteur_id" uuid NOT NULL,
	"date" date NOT NULL,
	"solde_kwh" real NOT NULL,
	"conso_mois_kwh" real NOT NULL,
	"conso_veille_kwh" real NOT NULL,
	"source" text DEFAULT 'manuel' NOT NULL,
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tarifs" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" text NOT NULL,
	"config" jsonb NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "abonnements" ADD CONSTRAINT "abonnements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertes" ADD CONSTRAINT "alertes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertes" ADD CONSTRAINT "alertes_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appareils" ADD CONSTRAINT "appareils_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compteurs" ADD CONSTRAINT "compteurs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_messages" ADD CONSTRAINT "ia_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_usage" ADD CONSTRAINT "ia_usage_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements" ADD CONSTRAINT "paiements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recharges" ADD CONSTRAINT "recharges_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releves" ADD CONSTRAINT "releves_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alertes_client_idx" ON "alertes" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "codes_otp_tel_idx" ON "codes_otp" USING btree ("telephone","created_at");--> statement-breakpoint
CREATE INDEX "compteurs_client_idx" ON "compteurs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "compteurs_numero_idx" ON "compteurs" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "recharges_compteur_date_idx" ON "recharges" USING btree ("compteur_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "releves_compteur_date_uq" ON "releves" USING btree ("compteur_id","date");