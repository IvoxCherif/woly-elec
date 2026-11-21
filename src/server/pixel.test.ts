import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "@/db/schema";
import type { DB } from "@/db";
import { activePixelId, pixelConfig, savePixelConfig } from "./pixel";

let db: DB;
beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = pg as unknown as DB;
});

describe("Pixel Meta", () => {
  it("aucun suivi tant que l'identifiant n'est pas enregistré et activé", async () => {
    expect(await pixelConfig(db)).toEqual({ id: null, actif: false });
    await expect(savePixelConfig(db, { actif: true })).rejects.toThrow("pixel_absent");
    await expect(savePixelConfig(db, { id: "fbq-123" })).rejects.toThrow("pixel_invalide");
    await savePixelConfig(db, { id: " 1234 5678 9012 345 " });
    expect(await activePixelId(db)).toBeNull();
    await savePixelConfig(db, { actif: true });
    expect(await activePixelId(db)).toBe("123456789012345");
    await savePixelConfig(db, { actif: false });
    expect(await activePixelId(db)).toBeNull();
  });
});
