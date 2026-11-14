import { pendingGoogle } from "@/server/auth";
import { json } from "@/server/http";

export const runtime = "nodejs";

/** Compte Google vérifié en attente de fin d'inscription (e-mail et nom à afficher). */
export async function GET() {
  const g = await pendingGoogle();
  return g ? json({ email: g.email, name: g.name ?? "" }) : json({ error: "aucun" }, 404);
}
