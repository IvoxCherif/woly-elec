import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { seed } from "@/db/seed";

// Aucun envoi réel : on capture les notifications
const sent: { endpoint: string; payload: string }[] = [];
let failWith: number | null = null;
vi.mock("web-push", async (orig) => {
  const real = (await orig()) as { default: typeof import("web-push") };
  return {
    default: {
      generateVAPIDKeys: real.default.generateVAPIDKeys,
      sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
        if (failWith && sub.endpoint.includes("perime")) throw Object.assign(new Error("gone"), { statusCode: failWith });
        sent.push({ endpoint: sub.endpoint, payload });
        return { statusCode: 201 };
      }),
    },
  };
});

const { sendPush, savePushSubscription, vapidKeys, pushDeviceCount } = await import("./push");
const { applyAction, createPendingPayment, paymentByReference, priceOrder, settlePayment, signup, weeklySummaries } = await import("./repo");

let db: DB;
const today = new Date(2026, 10, 17); // mardi 17 novembre 2026

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as DB;
  await seed(db);
});
beforeEach(() => {
  sent.length = 0;
  failWith = null;
});

const client = (email: string, meter: string) =>
  signup(
    db,
    {
      identity: { kind: "email", email, passwordHash: "scrypt:00:00" },
      name: "M. Ndiaye",
      meter: { number: meter, name: "Maison", usage: "Ménage", phase: "mono" },
      reading: { balanceKwh: 40, monthKwh: 80, yesterdayKwh: 5 },
      lastRecharge: { date: "2026-11-03", amount: 10000 },
      prefs: { consent: true },
    },
    today,
  );
const sub = (name: string) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/${name}-0123456789`, keys: { p256dh: "BPub" + name, auth: "auth" + name } });

describe("notifications push", () => {
  it("génère les clés VAPID une seule fois et chiffre la clé privée", async () => {
    const k1 = await vapidKeys(db);
    const [row] = (await db.select().from(schema.parametres)).filter((r) => r.cle === "push_vapid");
    expect(JSON.stringify(row.valeur)).not.toContain(k1.privateKey);
    expect((await vapidKeys(db)).publicKey).toBe(k1.publicKey);
  });

  it("enregistre les appareils, respecte le choix du client et nettoie les abonnements périmés", async () => {
    const id = await client("push@exemple.sn", "0145 6666 001");
    await expect(savePushSubscription(db, id, { endpoint: "http://pas-https", keys: { p256dh: "a", auth: "b" } })).rejects.toThrow("abonnement_invalide");
    await savePushSubscription(db, id, sub("tel"));
    await savePushSubscription(db, id, sub("tel")); // même appareil : pas de doublon
    await savePushSubscription(db, id, sub("perime"));
    expect(await pushDeviceCount(db, id)).toBe(2);

    // Canal push désactivé par le client : rien n'est envoyé (sauf test forcé)
    await applyAction(db, id, { type: "user.update", patch: { channels: { push: false, whatsapp: false, sms: false, email: false } } }, today);
    expect(await sendPush(db, id, { title: "x", body: "y" })).toBe(0);
    expect(await sendPush(db, id, { title: "Test", body: "y" }, { force: true })).toBe(2);
    await applyAction(db, id, { type: "user.update", patch: { channels: { push: true, whatsapp: false, sms: false, email: false } } }, today);

    failWith = 410; // téléphone désinstallé
    expect(await sendPush(db, id, { title: "Alerte", body: "y" })).toBe(1);
    expect(await pushDeviceCount(db, id)).toBe(1);
  });

  it("notifie le paiement reçu et l'alerte de coupure", async () => {
    const id = await client("push2@exemple.sn", "0145 6666 002");
    await savePushSubscription(db, id, sub("p2"));
    const ref = await createPendingPayment(db, id, await priceOrder(db, id, { pack: "ia", cycle: "mensuel", meters: 1 }));
    await settlePayment(db, (await paymentByReference(db, ref))!.id, "confirme", "tx", today);
    expect(JSON.parse(sent.at(-1)!.payload)).toMatchObject({ title: "Paiement reçu", url: "/app/abonnement" });

    // Relevé très bas : alerte « moins d'un jour » envoyée aussi en push
    const meterId = (await db.select().from(schema.compteurs)).find((m) => m.clientId === id)!.id;
    await applyAction(db, id, { type: "reading", meterId, date: "2026-11-17", balanceKwh: 2, monthKwh: 90, yesterdayKwh: 5 }, today);
    const last = JSON.parse(sent.at(-1)!.payload);
    expect(last.url).toBe("/app/plan");
    expect(last.title).toContain("Maison");
  });

  it("bilan hebdomadaire : le lundi seulement, une fois par semaine", async () => {
    const id = await client("push3@exemple.sn", "0145 6666 003");
    await savePushSubscription(db, id, sub("p3"));
    const meterId = (await db.select().from(schema.compteurs)).find((m) => m.clientId === id)!.id;
    for (let d = 10; d <= 16; d++) await applyAction(db, id, { type: "reading", meterId, date: `2026-11-${d}`, balanceKwh: 70 - (d - 10) * 5, monthKwh: 40 + (d - 10) * 5, yesterdayKwh: 5 }, new Date(2026, 10, d));
    sent.length = 0;
    expect(await weeklySummaries(db, today)).toBe(0); // mardi : rien
    const monday = new Date(2026, 10, 23);
    expect(await weeklySummaries(db, monday)).toBeGreaterThanOrEqual(1);
    const mine = sent.filter((x) => x.endpoint.includes("p3"));
    expect(JSON.parse(mine[0].payload).title).toBe("Votre semaine · Maison");
    sent.length = 0;
    await weeklySummaries(db, monday);
    expect(sent.filter((x) => x.endpoint.includes("p3"))).toHaveLength(0);
  });
});
