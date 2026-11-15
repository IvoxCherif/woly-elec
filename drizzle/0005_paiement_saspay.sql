ALTER TABLE "paiements" ADD COLUMN "checkout_id" text;--> statement-breakpoint
ALTER TABLE "paiements" ADD COLUMN "transaction_id" text;--> statement-breakpoint
ALTER TABLE "paiements" ADD COLUMN "offre" text;--> statement-breakpoint
ALTER TABLE "paiements" ADD COLUMN "cycle" text;--> statement-breakpoint
ALTER TABLE "paiements" ADD COLUMN "compteurs" integer;--> statement-breakpoint
ALTER TABLE "paiements" ADD COLUMN "confirme_at" timestamp with time zone;