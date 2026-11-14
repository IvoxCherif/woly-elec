import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { codesOtp } from "@/db/schema";
import { clientSessionSecret } from "./secrets";

const TTL_MIN = 10;
const MAX_PER_HOUR = 5;
const MAX_TRIES = 5;

const hashCode = (phone: string, code: string) =>
  createHmac("sha256", clientSessionSecret() ?? "otp").update(`${phone}:${code}`).digest("hex");

/**
 * Envoi du code par SMS. Aucun fournisseur SMS n'est encore branché (question ouverte du projet) :
 * tant que OTP_DEMO n'est pas à « false », le code est renvoyé à l'écran pour le pilote.
 */
async function sendSms(_phone: string, _text: string): Promise<boolean> {
  return false;
}

export const otpDemo = () => process.env.OTP_DEMO !== "false";

export async function requestOtp(db: DB, phone: string): Promise<{ ok: true; demoCode?: string } | { ok: false; error: "trop_de_codes" | "sms_indisponible" }> {
  const since = new Date(Date.now() - 3600_000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(codesOtp)
    .where(and(eq(codesOtp.telephone, phone), gt(codesOtp.createdAt, since)));
  if (n >= MAX_PER_HOUR) return { ok: false, error: "trop_de_codes" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.insert(codesOtp).values({ telephone: phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) });
  const sent = await sendSms(phone, `Woly Elec : votre code de connexion est ${code}. Il expire dans ${TTL_MIN} minutes.`);
  if (sent) return { ok: true };
  if (otpDemo()) return { ok: true, demoCode: code };
  return { ok: false, error: "sms_indisponible" };
}

export async function verifyOtp(db: DB, phone: string, code: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(codesOtp)
    .where(and(eq(codesOtp.telephone, phone), eq(codesOtp.utilise, false), gt(codesOtp.expiresAt, new Date())))
    .orderBy(desc(codesOtp.createdAt))
    .limit(1);
  if (!row || row.tentatives >= MAX_TRIES) return false;
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(hashCode(phone, String(code).replace(/\D/g, "")), "hex");
  const ok = a.length === b.length && timingSafeEqual(a, b);
  await db
    .update(codesOtp)
    .set(ok ? { utilise: true } : { tentatives: row.tentatives + 1 })
    .where(eq(codesOtp.id, row.id));
  return ok;
}
