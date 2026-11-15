CREATE TABLE "admin_push_abonnements" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"appareil" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "admin_push_abonnements_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "tirages" ADD COLUMN "montant_recharge" integer;--> statement-breakpoint
ALTER TABLE "tirages" ADD COLUMN "mois_offert" boolean DEFAULT false NOT NULL;