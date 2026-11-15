import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { parametres } from "@/db/schema";
import { seal, unseal } from "./vault";

/**
 * Paiement en ligne par SasPay (https://docs.saspay.me) : page de paiement hébergée
 * (Wave, Orange Money, Free Money, carte…), confirmation par webhook signé et par vérification du statut.
 *
 * La clé secrète et le secret du webhook sont saisis dans l'administration (page Paiement) et enregistrés
 * chiffrés (AES-256-GCM) en base ; les variables SASPAY_SECRET_KEY / SASPAY_WEBHOOK_SECRET, si présentes, priment.
 * Attention : SasPay n'a pas de vrai bac à sable, même une clé sk_test_ peut débiter de l'argent réel.
 */

const API = process.env.SASPAY_API_URL || "https://api.saspay.me/api/v1";
const KEY = "saspay";

type Stored = { cle?: string; webhook?: string; actif?: boolean; apercu?: string };

// Secrets chiffrés en base (même dérivation de clé qu'avant : usage « saspay »)
const encrypt = (plain: string) => seal("saspay", plain);
const decrypt = (box: string | undefined) => unseal("saspay", box);

async function readStored(db: DB): Promise<Stored> {
  const [row] = await db.select().from(parametres).where(eq(parametres.cle, KEY));
  return (row?.valeur as Stored | undefined) ?? {};
}

export type SaspayConfig = { key: string | null; webhookSecret: string | null; enabled: boolean; preview: string | null };

export async function saspayConfig(db: DB): Promise<SaspayConfig> {
  const s = await readStored(db);
  const key = process.env.SASPAY_SECRET_KEY?.trim() || decrypt(s.cle);
  const webhookSecret = process.env.SASPAY_WEBHOOK_SECRET?.trim() || decrypt(s.webhook);
  const preview = process.env.SASPAY_SECRET_KEY ? `${process.env.SASPAY_SECRET_KEY.slice(0, 12)}…` : (s.apercu ?? null);
  return { key, webhookSecret, enabled: !!s.actif || !!process.env.SASPAY_SECRET_KEY, preview };
}

/** Enregistre la configuration depuis l'administration. Une valeur vide ne remplace pas la valeur existante. */
export async function saveSaspayConfig(db: DB, input: { cle?: string; webhook?: string; actif?: boolean }) {
  const s = await readStored(db);
  const next: Stored = { ...s };
  const cle = input.cle?.trim();
  if (cle) {
    // Les clés SasPay contiennent aussi « - » et « _ » (ex. sk_live_z4e…_p-lu…)
    if (!/^sk_(live|test)_[A-Za-z0-9_-]{8,}$/.test(cle)) throw new Error("cle_invalide");
    next.cle = encrypt(cle);
    next.apercu = `${cle.slice(0, 12)}…`;
  }
  const webhook = input.webhook?.trim();
  if (webhook) {
    // Le secret du webhook n'est pas une clé API : on refuse une clé sk_… collée dans le mauvais champ
    if (/^sk_(live|test)_/.test(webhook) || webhook.length < 8) throw new Error("webhook_invalide");
    next.webhook = encrypt(webhook);
  }
  if (typeof input.actif === "boolean") next.actif = input.actif;
  await db.insert(parametres).values({ cle: KEY, valeur: next }).onConflictDoUpdate({ target: parametres.cle, set: { valeur: next, updatedAt: new Date() } });
}

/** Mode de paiement en vigueur : « saspay » si une clé est configurée et activée, sinon PAYMENT_MODE (démo par défaut). */
export async function paymentMode(db: DB): Promise<"saspay" | "demo" | "off"> {
  const c = await saspayConfig(db);
  if (c.enabled && c.key) return "saspay";
  return (process.env.PAYMENT_MODE ?? "demo") === "demo" ? "demo" : "off";
}

// ——— Appels à l'API ———

export class SaspayError extends Error {
  constructor(public status: number, public code: string) {
    super(`saspay ${status} ${code}`);
  }
}

async function call<T>(key: string, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => null)) as { success?: boolean; data?: unknown; code?: string; error?: { code?: string } | Record<string, unknown> } | null;
  if (!r.ok) {
    const code = (j?.error && typeof j.error === "object" && "code" in j.error ? String(j.error.code) : null) ?? j?.code ?? `http_${r.status}`;
    throw new SaspayError(r.status, String(code));
  }
  // Les réponses sont enveloppées dans { success, data } ; certaines routes renvoient l'objet directement
  return ((j && typeof j === "object" && "data" in j && j.data !== undefined ? j.data : j) ?? {}) as T;
}

export type CheckoutSession = { id: string; checkout_url: string; status: string };

export async function createCheckout(
  key: string,
  v: { amount: number; description: string; email: string; name: string; phone?: string; returnUrl: string; metadata: Record<string, string> },
): Promise<CheckoutSession> {
  return call<CheckoutSession>(key, "POST", "/checkout-sessions/", {
    amount: `${Math.round(v.amount)}.00`, // montant en chaîne décimale, jamais en flottant
    currency: "XOF",
    country: "SN",
    description: v.description,
    customer_email: v.email,
    customer_name: v.name,
    customer_phone: v.phone ?? "",
    return_url: v.returnUrl,
    metadata: v.metadata,
  });
}

export type CheckoutStatus = { id: string; status: "PENDING" | "PAID" | "EXPIRED" | "CANCELLED" | string; transaction_id?: string | null; transaction_status?: string | null };

/** Revérifie l'état réel du paiement auprès de SasPay (source de vérité, jamais le retour du navigateur). */
export async function checkoutStatus(key: string, id: string): Promise<CheckoutStatus> {
  return call<CheckoutStatus>(key, "GET", `/checkout-sessions/${encodeURIComponent(id)}/status/`);
}

/** Test de la clé sans rien débiter : lecture des tarifs du compte marchand. */
export async function testKey(key: string): Promise<"ok" | "refusee" | "injoignable"> {
  try {
    await call(key, "GET", "/pricing/my-rates/");
    return "ok";
  } catch (e) {
    if (e instanceof SaspayError && (e.status === 401 || e.status === 403)) return "refusee";
    return "injoignable";
  }
}

// ——— Webhook ———

/** Signature : HMAC-SHA256 hexadécimal de `${timestamp}.${corps brut}`, horodatage à moins de 5 minutes. */
export function verifyWebhook(rawBody: string, signature: string | null, timestamp: string | null, secret: string, now = Date.now()): boolean {
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature.trim().toLowerCase());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
