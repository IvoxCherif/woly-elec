CREATE TABLE "tirages" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid,
	"compteur_id" uuid,
	"nom" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"telephone" text,
	"numero_compteur" text NOT NULL,
	"nom_compteur" text DEFAULT '' NOT NULL,
	"conso_mois_kwh" real,
	"montant_mois" integer,
	"participants" integer DEFAULT 0 NOT NULL,
	"statut" text DEFAULT 'tire' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"recharge_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tirages" ADD CONSTRAINT "tirages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tirages" ADD CONSTRAINT "tirages_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tirages_date_idx" ON "tirages" USING btree ("created_at");