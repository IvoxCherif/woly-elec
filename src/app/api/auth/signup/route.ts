import { hashPassword } from "@/lib/admin-password";
import { clearPending, normalizeEmail, pendingGoogle, pendingVerifiedEmail, startClientSession } from "@/server/auth";
import { sendMail, welcomeMail } from "@/server/mail";
import { json, readJson, withDb } from "@/server/http";
import { buildState, signup, type Identity, type SignupInput } from "@/server/repo";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

type Body = Omit<SignupInput, "identity"> & { account?: { email?: string; password?: string } };

/**
 * Crée le compte : identité (Google déjà vérifié, ou e-mail + mot de passe), compteur, premier relevé,
 * dernière recharge et essai gratuit.
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const ipKey = `signup:${clientIp(req)}`;
    if (isBlocked(ipKey, 10, 3600_000)) return json({ error: "trop_de_comptes" }, 429);
    const body = await readJson<Body>(req);
    if (!body?.meter) return json({ error: "requete_invalide" }, 400);

    let identity: Identity;
    const google = await pendingGoogle();
    if (google) identity = google;
    else {
      const email = normalizeEmail(body.account?.email ?? "");
      const password = String(body.account?.password ?? "");
      if (!email) return json({ error: "email_invalide" }, 400);
      // L'adresse doit avoir été confirmée par le code à 6 chiffres reçu par e-mail
      if ((await pendingVerifiedEmail()) !== email) return json({ error: "email_non_verifie" }, 401);
      if (password.length < 8 || password.length > 200) return json({ error: "mot_de_passe_court" }, 400);
      identity = { kind: "email", email, passwordHash: await hashPassword(password) };
    }

    const { account: _a, ...rest } = body;
    const id = await signup(db, { ...rest, identity });
    recordFailure(ipKey, 3600_000); // compte les créations par IP
    await startClientSession(id);
    await clearPending();
    const state = await buildState(db, id);
    void sendMail({ to: identity.email.toLowerCase(), ...welcomeMail(body.name || (identity.kind === "google" ? identity.name ?? "" : ""), state?.subscription.status === "essai") });
    return json({ ok: true });
  });
}
