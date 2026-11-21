import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { parametres } from "@/db/schema";

/** Pixel Meta (Facebook / Instagram) : l'identifiant n'est pas un secret, il est visible dans la page. */
const KEY = "meta_pixel";

export type PixelConfig = { id: string | null; actif: boolean };

export async function pixelConfig(db: DB): Promise<PixelConfig> {
  const [row] = await db.select().from(parametres).where(eq(parametres.cle, KEY));
  const v = row?.valeur as Partial<PixelConfig> | undefined;
  return { id: typeof v?.id === "string" ? v.id : null, actif: v?.actif === true };
}

/** Identifiant de Pixel actif, ou null (aucun suivi). */
export async function activePixelId(db: DB): Promise<string | null> {
  const c = await pixelConfig(db);
  return c.actif && c.id ? c.id : null;
}

export async function savePixelConfig(db: DB, input: { id?: string; actif?: boolean }) {
  const cur = await pixelConfig(db);
  let id = cur.id;
  if (input.id !== undefined) {
    const clean = input.id.replace(/\s/g, "");
    if (clean && !/^\d{10,20}$/.test(clean)) throw new Error("pixel_invalide");
    id = clean || null;
  }
  const next = { id, actif: input.actif ?? cur.actif };
  if (next.actif && !next.id) throw new Error("pixel_absent");
  await db.insert(parametres).values({ cle: KEY, valeur: next }).onConflictDoUpdate({ target: parametres.cle, set: { valeur: next, updatedAt: new Date() } });
  return next;
}
