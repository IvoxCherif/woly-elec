import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { seed } from "@/db/seed";

vi.mock("web-push", () => ({ default: { generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }), sendNotification: vi.fn(async () => ({ statusCode: 201 })) } }));

// SasPay et DexPay simulés : aucune requête réelle
const calls: { url: string; body?: Record<string, unknown>; headers?: Record<string, string> }[] = [];
let checkout = { status: "PENDING", transaction_status: null as string | null };
let pay: { status: number; body: Record<string, unknown> } = { status: 200, body: { reference: "BP_1", status: "processing", token: null } };
let lookup: Record<string, unknown> = { reference: "BP_1", status: "completed", token: "45821036740012345678", fee_amount: 50 };
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: string, init?: RequestInit) => {
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ url, body, headers: init?.headers as Record<string, string> });
  const res = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { "Content-Type": "application/json" } });
  if (url.includes("/checkout-sessions/") && url.endsWith("/status/")) return res(200, { id: "cs_1", ...checkout, transaction_id: "tx_1" });
  if (url.includes("/checkout-sessions/")) return res(201, { id: "cs_1", checkout_url: "https://pay.saspay.me/cs_1", status: "PENDING" });
  if (url.includes("/bill-payments/inquiry")) return res(200, { bills: [{ customer_name: "Marie Fall", address: "HLM Grand Yoff", meter_status: "ACTIVE" }] });
  if (url.includes("/bill-payments/pay")) return res(pay.status, pay.body);
  if (url.includes("/bill-payments/")) return res(200, lookup);
  return res(404, {});
}) as typeof fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

const { saveSaspayConfig } = await import("./saspay");
const { saveDexpayConfig, dexpayConfig } = await import("./dexpay");
const { signup, buildState } = await import("./repo");
const rc = await import("./recharge");

let db: DB;
const ORIGIN = "https://wolyelec.com";

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as DB;
  await seed(db);
});

const client = (email: string, meter: string) =>
  signup(db, {
    identity: { kind: "email", email, passwordHash: "scrypt:00:00" },
    name: "Awa",
    meter: { number: meter, name: "Maison", usage: "Ménage", phase: "mono" },
    reading: { balanceKwh: 40, monthKwh: 80, yesterdayKwh: 5 },
    prefs: { consent: true },
  });

describe("vente de recharges Woyofal", () => {
  it("reste invisible tant que l'administrateur ne l'active pas", async () => {
    const id = await client("vente0@exemple.sn", "0145 4444 000");
    expect(await rc.rechargeOffer(db)).toBeNull();
    await saveSaspayConfig(db, { cle: "sk_test_saspay123456", actif: true });
    await saveDexpayConfig(db, { cle: "sk_test_dexpay123456", fraisPct: 1, fraisFixe: 100 });
    expect(await rc.rechargeOffer(db)).toBeNull(); // clé enregistrée mais vente non activée
    expect((await buildState(db, id))!.rechargeEnLigne).toBeUndefined();
    await expect(rc.startPurchase(db, id, { meterId: "x", montant: 5000 }, ORIGIN)).rejects.toThrow("recharge_indisponible");
    await saveDexpayConfig(db, { actif: true });
    expect(await rc.rechargeOffer(db)).toEqual({ fraisPct: 1, fraisFixe: 100 });
    expect((await buildState(db, id))!.rechargeEnLigne).toEqual({ fraisPct: 1, fraisFixe: 100 });
    expect((await dexpayConfig(db)).sandbox).toBe(true); // clé sk_test_ : bac à sable
  });

  it("paiement confirmé → achat DexPay → code livré et recharge enregistrée", async () => {
    const id = await client("vente1@exemple.sn", "0145 4444 001");
    const meterId = (await db.select().from(schema.compteurs)).find((m) => m.clientId === id)!.id;
    expect(await rc.checkMeter(db, id, meterId)).toMatchObject({ nom: "Marie Fall", statut: "ACTIVE" });
    await expect(rc.startPurchase(db, id, { meterId, montant: 500 }, ORIGIN)).rejects.toThrow("montant_invalide");

    const start = await rc.startPurchase(db, id, { meterId, montant: 10000 }, ORIGIN);
    expect(start).toMatchObject({ url: "https://pay.saspay.me/cs_1", total: 10200 }); // 1 % + 100 F
    const sas = calls.filter((c) => c.url.endsWith("/checkout-sessions/")).at(-1)!;
    expect(sas.body).toMatchObject({ amount: "10200.00", metadata: { kind: "recharge_woyofal", reference: start.reference } });

    const get = async () => (await db.select().from(schema.achatsRecharge)).find((a) => a.reference === start.reference)!;
    // Paiement pas encore confirmé : rien n'est acheté
    expect(await rc.reconcilePurchase(db, await get(), ORIGIN)).toBe("en_attente");
    expect(calls.some((c) => c.url.includes("/bill-payments/pay"))).toBe(false);

    // Paiement confirmé : achat chez DexPay (en cours), puis code reçu à la vérification suivante
    checkout = { status: "PAID", transaction_status: "SUCCESS" };
    expect(await rc.reconcilePurchase(db, await get(), ORIGIN)).toBe("en_cours");
    const buy = calls.find((c) => c.url.includes("/bill-payments/pay"))!;
    expect(buy.url.startsWith("https://api-sandbox.dexpay.africa")).toBe(true);
    expect(buy.body).toMatchObject({ service_code: "WOYOFAL_SN_BILL", reference_client: "01454444001", amount: 10000 });
    expect(buy.headers?.["Idempotency-Key"]).toBe((await get()).id);

    expect(await rc.reconcilePurchase(db, await get(), ORIGIN)).toBe("livre");
    const done = await get();
    expect(done.token).toBe("45821036740012345678");
    expect(rc.publicPurchase(done).token).toBe("4582 1036 7400 1234 5678");
    // La recharge apparaît dans l'historique du compteur avec son code
    const s = (await buildState(db, id))!;
    const r = s.recharges.find((x) => x.amount === 10000)!;
    expect(r.vendor).toBe("Woly Elec");
    expect(r.tokens).toEqual(["45821036740012345678"]);
    expect(s.alerts.some((a) => a.title === "Votre recharge est prête")).toBe(true);
    // Vérification répétée : pas de second achat ni de seconde recharge
    await rc.reconcilePurchase(db, done, ORIGIN);
    expect(calls.filter((c) => c.url.includes("/bill-payments/pay"))).toHaveLength(1);
    expect((await buildState(db, id))!.recharges.filter((x) => x.amount === 10000)).toHaveLength(1);
  });

  it("échec chez DexPay après paiement : à rembourser, relance possible", async () => {
    const id = await client("vente2@exemple.sn", "0145 4444 002");
    const meterId = (await db.select().from(schema.compteurs)).find((m) => m.clientId === id)!.id;
    checkout = { status: "PENDING", transaction_status: null };
    const start = await rc.startPurchase(db, id, { meterId, montant: 5000 }, ORIGIN);
    const get = async () => (await db.select().from(schema.achatsRecharge)).find((a) => a.reference === start.reference)!;
    checkout = { status: "PAID", transaction_status: "SUCCESS" };
    pay = { status: 400, body: { statusCode: 400, code: "INSUFFICIENT_BALANCE", available: 3000, requested: 5050 } };
    expect(await rc.reconcilePurchase(db, await get(), ORIGIN)).toBe("a_rembourser");
    expect((await get()).erreur).toBe("INSUFFICIENT_BALANCE");

    // Solde DexPay rechargé : l'administrateur relance l'achat (nouvelle clé d'idempotence)
    pay = { status: 200, body: { reference: "BP_2", status: "completed", token: "11112222333344445555", fee_amount: 50 } };
    await rc.adminPurchaseAction(db, start.reference, "relancer", ORIGIN);
    expect((await get()).statut).toBe("livre");
    const keys = calls.filter((c) => c.url.includes("/bill-payments/pay")).slice(-2).map((c) => c.headers?.["Idempotency-Key"]);
    expect(keys[0]).not.toBe(keys[1]);
    await expect(rc.adminPurchaseAction(db, start.reference, "rembourse", ORIGIN)).rejects.toThrow("statut_invalide");
  });
});
