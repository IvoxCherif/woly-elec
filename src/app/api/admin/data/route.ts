import { isAdmin } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { adminAlerts, adminOverview, adminTariffs, adminTemplates, adminUsers, publishTariff, saveTemplate } from "@/server/repo";
import type { TariffJson } from "@/lib/engine";

export const runtime = "nodejs";

/** Données de l'administration : GET ?vue=overview|users|alerts|tariffs|templates */
export async function GET(req: Request) {
  if (!(await isAdmin())) return json({ error: "non_autorise" }, 401);
  const url = new URL(req.url);
  const vue = url.searchParams.get("vue");
  return withDb(async (db) => {
    switch (vue) {
      case "overview":
        return json(await adminOverview(db, Math.min(365, Math.max(1, Number(url.searchParams.get("jours")) || 30))));
      case "users":
        return json(await adminUsers(db));
      case "alerts":
        return json(await adminAlerts(db));
      case "tariffs":
        return json(await adminTariffs(db));
      case "templates":
        return json(await adminTemplates(db));
      default:
        return json({ error: "vue_inconnue" }, 400);
    }
  });
}

/** Modifications : { type: "tarif", config, version } ou { type: "modele", id, texte } */
export async function POST(req: Request) {
  if (!(await isAdmin())) return json({ error: "non_autorise" }, 401);
  return withDb(async (db) => {
    const body = await readJson<{ type: string; config?: TariffJson; version?: string; id?: string; texte?: string }>(req);
    if (body?.type === "tarif" && body.config) {
      await publishTariff(db, body.config, body.version ?? "");
      return json({ ok: true });
    }
    if (body?.type === "modele" && body.id) {
      await saveTemplate(db, body.id, body.texte ?? "");
      return json({ ok: true });
    }
    return json({ error: "requete_invalide" }, 400);
  });
}
