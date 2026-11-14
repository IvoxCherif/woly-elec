import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/admin-password";
import { ADMIN_COOKIE, SESSION_HOURS, createSessionToken, sessionSecret } from "@/lib/admin-session";
import { saveAdminHash } from "@/server/admin-password-store";
import { normalizeEmail } from "@/server/auth";
import { checkEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";

export const runtime = "nodejs";

/** Code reçu par e-mail + nouveau mot de passe administrateur (12 caractères minimum), puis connexion. */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const admin = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
    const secret = sessionSecret();
    if (!admin || !secret || !process.env.ADMIN_PASSWORD_HASH) return json({ error: "non_configure" }, 503);
    const body = await readJson<{ email?: string; code?: string; password?: string }>(req);
    const password = String(body?.password ?? "");
    if (password.length < 12 || password.length > 256) return json({ error: "mot_de_passe_court" }, 400);
    if (normalizeEmail(body?.email ?? "") !== admin || !body?.code) return json({ error: "code_invalide" }, 401);
    if (!(await checkEmailCode(db, "admin", admin, body.code))) return json({ error: "code_invalide" }, 401);
    await saveAdminHash(db, await hashPassword(password));
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, await createSessionToken(secret), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_HOURS * 3600,
    });
    return res;
  });
}
