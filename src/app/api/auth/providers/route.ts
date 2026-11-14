import { dbConfigured } from "@/db";
import { json } from "@/server/http";
import { googleEnabled } from "@/server/google";

export const runtime = "nodejs";

/** Méthodes de connexion disponibles sur ce serveur. */
export async function GET() {
  return json({ comptes: dbConfigured(), google: dbConfigured() && googleEnabled() });
}
