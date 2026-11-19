import { createHash, timingSafeEqual } from "node:crypto";
import { json, withDb } from "@/server/http";
import { readingReminders, renewalReminders, weeklySummaries } from "@/server/repo";
import { clientSessionSecret } from "@/server/secrets";

export const runtime = "nodejs";

/** Jeton de la tâche planifiée, dérivé du secret serveur (connu seulement du serveur lui-même). */
function cronToken(): string | null {
  const s = clientSessionSecret();
  return s ? createHash("sha256").update(`woly-cron|${s}`).digest("hex") : null;
}

/** Tâche planifiée (appelée toutes les heures par le serveur, voir instrumentation.ts)  : rappels de renouvellement, bilan du lundi, rappels de relevé. */
export async function POST(req: Request) {
  const expected = cronToken();
  const got = req.headers.get("x-woly-cron") ?? "";
  if (!expected || got.length !== expected.length || !timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return json({ error: "non_autorise" }, 401);
  return withDb(async (db) => json({ ...(await renewalReminders(db)), bilans: await weeklySummaries(db), releves: await readingReminders(db) }));
}
