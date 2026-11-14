ALTER TABLE "clients" ALTER COLUMN "telephone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "email" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "mot_de_passe_hash" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "google_id" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "email_verifie" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "clients" SET "email" = NULL WHERE "email" = '';--> statement-breakpoint
UPDATE "clients" SET "email" = lower("email") WHERE "email" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_email_unique" UNIQUE("email");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_google_id_unique" UNIQUE("google_id");