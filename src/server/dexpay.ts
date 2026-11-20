import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import { parametres } from "@/db/schema";
import { seal, unseal } from "./vault";

/**
 * Vente de recharges Woyofal par l'API « paiement de factures » de DexPay (https://docs.dexpay.africa).
 * - consultation du compteur (nom du titulaire chez Senelec, statut) sans débit ;
 * - achat de la recharge sur le solde prépayé DexPay, le code de 20 chiffres est renvoyé tout de suite ou par webhook.
 * La clé et le secret du webhook sont saisis dans l'administration (page Recharges Woyofal) et chiffrés en base.
 * Tant que la vente n'est pas activée par l'administrateur, rien n'apparaît dans l'application.
 */

const KEY = "dexpay";
const SERVICE = "WOYOFAL_SN_BILL";
const BASE = { sandbox: "https://api-sandbox.dexpay.africa/api/v1", live: "https://api.dexpay.africa/api/v1" };

type Stored = { cle?: string; webhook?: string; actif?: boolean; sandbox?: boolean; apercu?: string; fraisPct?: number; fraisFixe?: number };

export type DexpayConfig = { key: string | null; webhookSecret: string | null; enabled: boolean; sandbox: boolean; preview: string | null; fraisPct: number; fraisFixe: number };

async function readStored(db: DB): Promise<Stored> {
  const [row] = await db.select().from(parametres).where(eq(parametres.cle, KEY));
  return (row?.valeur as Stored | undefined) ?? {};
}

export async function dexpayConfig(db: DB): Promise<DexpayConfig> {
  const s = await readStored(db);
  const key = unseal("dexpay", s.cle);
  return {
    key,
    webhookSecret: unseal("dexpay", s.webhook),
    enabled: !!s.actif,
    // Une clé sk_test_ ne fonctionne que sur le bac à sable, une clé sk_live_ qu'en production
    sandbox: key ? key.startsWith("sk_test_") : !!s.sandbox,
    preview: s.apercu ?? null,
    fraisPct: s.fraisPct ?? 0,
    fraisFixe: s.fraisFixe ?? 0,
  };
}

/** Enregistre la configuration depuis l'administration. Une valeur vide ne remplace pas la valeur existante. */
export async function saveDexpayConfig(db: DB, input: { cle?: string; webhook?: string; actif?: boolean; sandbox?: boolean; fraisPct?: number; fraisFixe?: number }) {
  const s = await readStored(db);
  const next: Stored = { ...s };
  const cle = input.cle?.trim();
  if (cle) {
    if (!/^sk_(live|test)_[A-Za-z0-9_-]{8,}$/.test(cle)) throw new Error("cle_invalide");
    next.cle = seal("dexpay", cle);
    next.apercu = `${cle.slice(0, 12)}…`;
    next.sandbox = cle.startsWith("sk_test_");
  }
  const webhook = input.webhook?.trim();
  if (webhook) {
    if (/^sk_(live|test)_/.test(webhook) || webhook.length < 8) throw new Error("webhook_invalide");
    next.webhook = seal("dexpay", webhook);
  }
  if (typeof input.actif === "boolean") next.actif = input.actif;
  if (typeof input.sandbox === "boolean" && !cle) next.sandbox = input.sandbox;
  if (input.fraisPct !== undefined) {
    const v = Number(input.fraisPct);
    if (!Number.isFinite(v) || v < 0 || v > 20) throw new Error("frais_invalides");
    next.fraisPct = Math.round(v * 100) / 100;
  }
  if (input.fraisFixe !== undefined) {
    const v = Number(input.fraisFixe);
    if (!Number.isInteger(v) || v < 0 || v > 5000) throw new Error("frais_invalides");
    next.fraisFixe = v;
  }
  await db.insert(parametres).values({ cle: KEY, valeur: next }).onConflictDoUpdate({ target: parametres.cle, set: { valeur: next, updatedAt: new Date() } });
}

/** Frais de service payés par le client en plus de la recharge (réglage de l'administrateur). */
export const clientFees = (amount: number, c: Pick<DexpayConfig, "fraisPct" | "fraisFixe">) => Math.round((amount * c.fraisPct) / 100 + c.fraisFixe);

// ——— Appels à l'API ———

export class DexpayError extends Error {
  constructor(
    public status: number,
    public code: string,
    public body?: Record<string, unknown>,
  ) {
    super(code);
  }
}

async function call<T>(c: DexpayConfig, method: "GET" | "POST", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  if (!c.key) throw new DexpayError(503, "non_configure");
  const res = await fetch(`${c.sandbox ? BASE.sandbox : BASE.live}${path}`, {
    method,
    headers: { "x-api-secret": c.key, "Content-Type": "application/json", Accept: "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
  });
  const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  // Certaines réponses sont enveloppées dans { data }
  const data = (j && typeof j === "object" && "data" in j && j.data && typeof j.data === "object" ? j.data : j) as Record<string, unknown>;
  if (!res.ok) throw new DexpayError(res.status, String(j.code ?? data.code ?? `http_${res.status}`), j);
  return data as T;
}

export type MeterInfo = { nom: string; adresse: string; statut: string };

/** Consultation du compteur (aucun débit) : nom du titulaire chez Senelec, adresse, statut (ACTIVE…). */
export async function inquiryMeter(c: DexpayConfig, numero: string): Promise<MeterInfo | null> {
  try {
    const r = await call<{ bills?: { customer_name?: string; address?: string; meter_status?: string | null }[] }>(c, "POST", "/bill-payments/inquiry", {
      service_code: SERVICE,
      reference_client: numero.replace(/\D/g, ""),
    });
    const b = r.bills?.[0];
    return { nom: String(b?.customer_name ?? ""), adresse: String(b?.address ?? ""), statut: String(b?.meter_status ?? "") };
  } catch (e) {
    if (e instanceof DexpayError && e.code === "BILL_NOT_FOUND") return null;
    throw e;
  }
}

export type BillPayment = { reference: string; status: "initiated" | "processing" | "completed" | "failed" | "refunded" | string; amount?: number; fee_amount?: number; total_debited?: number; token?: string | null; provider_tx_id?: string | null; failure_reason?: string | null };

/** Achat de la recharge sur le solde DexPay. La même clé d'idempotence ne débite jamais deux fois. */
export async function payRecharge(c: DexpayConfig, v: { numero: string; amount: number; idempotencyKey: string; callBackURL: string; customData: string }): Promise<BillPayment> {
  try {
    return await call<BillPayment>(
      c,
      "POST",
      "/bill-payments/pay",
      { service_code: SERVICE, reference_client: v.numero.replace(/\D/g, ""), amount: Math.round(v.amount), callBackURL: v.callBackURL, customData: v.customData },
      v.idempotencyKey,
    );
  } catch (e) {
    // Requête rejouée : l'opération d'origine est renvoyée, sans nouveau débit
    if (e instanceof DexpayError && e.status === 409 && e.body?.reference) return { reference: String(e.body.reference), status: String(e.body.status ?? "processing") };
    throw e;
  }
}

export async function billPayment(c: DexpayConfig, reference: string): Promise<BillPayment> {
  return call<BillPayment>(c, "GET", `/bill-payments/${encodeURIComponent(reference)}`);
}

/** Test de la clé sans débit : une consultation d'un compteur inconnu répond 404 si la clé est acceptée. */
export async function testDexpayKey(c: DexpayConfig): Promise<"ok" | "refusee" | "injoignable"> {
  try {
    await inquiryMeter(c, "00000000000");
    return "ok";
  } catch (e) {
    if (e instanceof DexpayError) return e.status === 401 || e.status === 403 ? "refusee" : e.status === 404 || e.status === 400 ? "ok" : "injoignable";
    return "injoignable";
  }
}

/** Webhook DexPay : en-tête X-Dexpay-Signature = HMAC-SHA256(secret, corps brut), en hexadécimal ou base64. */
export function verifyDexpayWebhook(raw: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const sig = signature.replace(/^sha256=/, "").trim();
  const mac = createHmac("sha256", secret).update(raw).digest();
  for (const expected of [mac.toString("hex"), mac.toString("base64")]) {
    if (sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return true;
  }
  return false;
}
