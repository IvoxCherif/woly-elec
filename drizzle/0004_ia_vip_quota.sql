CREATE TABLE "ia_appels" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid,
	"compteur_id" uuid,
	"modele" text NOT NULL,
	"tokens_entree" integer DEFAULT 0 NOT NULL,
	"tokens_sortie" integer DEFAULT 0 NOT NULL,
	"cout_usd" real DEFAULT 0 NOT NULL,
	"statut" text DEFAULT 'ok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "vip" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "quota_ia" integer;--> statement-breakpoint
ALTER TABLE "ia_appels" ADD CONSTRAINT "ia_appels_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ia_appels" ADD CONSTRAINT "ia_appels_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ia_appels_date_idx" ON "ia_appels" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ia_appels_client_idx" ON "ia_appels" USING btree ("client_id","created_at");