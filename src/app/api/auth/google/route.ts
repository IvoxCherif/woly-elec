import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { dbConfigured } from "@/db";
import { setOAuthState } from "@/server/auth";
import { googleAuthUrl, googleEnabled } from "@/server/google";
import { publicOrigin } from "@/server/ratelimit";

export const runtime = "nodejs";

/** Démarre la connexion Google : /api/auth/google?mode=connexion|inscription */
export async function GET(req: Request) {
  const origin = publicOrigin(req);
  const mode = new URL(req.url).searchParams.get("mode") === "inscription" ? "inscription" : "connexion";
  if (!googleEnabled() || !dbConfigured()) return NextResponse.redirect(`${origin}/${mode}?erreur=google_indisponible`);
  const state = randomBytes(24).toString("base64url");
  await setOAuthState(state, mode);
  return NextResponse.redirect(googleAuthUrl(origin, state));
}
