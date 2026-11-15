import { beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { seed } from "@/db/seed";

const sent: { endpoint: string; payload: string }[] = [];
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }),
    sendNotification: vi.fn(async (sub: { endpoint: string }, payload: string) => {
      sent.push({ endpoint: sub.endpoint, payload });
      return { statusCode: 201 };
    }),
  },
}));

const { saveAdminPrefs, saveAdminSubscription, savePushSubscription, vapidKeys } = await import("./push");
const { createSupportRequest, applyAction, drawLottery, lotteryParticipants, meterNumberTaken, monthlyConsumption, setLotteryStatus, signup } = await import("./repo");

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

describe("notifications de l'administrateur", () => {
  it("prévient l'admin d'un nouvel utilisateur et d'une demande de support, selon ses choix", async () => {
    await vapidKeys(db); // clés créées avant les abonnements (comme en production)
    await saveAdminSubscription(db, { endpoint: "https://fcm.googleapis.com/fcm/send/admin-0123456789", keys: { p256dh: "BPadmin", auth: "authadmin" } });
    sent.length = 0;
    await client("nouveau@exemple.sn", "0145 7777 010");
    const admin = sent.filter((x) => x.endpoint.includes("admin")).map((x) => JSON.parse(x.payload));
    expect(admin[0]).toMatchObject({ title: "Nouvel utilisateur", url: "/admin/utilisateurs" });
    expect(admin[0].body).toContain("nouveau@exemple.sn");

    await saveAdminPrefs(db, { support: false });
    sent.length = 0;
    await createSupportRequest(db, { clientId: null, nom: "Awa", email: "awa@exemple.sn", categorie: "question", sujet: "Question", message: "Bonjour, une question sur mon compteur." });
    expect(sent).toHaveLength(0);
    await saveAdminPrefs(db, { support: true });
    await createSupportRequest(db, { clientId: null, nom: "Awa", email: "awa@exemple.sn", categorie: "reclamation", sujet: "Problème", message: "Bonjour, un problème avec mon compteur." });
    expect(JSON.parse(sent[0].payload).title).toBe("Nouvelle réclamation");
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

    await savePushSubscription(db, w.clientId!, { endpoint: "https://fcm.googleapis.com/fcm/send/gagnant-0123456789", keys: { p256dh: "BPg", auth: "authg" } });
    sent.length = 0;
    await setLotteryStatus(db, w.id, "recharge", { montant: 15000, moisOffert: true }, today);
    const push = JSON.parse(sent.find((x) => !x.endpoint.includes("admin"))?.payload ?? "{}");
    expect(push.title).toBe("Vous avez gagné la loterie Woly Elec !");
    expect(push.body).toMatch(/15\s000 F/);
    expect(push.body).toContain("un mois d'abonnement Woly Elec offert");
    const [sub] = (await db.select().from(schema.abonnements)).filter((a) => a.clientId === w.clientId);
    expect(sub.statut).toBe("actif");
    expect(["2026-12-17", "2027-01-17"]).toContain(sub.renouvellement); // un mois après l'essai en cours, ou à partir d'aujourd'hui
    const [row] = (await db.select().from(schema.tirages)).filter((x) => x.id === w.id);
    expect(row.montantRecharge).toBe(15000);
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
