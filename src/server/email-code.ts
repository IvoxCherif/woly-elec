import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { codesOtp } from "@/db/schema";
import { clientSessionSecret } from "./secrets";
import { codeMail, mailEnabled, sendMail } from "./mail";

/** Codes à 6 chiffres envoyés par e-mail : vérification d'adresse à l'inscription, mot de passe oublié, connexion. */
export type CodeUsage = "verification" | "reinitialisation" | "admin" | "connexion";

const TTL_MIN = 10;
const MAX_PER_HOUR = 5;
const MAX_TRIES = 5;

const keyOf = (usage: CodeUsage, email: string) => `${usage}:${email}`;
const hashCode = (key: string, code: string) => createHmac("sha256", clientSessionSecret() ?? "code").update(`${key}:${code}`).digest("hex");

export type CodeResult = { ok: true; demoCode?: string } | { ok: false; error: "trop_de_codes" | "email_indisponible" };

export async function sendEmailCode(db: DB, usage: CodeUsage, email: string): Promise<CodeResult> {
  const key = keyOf(usage, email);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(codesOtp)
    .where(and(eq(codesOtp.telephone, key), gt(codesOtp.createdAt, new Date(Date.now() - 3600_000))));
  if (n >= MAX_PER_HOUR) return { ok: false, error: "trop_de_codes" };
  // Sans SMTP en production, on n'enregistre pas de code : l'utilisateur ne pourrait pas le recevoir.
  if (!mailEnabled() && process.env.NODE_ENV === "production") return { ok: false, error: "email_indisponible" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(codesOtp).values({ telephone: key, codeHash: hashCode(key, code), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) });
  const { sent } = await sendMail({ to: email, ...codeMail(code, usage) });
  if (sent) return { ok: true };
  if (process.env.NODE_ENV !== "production") return { ok: true, demoCode: code }; // développement sans SMTP
  return { ok: false, error: "email_indisponible" };
}

export async function checkEmailCode(db: DB, usage: CodeUsage, email: string, code: string): Promise<boolean> {
  const key = keyOf(usage, email);
  const [row] = await db
    .select()
    .from(codesOtp)
    .where(and(eq(codesOtp.telephone, key), eq(codesOtp.utilise, false), gt(codesOtp.expiresAt, new Date())))
    .orderBy(desc(codesOtp.createdAt))
    .limit(1);
  if (!row || row.tentatives >= MAX_TRIES) return false;
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(hashCode(key, String(code).replace(/\D/g, "")), "hex");
  const ok = a.length === b.length && timingSafeEqual(a, b);
  await db.update(codesOtp).set(ok ? { utilise: true } : { tentatives: row.tentatives + 1 }).where(eq(codesOtp.id, row.id));
  return ok;
}
