import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { deviceId, setPending2fa, setPendingGoogle, takeOAuthState } from "@/server/auth";
import { sendEmailCode } from "@/server/email-code";
import { loginLocked } from "@/server/ratelimit";
import { googleProfile } from "@/server/google";
import { publicOrigin } from "@/server/ratelimit";

export const runtime = "nodejs";

/**
 * Retour de Google :
 * - compte existant (même identifiant Google, ou même e-mail vérifié) → code à 6 chiffres envoyé par e-mail,
 *   la connexion se termine sur /connexion après saisie du code (compte lié à Google)
 * - nouveau → identité mémorisée 30 min, suite de l'inscription (compteur, relevés…)
 */
export async function GET(req: Request) {
  const origin = publicOrigin(req);
  const url = new URL(req.url);
  const saved = await takeOAuthState();
  const mode = saved?.mode === "inscription" ? "inscription" : "connexion";
  const fail = (code: string) => NextResponse.redirect(`${origin}/${mode}?erreur=${code}`);

  if (url.searchParams.get("error")) return fail("google_annule");
  const code = url.searchParams.get("code");
  if (!saved || !code || url.searchParams.get("state") !== saved.state) return fail("google_session");

  const profile = await googleProfile(origin, code).catch(() => null);
  if (!profile) return fail("google_refuse");

  const db = await getDb().catch(() => null);
  if (!db) return fail("google_indisponible");

  const [byGoogle] = await db.select({ id: clients.id }).from(clients).where(eq(clients.googleId, profile.sub));
  const [byEmail] = byGoogle ? [] : await db.select({ id: clients.id }).from(clients).where(eq(clients.email, profile.email));
  const existing = byGoogle ?? byEmail;
  if (existing) {
    if (!byGoogle) await db.update(clients).set({ googleId: profile.sub, emailVerifie: true }).where(eq(clients.id, existing.id));
    const [acc] = await db.select({ email: clients.email }).from(clients).where(eq(clients.id, existing.id));
    const email = acc?.email ?? profile.email;
    const wait = loginLocked(`mail:${email}`, `dev:${await deviceId()}`);
    if (wait) return NextResponse.redirect(`${origin}/connexion?erreur=bloque&minutes=${wait}`);
    const sent = await sendEmailCode(db, "connexion", email);
    if (!sent.ok) return fail(sent.error);
    await setPending2fa({ clientId: existing.id, email, via: "google" });
    return NextResponse.redirect(`${origin}/connexion?etape=code${sent.demoCode ? `&demo=${sent.demoCode}` : ""}`);
  }
  await setPendingGoogle({ kind: "google", sub: profile.sub, email: profile.email, name: profile.name });
  return NextResponse.redirect(`${origin}/inscription?google=1`);
}
