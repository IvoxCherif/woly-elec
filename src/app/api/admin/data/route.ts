import { isAdmin } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { ActionError, adminAlerts, adminIa, adminPayments, adminOverview, setClientIaQuota, setClientVip, setGlobalIaQuota, adminSupport, adminTariffs, adminTemplates, adminUsers, publishTariff, saveTemplate, setSupportStatus } from "@/server/repo";
import type { TariffJson } from "@/lib/engine";
import { CLAUDE_MODEL, claudeKeyStatus } from "@/server/claude";
import { paymentMode, saspayConfig, saveSaspayConfig, testKey } from "@/server/saspay";
import { publicOrigin } from "@/server/ratelimit";

export const runtime = "nodejs";

/** Données de l'administration : GET ?vue=overview|users|alerts|tariffs|templates|support */
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
      case "support":
        return json(await adminSupport(db));
      case "paiement": {
        const c = await saspayConfig(db);
        return json({
          mode: await paymentMode(db),
          actif: c.enabled,
          cle: c.preview,
          cleStatut: c.key ? await testKey(c.key) : "absente",
          webhook: !!c.webhookSecret,
          webhookUrl: `${publicOrigin(req)}/api/paiement/webhook`,
          paiements: await adminPayments(db),
        });
      }
      case "ia":
        return json({ ...(await adminIa(db)), modele: CLAUDE_MODEL, cle: await claudeKeyStatus() });
      default:
        return json({ error: "vue_inconnue" }, 400);
    }
  });
}

/** Modifications : { type: "tarif", config, version } ou { type: "modele", id, texte } */
export async function POST(req: Request) {
  if (!(await isAdmin())) return json({ error: "non_autorise" }, 401);
  return withDb(async (db) => {
    const body = await readJson<{ type: string; config?: TariffJson; version?: string; id?: string | number; texte?: string; statut?: string; vip?: boolean; valeur?: number | null; cle?: string; webhook?: string; actif?: boolean }>(req);
    if (body?.type === "saspay") {
      try {
        await saveSaspayConfig(db, { cle: body.cle, webhook: body.webhook, actif: body.actif });
      } catch (e) {
        const m = (e as Error).message;
        return json({ error: m === "cle_invalide" || m === "webhook_invalide" ? m : "enregistrement_impossible" }, 400);
      }
      return json({ ok: true });
    }
    try {
      if (body?.type === "ia_quota" && typeof body.valeur === "number") {
        await setGlobalIaQuota(db, body.valeur);
        return json({ ok: true });
      }
      if (body?.type === "vip" && body.id && typeof body.vip === "boolean") {
        await setClientVip(db, String(body.id), body.vip);
        return json({ ok: true });
      }
      if (body?.type === "quota_client" && body.id && (body.valeur === null || typeof body.valeur === "number")) {
        await setClientIaQuota(db, String(body.id), body.valeur);
        return json({ ok: true });
      }
    } catch (e) {
      if (e instanceof ActionError) return json({ error: e.code }, e.status);
      throw e;
    }
    if (body?.type === "support" && body.id !== undefined && body.statut) {
      await setSupportStatus(db, Number(body.id), body.statut);
      return json({ ok: true });
    }
    if (body?.type === "tarif" && body.config) {
      await publishTariff(db, body.config, body.version ?? "");
      return json({ ok: true });
    }
    if (body?.type === "modele" && body.id) {
      await saveTemplate(db, String(body.id), body.texte ?? "");
      return json({ ok: true });
    }
    return json({ error: "requete_invalide" }, 400);
  });
}
