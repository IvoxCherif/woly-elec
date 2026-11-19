CREATE TABLE "liens_partage" (
	"id" serial PRIMARY KEY NOT NULL,
	"compteur_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"token" text NOT NULL,
	"actif" boolean DEFAULT true NOT NULL,
	"vues" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"vu_at" timestamp with time zone,
	CONSTRAINT "liens_partage_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "partages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proprietaire_id" uuid NOT NULL,
	"membre_id" uuid,
	"email" text NOT NULL,
	"role" text DEFAULT 'consulter' NOT NULL,
	"compteur_ids" jsonb,
	"statut" text DEFAULT 'invite' NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "liens_partage" ADD CONSTRAINT "liens_partage_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liens_partage" ADD CONSTRAINT "liens_partage_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partages" ADD CONSTRAINT "partages_proprietaire_id_clients_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partages" ADD CONSTRAINT "partages_membre_id_clients_id_fk" FOREIGN KEY ("membre_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "liens_partage_compteur_idx" ON "liens_partage" USING btree ("compteur_id");--> statement-breakpoint
CREATE INDEX "partages_proprietaire_idx" ON "partages" USING btree ("proprietaire_id");--> statement-breakpoint
CREATE INDEX "partages_membre_idx" ON "partages" USING btree ("membre_id");--> statement-breakpoint
CREATE INDEX "partages_email_idx" ON "partages" USING btree ("email");