import { NextResponse } from "next/server";
import { ADMIN_COOKIE, createSessionToken, sessionSecret } from "@/lib/admin-session";
import { verifyPassword } from "@/lib/admin-password";
import { getDb } from "@/db";
import { effectiveAdminHash } from "@/server/admin-password-store";
import { adminIdentifier, isAdminIdentifier } from "@/server/admin-identity";

export const runtime = "nodejs";

// Limite anti force brute : 5 échecs par adresse IP sur 15 minutes (mémoire du conteneur).
const WINDOW = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map<string, { count: number; since: number }>();

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "inconnue";
}

export async function POST(req: Request) {
  const identifiant = adminIdentifier();
  // Mot de passe réinitialisé par e-mail (en base) s'il existe, sinon celui de hPanel
  const hash = await effectiveAdminHash(await getDb().catch(() => null));
  const secret = sessionSecret();
  if (!identifiant || !hash || !secret) {
    return NextResponse.json({ error: "non_configure" }, { status: 503 });
  }

  const ip = clientIp(req);
  const now = Date.now();
  const entry = fails.get(ip);
  if (entry && now - entry.since < WINDOW && entry.count >= MAX_FAILS) {
    const wait = Math.ceil((entry.since + WINDOW - now) / 60000);
    return NextResponse.json({ error: "bloque", minutes: wait }, { status: 429 });
  }

  let body: { identifiant?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "requete_invalide" }, { status: 400 });
  }
  const password = String(body.password ?? "");
  // Le mot de passe est vérifié même si l'identifiant est faux : même durée de réponse dans les deux cas.
  const passOk = password.length > 0 && password.length <= 256 && (await verifyPassword(password, hash));

  if (!passOk || !isAdminIdentifier(body.identifiant ?? body.email)) {
    const e = entry && now - entry.since < WINDOW ? entry : { count: 0, since: now };
    e.count += 1;
    fails.set(ip, e);
    return NextResponse.json({ error: "identifiants", restants: Math.max(0, MAX_FAILS - e.count) }, { status: 401 });
  }

  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    // Cookie de session : effacé à la fermeture du navigateur ou de l'appli (le jeton expire de toute façon)
  });
  return res;
}
