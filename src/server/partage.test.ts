import { beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { seed } from "@/db/seed";

vi.mock("web-push", () => ({ default: { generateVAPIDKeys: () => ({ publicKey: "pub", privateKey: "priv" }), sendNotification: vi.fn(async () => ({ statusCode: 201 })) } }));

const repo = await import("./repo");
const share = await import("./partage");

let db: DB;
const today = new Date(2026, 10, 17);

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as DB;
  await seed(db);
});

const client = (email: string, meter: string) =>
  repo.signup(
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

/** Le jeton n'est envoyé que par e-mail : on le récupère en remplaçant celui de la base par un jeton connu. */
async function knownToken(id: string, token: string) {
  const { createHash } = await import("node:crypto");
  const { eq } = await import("drizzle-orm");
  await db.update(schema.partages).set({ tokenHash: createHash("sha256").update(token).digest("hex") }).where(eq(schema.partages.id, id));
}

describe("partage du compte", () => {
  it("invite par e-mail, crée l'accès du membre et limite ses droits", async () => {
    const owner = await client("titulaire@exemple.sn", "0145 5555 001");
    await expect(share.inviteMember(db, owner, { email: "titulaire@exemple.sn" }, "https://x")).rejects.toThrow("invitation_soi_meme");
    await expect(share.inviteMember(db, owner, { email: "pas-un-email" }, "https://x")).rejects.toThrow("email_invalide");

    const inv = await share.inviteMember(db, owner, { email: "Awa@Exemple.sn", role: "consulter" }, "https://x");
    // Essai gratuit : 1 personne au plus
    await expect(share.inviteMember(db, owner, { email: "deux@exemple.sn" }, "https://x")).rejects.toThrow("limite_partage");

    await knownToken(inv.id, "jeton-test-1234567890");
    const preview = await share.invitationPreview(db, "jeton-test-1234567890");
    expect(preview).toMatchObject({ email: "awa@exemple.sn", role: "consulter", compteurs: ["Maison"], compteExiste: false });

    const member = await share.createMemberAccount(db, "jeton-test-1234567890", { name: "Awa", passwordHash: "scrypt:00:00" });
    // L'invitation ne peut servir qu'une fois
    expect(await share.invitationPreview(db, "jeton-test-1234567890")).toBeNull();

    const state = await share.stateFor(db, member);
    if (!state || state === "aucun_acces") throw new Error("état attendu");
    expect(state.access).toMatchObject({ role: "consulter", accountId: owner });
    expect(state.meters).toHaveLength(1);
    expect(state.user.name).toBe("Awa"); // son propre profil, pas celui du titulaire
    expect(state.subscription.payments).toEqual([]);

    // Consulter : pas de relevé ; Gérer : relevé autorisé sur le compte du titulaire
    const r = (await share.resolveAccess(db, member))!;
    const reading = { type: "reading", meterId: state.meters[0].id };
    expect(() => share.checkMemberAction(r, reading)).toThrow("acces_lecture");
    expect(() => share.checkMemberAction(r, { type: "meter.add" })).toThrow("acces_lecture");
    await share.updateMember(db, owner, inv.id, { role: "gerer" });
    const r2 = (await share.resolveAccess(db, member))!;
    expect(share.checkMemberAction(r2, reading)).toBe(owner);
    expect(() => share.checkMemberAction(r2, { type: "subscribe" })).toThrow("acces_titulaire");
    expect(await share.meterAccess(db, member, state.meters[0].id)).toEqual({ ownerId: owner, role: "gerer" });

    // Alerte avant coupure envoyée aussi au membre ; le titulaire est prévenu de l'acceptation
    const alerts = (await db.select().from(schema.alertes)).filter((a) => a.clientId === owner);
    expect(alerts.some((a) => a.type === "partage")).toBe(true);

    // Accès retiré : le membre n'a plus de compte accessible
    await share.revokeMember(db, owner, inv.id);
    expect(await share.stateFor(db, member)).toBe("aucun_acces");
    expect(await share.meterAccess(db, member, state.meters[0].id)).toBeNull();
  });

  it("partage un seul compteur parmi plusieurs et laisse choisir le compte affiché", async () => {
    const owner = await client("proprio@exemple.sn", "0145 5555 010");
    await db.update(schema.abonnements).set({ statut: "actif", offre: "ia", renouvellement: "2027-01-01" });
    await repo.applyAction(db, owner, { type: "meter.add", meter: { name: "Appartement 2", number: "0145 5555 011", usage: "Ménage", phase: "mono", site: "" } } as never, today);
    const meters = (await db.select().from(schema.compteurs)).filter((m) => m.clientId === owner);
    const second = meters.find((m) => m.nom === "Appartement 2")!;

    const locataire = await client("locataire@exemple.sn", "0145 5555 020"); // a aussi son propre compteur
    const inv = await share.inviteMember(db, owner, { email: "locataire@exemple.sn", role: "gerer", compteurIds: [second.id] }, "https://x");
    await share.acceptById(db, inv.id, locataire);

    const mine = await share.stateFor(db, locataire);
    if (!mine || mine === "aucun_acces") throw new Error("état attendu");
    expect(mine.access?.accounts.map((a) => a.role)).toEqual(["titulaire", "gerer"]);
    expect(mine.access?.role).toBe("titulaire"); // son compte par défaut

    const shared = await share.stateFor(db, locataire, owner);
    if (!shared || shared === "aucun_acces") throw new Error("état attendu");
    expect(shared.meters.map((m) => m.name)).toEqual(["Appartement 2"]);
    const r = (await share.resolveAccess(db, locataire, owner))!;
    const first = meters.find((m) => m.id !== second.id)!;
    expect(() => share.checkMemberAction(r, { type: "reading", meterId: first.id })).toThrow("acces_compteur");
  });

  it("lien de lecture : crédit et coupure prévue sans compte, désactivable", async () => {
    const owner = await client("lien@exemple.sn", "0145 5555 030");
    const [m] = (await db.select().from(schema.compteurs)).filter((x) => x.clientId === owner);
    const token = await share.createReadLink(db, owner, m.id);
    const v = await share.readLinkView(db, token);
    expect(v).toMatchObject({ compteur: "Maison", numeroFin: "030", creditKwh: 40 });
    const [l] = (await db.select().from(schema.liensPartage)).filter((x) => x.token === token);
    expect(l.vues).toBe(1);
    await share.revokeReadLink(db, owner, l.id);
    expect(await share.readLinkView(db, token)).toBeNull();
    expect(await share.readLinkView(db, "pas/valide")).toBeNull();
  });
});
