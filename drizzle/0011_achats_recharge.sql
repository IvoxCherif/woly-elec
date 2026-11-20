CREATE TABLE "achats_recharge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"client_id" uuid,
	"titulaire_id" uuid,
	"compteur_id" uuid,
	"numero_compteur" text NOT NULL,
	"nom_senelec" text DEFAULT '' NOT NULL,
	"montant" integer NOT NULL,
	"frais" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"statut" text DEFAULT 'en_attente' NOT NULL,
	"checkout_id" text,
	"transaction_id" text,
	"dexpay_ref" text,
	"frais_dexpay" integer,
	"token" text,
	"erreur" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paye_at" timestamp with time zone,
	"livre_at" timestamp with time zone,
	CONSTRAINT "achats_recharge_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "achats_recharge" ADD CONSTRAINT "achats_recharge_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achats_recharge" ADD CONSTRAINT "achats_recharge_titulaire_id_clients_id_fk" FOREIGN KEY ("titulaire_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achats_recharge" ADD CONSTRAINT "achats_recharge_compteur_id_compteurs_id_fk" FOREIGN KEY ("compteur_id") REFERENCES "public"."compteurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "achats_recharge_statut_idx" ON "achats_recharge" USING btree ("statut","created_at");--> statement-breakpoint
CREATE INDEX "achats_recharge_client_idx" ON "achats_recharge" USING btree ("client_id","created_at");