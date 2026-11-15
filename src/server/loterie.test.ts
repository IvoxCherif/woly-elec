import { beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { seed } from "@/db/seed";

vi.mock("web-push", () => ({ default: { generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }), sendNotification: vi.fn(async () => ({ statusCode: 201 })) } }));

const { applyAction, drawLottery, lotteryParticipants, meterNumberTaken, monthlyConsumption, setLotteryStatus, signup } = await import("./repo");

let db: DB;
const today = new Date(2026, 10, 17);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as DB;
  await seed(db);
});

const client = (email: string, meter: string) =>
  signup(
    db,
    {
      identity: { kind: "email", email, passwordHash: "scrypt:00:00" },
      name: email.split("@")[0],
      meter: { number: meter, name: "Maison", usage: "Ménage", phase: "mono" },
      reading: { balanceKwh: 40, monthKwh: 80, yesterdayKwh: 5 },
      prefs: { consent: true },
    },
    today,
  );

describe("numéros de compteur uniques", () => {
  it("refuse un compteur déjà enregistré, même écrit autrement", async () => {
    await client("a@exemple.sn", "0145 7777 001");
    expect(await meterNumberTaken(db, "014577770 01")).toBe(true);
    expect(await meterNumberTaken(db, "0145 7777 999")).toBe(false);
    await expect(client("b@exemple.sn", "01457777001")).rejects.toThrow("compteur_deja_utilise");
  });

  it("refuse aussi à l'ajout d'un compteur supplémentaire", async () => {
    const id = await client("c@exemple.sn", "0145 7777 002");
    await db.update(schema.abonnements).set({ statut: "actif", offre: "ia" });
    await expect(applyAction(db, id, { type: "meter.add", meter: { name: "Boutique", number: "0145-7777-001", usage: "Commerce", phase: "mono", site: "" } } as never, today)).rejects.toThrow("compteur_deja_utilise");
  });
});

describe("loterie", () => {
  it("tire un participant, calcule sa consommation et exclut les gagnants", async () => {
    const before = await lotteryParticipants(db, {});
    expect(before).toBeGreaterThanOrEqual(2);
    const w = await drawLottery(db, {}, today);
    expect(w.numeroCompteur).toMatch(/0145 7777/);
    expect(w.consoMoisKwh).toBe(150); // 5 kWh/jour (code 813) × 30
    expect(w.montantMois).toBeGreaterThan(10_000);
    expect(await lotteryParticipants(db, {})).toBe(before - 1);
    expect(await lotteryParticipants(db, { exclureGagnants: false })).toBe(before);

    await setLotteryStatus(db, w.id, "recharge");
    await expect(setLotteryStatus(db, w.id, "annule")).rejects.toThrow("tirage_deja_traite");
    const alerts = (await db.select().from(schema.alertes)).filter((a) => a.type === "loterie");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].clientId).toBe(w.clientId);
  });

  it("consommation inconnue sans relevé récent", async () => {
    const [m] = await db.select().from(schema.compteurs);
    expect((await monthlyConsumption(db, m.id, new Date(2027, 5, 1))).kwh).toBeNull();
  });
});
