import { sql } from "drizzle-orm";
import type { DB } from "./index";
import { modelesMessages, tarifs } from "./schema";
import { DEFAULT_TARIFF, tariffToJson } from "@/lib/engine";
import { TEMPLATES } from "@/lib/templates";

/** Données initiales : grille DPP 2026 et modèles de messages du cahier des charges (seulement si les tables sont vides). */
export async function seed(db: DB) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(tarifs);
  if (n === 0) {
    await db.insert(tarifs).values({ version: "Décision CRSE 2025-140 (01/01/2026)", config: tariffToJson(DEFAULT_TARIFF), active: true });
  }
  await db
    .insert(modelesMessages)
    .values(TEMPLATES.map((t) => ({ id: t.id, nom: t.name, canal: t.channel, texte: t.text })))
    .onConflictDoNothing();
}
