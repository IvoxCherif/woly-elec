import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { activePixelId } from "@/server/pixel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Identifiant public du Pixel Meta (null tant que l'administrateur ne l'a pas activé). */
export async function GET() {
  let id: string | null = null;
  try {
    const db = await getDb();
    if (db) id = await activePixelId(db);
  } catch {
    id = null;
  }
  return NextResponse.json({ id }, { headers: { "Cache-Control": "public, max-age=60" } });
}
