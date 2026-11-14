import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { parametres } from "@/db/schema";

/**
 * Mot de passe administrateur réinitialisé par e-mail.
 * L'empreinte de hPanel (ADMIN_PASSWORD_HASH) reste la référence : une empreinte enregistrée en base
 * ne la remplace que tant que celle de hPanel n'a pas changé. Régénérer les identifiants avec le script
 * redonne donc la main à hPanel.
 */
const KEY = "admin_mot_de_passe";

type Stored = { hash: string; base: string };

export async function effectiveAdminHash(db: DB | null): Promise<string | null> {
  const envHash = process.env.ADMIN_PASSWORD_HASH ?? null;
  if (!envHash || !db) return envHash;
  const [row] = await db.select().from(parametres).where(eq(parametres.cle, KEY));
  const v = row?.valeur as Stored | undefined;
  return v && v.base === envHash && typeof v.hash === "string" ? v.hash : envHash;
}

export async function saveAdminHash(db: DB, hash: string) {
  const value: Stored = { hash, base: process.env.ADMIN_PASSWORD_HASH ?? "" };
  await db
    .insert(parametres)
    .values({ cle: KEY, valeur: value })
    .onConflictDoUpdate({ target: parametres.cle, set: { valeur: value, updatedAt: new Date() } });
}
