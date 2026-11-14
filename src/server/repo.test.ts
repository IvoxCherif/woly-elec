import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { seed } from "@/db/seed";
import { ActionError, adminAlerts, adminOverview, adminUsers, applyAction, buildState, publishTariff, signup } from "./repo";
import { computeStats } from "@/lib/stats";
import { isoDate } from "@/lib/format";
import { addDays } from "@/lib/engine";

let db: DB;
const today = new Date(2026, 10, 17); // 17 novembre 2026

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as DB;
  await seed(db);
  await seed(db); // idempotent
});

const signupInput = (phone: string, meter: string) => ({
  phone,
  name: "M. Diallo",
  meter: { number: meter, name: "Maison de Dakar", usage: "Ménage", phase: "mono" },
  reading: { balanceKwh: 41.6, monthKwh: 85, yesterdayKwh: 5.1 },
  lastRecharge: { date: "2026-11-03", amount: 10000 },
  prefs: { rechargeDay: 5, objective: "mois", whatsapp: true, consent: true },
});

describe("base de données Woly Elec", () => {
  let clientId: string;
  let meterId: string;

  it("crée un compte complet à l'inscription, avec essai de 30 jours", async () => {
    clientId = await signup(db, signupInput("+221771234567", "0145 6789 012"), today);
    const s = (await buildState(db, clientId, today))!;
    expect(s.mode).toBe("server");
    expect(s.user.phone).toBe("+221 77 123 45 67");
    expect(s.subscription.status).toBe("essai");
    expect(s.subscription.trialEnd).toBe("2026-12-17");
    expect(s.meters).toHaveLength(1);
    meterId = s.meters[0].id;
    expect(s.readings[0].balanceKwh).toBe(41.6);
    expect(s.recharges[0].kwh).toBeCloseTo(113.7, 1); // (9 750 − 429) / 82
    expect(s.alerts[0].title).toBe("Bienvenue sur Woly Elec");
    expect(s.tariff?.tiers[0].price).toBe(82);
  });

  it("refuse un deuxième compte ou un deuxième essai", async () => {
    await expect(signup(db, signupInput("+221771234567", "0999 0000 001"), today)).rejects.toThrow("deja_inscrit");
    const other = await signup(db, signupInput("+221781112233", "0145 6789 012"), today); // même compteur
    expect((await buildState(db, other, today))!.subscription.status).toBe("expire");
  });

  it("enregistre une recharge en tranche 2 après 150 kWh achetés", async () => {
    await applyAction(db, clientId, { type: "recharge", meterId, date: "2026-11-12", amount: 10000, vendor: "Wave", tokens: ["12345678901234567890"] }, today);
    const s = (await buildState(db, clientId, today))!;
    const r = s.recharges.find((x) => x.date === "2026-11-12")!;
    expect(r.tier).toBe(2); // 113,7 kWh déjà achetés + 36,3 kWh en tranche 1, le reste en tranche 2
    expect(r.firstOfMonth).toBe(false);
    expect(r.tokens).toEqual(["12345678901234567890"]);
  });

  it("met à jour un relevé du même jour et génère une alerte au seuil", async () => {
    for (let i = 3; i >= 1; i--) {
      await applyAction(db, clientId, { type: "reading", meterId, date: isoDate(addDays(today, -i)), balanceKwh: 20, monthKwh: 90, yesterdayKwh: 6 }, today);
    }
    await applyAction(db, clientId, { type: "reading", meterId, date: isoDate(today), balanceKwh: 12, monthKwh: 96, yesterdayKwh: 6 }, today);
    await applyAction(db, clientId, { type: "reading", meterId, date: isoDate(today), balanceKwh: 11, monthKwh: 97, yesterdayKwh: 6 }, today);
    const s = (await buildState(db, clientId, today))!;
    expect(s.readings.filter((r) => r.date === isoDate(today))).toHaveLength(1);
    const stats = computeStats(s, meterId, today);
    expect(stats.last?.balanceKwh).toBe(11);
    expect(s.alerts.some((a) => a.title.startsWith("Il vous reste environ"))).toBe(true);
  });

  it("protège les données d'un autre client", async () => {
    const other = await signup(db, signupInput("+221761234500", "0333 4444 555"), today);
    await expect(applyAction(db, other, { type: "reading", meterId, date: isoDate(today), balanceKwh: 1, monthKwh: 1, yesterdayKwh: 1 }, today)).rejects.toBeInstanceOf(ActionError);
  });

  it("exige un abonnement pour un 2e compteur, puis l'accepte après paiement", async () => {
    const meter = { name: "Appartement B2", number: "0145 6789 013", usage: "Location" as const, phase: "mono" as const, site: "", debt: 0 };
    await expect(applyAction(db, clientId, { type: "meter.add", meter }, today)).rejects.toThrow("abonnement_requis");
    await applyAction(db, clientId, { type: "subscribe", pack: "ia", cycle: "annuel", meters: 2, method: "Wave" }, today);
    await applyAction(db, clientId, { type: "meter.add", meter }, today);
    const s = (await buildState(db, clientId, today))!;
    expect(s.subscription.status).toBe("actif");
    expect(s.subscription.payments[0].amount).toBe(43978); // 3 998 F × 11
    expect(s.meters).toHaveLength(2);
  });

  it("applique le quota IA de 30 requêtes par compteur", async () => {
    for (let i = 0; i < 30; i++) await applyAction(db, clientId, { type: "ia", meterId, question: `q${i}`, answer: "r" }, today);
    await expect(applyAction(db, clientId, { type: "ia", meterId, question: "une de trop", answer: "r" }, today)).rejects.toThrow("quota_atteint");
    const s = (await buildState(db, clientId, today))!;
    expect(s.iaUsed[meterId]).toBe(30);
    expect(s.chat.length).toBe(40);
  });

  it("publie un nouveau tarif utilisé par les calculs suivants", async () => {
    await publishTariff(db, { tiers: [{ limit: 150, price: 80 }, { limit: 250, price: 130 }, { limit: null, price: 150 }], communalTax: 0.025, redevance: { mono: 429, tri: 1427 }, margins: { regular: 0.1, average: 0.15, newClient: 0.2 } }, "Test");
    const s = (await buildState(db, clientId, today))!;
    expect(s.tariff?.tiers[0].price).toBe(80);
    expect(s.tariff?.tiers[2].limit).toBeNull();
  });

  it("calcule les indicateurs de l'administration", async () => {
    const o = await adminOverview(db, 30);
    expect(o.totalClients).toBe(3);
    expect(o.actifsSemaine).toBe(3); // les 3 comptes ont fait un relevé à l'inscription
    const users = await adminUsers(db);
    expect(users).toHaveLength(3);
    expect(users.find((u) => u.status === "Actif")?.phone).toBe("+221 77 ••• •• 67");
    expect((await adminAlerts(db)).length).toBeGreaterThan(0);
  });
});
