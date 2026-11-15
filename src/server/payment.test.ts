import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { seed } from "@/db/seed";
import { applyAction, buildState, createPendingPayment, renewalReminders, setClientVip, attachCheckout, paymentByReference, priceOrder, settlePayment, signup } from "./repo";
import { paymentMode, saspayConfig, saveSaspayConfig, verifyWebhook } from "./saspay";
import { reconcile } from "./payment";

let db: DB;
const today = new Date(2026, 10, 17);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as DB;
  await seed(db);
});

afterEach(() => vi.unstubAllGlobals());

const newClient = (email: string, meter: string) =>
  signup(
    db,
    {
      identity: { kind: "email", email, passwordHash: "scrypt:00:00" },
      name: "Mme Sow",
      meter: { number: meter, name: "Maison", usage: "Ménage", phase: "mono" },
      reading: { balanceKwh: 40, monthKwh: 80, yesterdayKwh: 5 },
      lastRecharge: { date: "2026-11-03", amount: 10000 },
      prefs: { consent: true },
    },
    today,
  );

describe("paiement en ligne SasPay", () => {
  it("vérifie la signature du webhook (corps brut, horodatage à 5 minutes)", () => {
    const secret = "whsec_test";
    const body = '{"event":"transaction.success","data":{"id":"t1"}}';
    const now = Date.now();
    const ts = String(Math.floor(now / 1000));
    const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
    expect(verifyWebhook(body, sig, ts, secret, now)).toBe(true);
    expect(verifyWebhook(body + " ", sig, ts, secret, now)).toBe(false); // corps modifié
    expect(verifyWebhook(body, sig, ts, "autre", now)).toBe(false); // mauvais secret
    expect(verifyWebhook(body, sig, ts, secret, now + 6 * 60_000)).toBe(false); // trop ancien
    expect(verifyWebhook(body, null, ts, secret, now)).toBe(false);
  });

  it("enregistre la clé chiffrée et active le mode SasPay seulement sur demande", async () => {
    expect(await paymentMode(db)).toBe("demo");
    await expect(saveSaspayConfig(db, { cle: "pas-une-cle" })).rejects.toThrow("cle_invalide");
    await expect(saveSaspayConfig(db, { webhook: "sk_live_AbCdEfGh12345678" })).rejects.toThrow("webhook_invalide");
    await saveSaspayConfig(db, { cle: "sk_live_z4eYPRZq-Ab_Cd-EfGh_STY" }); // vraie forme : avec « - » et « _ »
    expect((await saspayConfig(db)).key).toBe("sk_live_z4eYPRZq-Ab_Cd-EfGh_STY");
    await saveSaspayConfig(db, { cle: "sk_live_AbCdEfGh12345678", webhook: "whsec_abc" });
    const [row] = await db.select().from(schema.parametres);
    expect(JSON.stringify(row.valeur)).not.toContain("sk_live_AbCdEfGh12345678"); // jamais en clair en base
    let c = await saspayConfig(db);
    expect(c).toMatchObject({ key: "sk_live_AbCdEfGh12345678", webhookSecret: "whsec_abc", enabled: false, preview: "sk_live_AbCd…" });
    expect(await paymentMode(db)).toBe("demo");
    await saveSaspayConfig(db, { actif: true, cle: "" }); // champ vide : la clé est conservée
    c = await saspayConfig(db);
    expect(c.key).toBe("sk_live_AbCdEfGh12345678");
    expect(await paymentMode(db)).toBe("saspay");
  });

  it("refuse le paiement simulé en mode SasPay, calcule le prix côté serveur", async () => {
    const id = await newClient("sow@exemple.sn", "0145 5555 001");
    await expect(applyAction(db, id, { type: "subscribe", pack: "ia", cycle: "mensuel", meters: 1, method: "Wave" }, today)).rejects.toThrow("paiement_en_ligne");
    const o = await priceOrder(db, id, { pack: "ia", cycle: "annuel", meters: 2 });
    expect(o.amount).toBe((2499 + 1499) * 11);
    const s = (await buildState(db, id, today))!;
    expect(s.paymentMode).toBe("saspay");
  });

  it("active l'abonnement une seule fois, après confirmation de SasPay", async () => {
    const id = await newClient("diop@exemple.sn", "0145 5555 002");
    const order = await priceOrder(db, id, { pack: "ia", cycle: "mensuel", meters: 1 });
    const ref = await createPendingPayment(db, id, order);
    await attachCheckout(db, ref, "sess-1");
    let s = (await buildState(db, id))!;
    expect(s.pendingPayment?.reference).toBe(ref);
    expect(s.subscription.payments).toHaveLength(0); // pas encore payé : absent de l'historique

    // SasPay : encore en attente
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ success: true, data: { id: "sess-1", status: "PENDING", transaction_status: "PENDING" } }), { status: 200 })));
    expect(await reconcile(db, "sk_live_x", (await paymentByReference(db, ref))!)).toBe("en_attente");
    expect((await buildState(db, id))!.subscription.status).toBe("essai");

    // SasPay : payé
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("/checkout-sessions/sess-1/status/");
      return new Response(JSON.stringify({ id: "sess-1", status: "PAID", transaction_id: "tx-9", transaction_status: "SUCCESS" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await reconcile(db, "sk_live_x", (await paymentByReference(db, ref))!)).toBe("confirme");
    s = (await buildState(db, id))!;
    expect(s.subscription.status).toBe("actif");
    expect(s.subscription.payments[0]).toMatchObject({ id: ref, amount: 2499 });
    expect(s.pendingPayment).toBeUndefined();
    const first = s.subscription.renewsAt;

    // Webhook reçu deux fois : aucun effet la deuxième fois
    expect(await settlePayment(db, (await paymentByReference(db, ref))!.id, "confirme")).toBe(false);
    expect((await buildState(db, id))!.subscription.renewsAt).toBe(first);
    expect((await paymentByReference(db, ref))!.transactionId).toBe("tx-9");
  });

  it("un renouvellement prolonge la période en cours, un abandon n'active rien", async () => {
    const id = await newClient("fall@exemple.sn", "0145 5555 003");
    const order = await priceOrder(db, id, { pack: "simple", cycle: "mensuel", meters: 1 });
    const r1 = await createPendingPayment(db, id, order);
    await settlePayment(db, (await paymentByReference(db, r1))!.id, "confirme", "tx-1", today);
    const until1 = (await buildState(db, id, today))!.subscription.renewsAt!;
    const r2 = await createPendingPayment(db, id, order);
    await settlePayment(db, (await paymentByReference(db, r2))!.id, "confirme", "tx-2", today);
    const until2 = (await buildState(db, id, today))!.subscription.renewsAt!;
    expect(until1).toBe("2026-12-17");
    expect(until2).toBe("2027-01-17");

    // Passer de Woly Elec 1 payé à Woly Elec IA demande un paiement
    await expect(applyAction(db, id, { type: "pack", pack: "ia" }, today)).rejects.toThrow("paiement_requis");

    const r3 = await createPendingPayment(db, id, order);
    await attachCheckout(db, r3, "sess-3");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "sess-3", status: "EXPIRED", transaction_status: null }), { status: 200 })));
    expect(await reconcile(db, "sk_live_x", (await paymentByReference(db, r3))!)).toBe("annule");
    expect((await buildState(db, id, today))!.subscription.renewsAt).toBe("2027-01-17");
  });

  it("garde le paiement en attente si SasPay est injoignable", async () => {
    const id = await newClient("ba@exemple.sn", "0145 5555 004");
    const ref = await createPendingPayment(db, id, await priceOrder(db, id, { pack: "ia", cycle: "mensuel", meters: 1 }));
    await attachCheckout(db, ref, "sess-4");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("réseau"); }));
    expect(await reconcile(db, "sk_live_x", (await paymentByReference(db, ref))!)).toBe("en_attente");
    expect((await paymentByReference(db, ref))!.statut).toBe("en_attente");
  });
  it("rappels de renouvellement : J-7, J-3, J-1 puis expiration, une seule fois chacun, jamais pour un VIP", async () => {
    const id = await newClient("rappel@exemple.sn", "0145 5555 010");
    const vip = await newClient("rappel-vip@exemple.sn", "0145 5555 011");
    const order = await priceOrder(db, id, { pack: "ia", cycle: "mensuel", meters: 1 });
    for (const c of [id, vip]) {
      const r = await createPendingPayment(db, c, order);
      await settlePayment(db, (await paymentByReference(db, r))!.id, "confirme", "tx", today); // actif jusqu'au 17/12/2026
    }
    await setClientVip(db, vip, true);
    const titles = async (c: string) => (await db.select().from(schema.alertes)).filter((a) => a.clientId === c && a.type.startsWith("abonnement_")).map((a) => a.type);

    await renewalReminders(db, new Date(2026, 11, 5)); // J-12 : rien
    expect(await titles(id)).toEqual([]);
    await renewalReminders(db, new Date(2026, 11, 10)); // J-7
    await renewalReminders(db, new Date(2026, 11, 10)); // relancé la même journée : pas de doublon
    expect(await titles(id)).toEqual(["abonnement_j7"]);
    await renewalReminders(db, new Date(2026, 11, 15)); // J-2 : palier J-3 (rattrapé)
    await renewalReminders(db, new Date(2026, 11, 16)); // J-1
    await renewalReminders(db, new Date(2026, 11, 17)); // dernier jour : déjà prévenu la veille
    expect((await titles(id)).sort()).toEqual(["abonnement_j1", "abonnement_j3", "abonnement_j7"]);

    const r = await renewalReminders(db, new Date(2026, 11, 18)); // terminé
    expect(r.expires).toBeGreaterThanOrEqual(1);
    expect(await titles(id)).toContain("abonnement_expire");
    expect((await buildState(db, id, new Date(2026, 11, 18)))!.subscription.status).toBe("expire");
    await renewalReminders(db, new Date(2026, 11, 19));
    expect((await titles(id)).filter((x) => x === "abonnement_expire")).toHaveLength(1);

    expect(await titles(vip)).toEqual([]); // VIP : jamais de rappel
    expect((await buildState(db, vip, new Date(2026, 11, 18)))!.subscription.status).toBe("actif");

    // Réabonnement après expiration : actif à nouveau, nouvelle période depuis le jour du paiement
    const r2 = await createPendingPayment(db, id, order);
    await settlePayment(db, (await paymentByReference(db, r2))!.id, "confirme", "tx2", new Date(2026, 11, 20));
    const s = (await buildState(db, id, new Date(2026, 11, 20)))!;
    expect(s.subscription.status).toBe("actif");
    expect(s.subscription.renewsAt).toBe("2027-01-20");
  });
});
