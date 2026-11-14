CREATE TABLE "demandes_support" (
	"id" serial PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"client_id" uuid,
	"nom" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"categorie" text DEFAULT 'question' NOT NULL,
	"sujet" text NOT NULL,
	"message" text NOT NULL,
	"statut" text DEFAULT 'ouvert' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "demandes_support_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "demandes_support" ADD CONSTRAINT "demandes_support_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demandes_support_statut_idx" ON "demandes_support" USING btree ("statut","created_at");