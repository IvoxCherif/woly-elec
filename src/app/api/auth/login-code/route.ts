import { clearPending2fa, deviceId, pending2fa, startClientSession } from "@/server/auth";
import { checkEmailCode, sendEmailCode } from "@/server/email-code";
import { json, readJson, withDb } from "@/server/http";
import { loginFailed, loginLocked, loginSucceeded, maskEmail } from "@/server/ratelimit";

export const runtime = "nodejs";

/** Connexion en cours (étape du code) : adresse masquée, ou rien. */
export async function GET() {
  const p = await pending2fa();
  return json(p ? { email: maskEmail(p.email), via: p.via } : { email: null });
}

/**
 * Connexion, étape 2 : { code } vérifie le code à 6 chiffres reçu par e-mail et ouvre la session ;
 * { renvoyer: true } envoie un nouveau code. 5 codes faux → connexion bloquée 10 minutes.
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const p = await pending2fa();
    if (!p) return json({ error: "session_expiree" }, 401);
    const keys = [`mail:${p.email}`, `dev:${await deviceId()}`];
    const wait = loginLocked(...keys);
    if (wait) return json({ error: "bloque", minutes: wait }, 429);

    const body = await readJson<{ code?: string; renvoyer?: boolean }>(req);
    if (body?.renvoyer) {
      const sent = await sendEmailCode(db, "connexion", p.email);
      if (!sent.ok) return json({ error: sent.error }, sent.error === "trop_de_codes" ? 429 : 503);
      return json({ ok: true, demoCode: sent.demoCode });
    }
    const code = String(body?.code ?? "").replace(/\D/g, "");
    if (code.length === 6 && (await checkEmailCode(db, "connexion", p.email, code))) {
      loginSucceeded(...keys);
      await clearPending2fa();
      await startClientSession(p.clientId);
      return json({ ok: true });
    }
    const left = loginFailed(...keys);
    if (left === 0) {
      await clearPending2fa();
      return json({ error: "bloque", minutes: 10 }, 429);
    }
    return json({ error: "code_invalide", essais: left }, 401);
  });
}
