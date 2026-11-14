import "server-only";
import { NextResponse } from "next/server";
import { getDb, type DB } from "@/db";
import { ActionError } from "./repo";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Exécute un traitement avec la base ; 503 si aucune base n'est configurée (mode démonstration). */
export async function withDb(fn: (db: DB) => Promise<Response>): Promise<Response> {
  let db: DB | null;
  try {
    db = await getDb();
  } catch (e) {
    console.error("[db] connexion impossible", e);
    return json({ error: "base_indisponible" }, 503);
  }
  if (!db) return json({ error: "demo" }, 503);
  try {
    return await fn(db);
  } catch (e) {
    if (e instanceof ActionError) return json({ error: e.code }, e.status);
    console.error("[api] erreur", e);
    return json({ error: "erreur_serveur" }, 500);
  }
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
