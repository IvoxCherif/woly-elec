import "server-only";
import path from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { readSecret } from "@/server/secrets";
import { seed } from "./seed";

export type DB = PostgresJsDatabase<typeof schema>;

/**
 * Connexion à la base :
 * - DATABASE_URL=postgres://…            → PostgreSQL (production : conteneur « db » du projet Docker)
 * - DB_HOST (+ DB_USER, DB_NAME, mot de passe dans /run/woly/db_password) → idem, sans mot de passe dans l'environnement
 * - DATABASE_URL=pglite:./.pglite        → PostgreSQL embarqué (développement local et tests, sans Docker)
 * Sans configuration, l'application fonctionne en mode démonstration.
 */
function connectionString(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST;
  const pw = readSecret("db_password", "DB_PASSWORD");
  if (!host || !pw) return null;
  const user = process.env.DB_USER ?? "woly";
  const name = process.env.DB_NAME ?? "woly";
  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(pw)}@${host}:${process.env.DB_PORT ?? 5432}/${name}`;
}

export const dbConfigured = () => connectionString() !== null;

const g = globalThis as unknown as { __wolyDb?: Promise<DB> };

async function open(url: string): Promise<DB> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (url.startsWith("pglite:")) {
    // PGlite n'est installé qu'en développement : import dynamique non suivi par le bundler.
    const { PGlite } = await import(/* webpackIgnore: true */ "@electric-sql/pglite" as string);
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = url.slice("pglite:".length);
    const client = new PGlite(dir === "memory" ? undefined : dir);
    const db = drizzlePglite(client, { schema });
    await migrate(db, { migrationsFolder });
    await seed(db as unknown as DB);
    return db as unknown as DB;
  }
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const sql = postgres(url, { max: 10, idle_timeout: 30, connect_timeout: 10 });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder });
  await seed(db);
  return db;
}

/** Base prête (migrations appliquées, données initiales en place), ou null en mode démonstration. */
export async function getDb(): Promise<DB | null> {
  const url = connectionString();
  if (!url) return null;
  if (!g.__wolyDb) {
    g.__wolyDb = open(url).catch((e) => {
      g.__wolyDb = undefined;
      throw e;
    });
  }
  return g.__wolyDb;
}

export { schema };
