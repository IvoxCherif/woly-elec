import { isAdmin } from "@/server/auth";
import { json, readJson, withDb } from "@/server/http";
import { ActionError, drawLottery, lotteryHistory, lotteryParticipants, setLotteryStatus, adminAlerts, adminIa, adminPayments, adminOverview, setClientIaQuota, setClientVip, setGlobalIaQuota, adminSupport, adminTariffs, adminTemplates, adminUsers, publishTariff, saveTemplate, setSupportStatus } from "@/server/repo";
import type { TariffJson } from "@/lib/engine";
import { CLAUDE_MODEL, claudeKeyStatus } from "@/server/claude";
import { paymentMode, saspayConfig, saveSaspayConfig, testKey } from "@/server/saspay";
import { publicOrigin } from "@/server/ratelimit";
import { sendPush } from "@/server/push";
import { dexpayConfig, inquiryMeter, saveDexpayConfig, testDexpayKey } from "@/server/dexpay";
import { adminPurchaseAction, adminPurchases } from "@/server/recharge";
import { pixelConfig, savePixelConfig } from "@/server/pixel";

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
      case "loterie": {
        const exclure = url.searchParams.get("exclure") !== "0";
        const actifs = url.searchParams.get("actifs") === "1";
        return json({ tirages: await lotteryHistory(db), participants: await lotteryParticipants(db, { exclureGagnants: exclure, actifsSeulement: actifs }) });
      }
      case "recharges": {
        const c = await dexpayConfig(db);
        return json({
          actif: c.enabled,
          sandbox: c.sandbox,
          cle: c.preview,
          cleStatut: c.key ? await testDexpayKey(c) : "absente",
          webhook: !!c.webhookSecret,
          webhookUrl: `${publicOrigin(req)}/api/recharge/webhook`,
          fraisPct: c.fraisPct,
          fraisFixe: c.fraisFixe,
          paiement: await paymentMode(db),
          achats: await adminPurchases(db),
        });
      }
      case "pixel":
        return json(await pixelConfig(db));
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
    const body = await readJson<{ type: string; config?: TariffJson; version?: string; id?: string | number; texte?: string; statut?: string; vip?: boolean; exclure?: boolean; actifs?: boolean; montant?: number; moisOffert?: boolean; sandbox?: boolean; fraisPct?: number; fraisFixe?: number; reference?: string; action?: string; numero?: string; valeur?: number | null; cle?: string; webhook?: string; actif?: boolean }>(req);
    if (body?.type === "dexpay") {
      try {
        await saveDexpayConfig(db, { cle: body.cle, webhook: body.webhook, actif: body.actif, sandbox: body.sandbox, fraisPct: body.fraisPct, fraisFixe: body.fraisFixe });
      } catch (e) {
        const m = (e as Error).message;
        return json({ error: ["cle_invalide", "webhook_invalide", "frais_invalides"].includes(m) ? m : "enregistrement_impossible" }, 400);
      }
      return json({ ok: true });
    }
    if (body?.type === "dexpay_verifier" && body.numero) {
      // Consultation d'un compteur chez Senelec via DexPay, sans aucun débit (test de la configuration)
      try {
        const info = await inquiryMeter(await dexpayConfig(db), String(body.numero));
        return json(info ? { ok: true, ...info } : { error: "compteur_inconnu_senelec" }, info ? 200 : 404);
      } catch {
        return json({ error: "verification_impossible" }, 503);
      }
    }
    if (body?.type === "pixel") {
      try {
        return json({ ok: true, ...(await savePixelConfig(db, { id: typeof body.cle === "string" ? body.cle : undefined, actif: body.actif })) });
      } catch (e) {
        const m = (e as Error).message;
        return json({ error: m === "pixel_invalide" || m === "pixel_absent" ? m : "enregistrement_impossible" }, 400);
      }
    }
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
      if (body?.type === "loterie_tirage") {
        const gagnant = await drawLottery(db, { exclureGagnants: body.exclure !== false, actifsSeulement: body.actifs === true });
        return json({ ok: true, gagnant });
      }
      if (body?.type === "loterie_statut" && body.id !== undefined && (body.statut === "recharge" || body.statut === "annule")) {
        await setLotteryStatus(db, Number(body.id), body.statut, { montant: typeof body.montant === "number" ? body.montant : undefined, moisOffert: body.moisOffert === true });
        return json({ ok: true });
      }
      if (body?.type === "recharge_action" && body.reference && (body.action === "relancer" || body.action === "rembourse")) {
        await adminPurchaseAction(db, String(body.reference), body.action, publicOrigin(req));
        return json({ ok: true });
      }
      if (body?.type === "ia_quota" && typeof body.valeur === "number") {
        await setGlobalIaQuota(db, body.valeur);
        return json({ ok: true });
      }
      if (body?.type === "vip" && body.id && typeof body.vip === "boolean") {
        await setClientVip(db, String(body.id), body.vip);
        return json({ ok: true });
      }
      if (body?.type === "push_test" && body.id) {
        const n = await sendPush(db, String(body.id), { title: "Woly Elec", body: "Notification de test : vos alertes avant coupure, paiements et rappels arriveront ici.", url: "/app/alertes", tag: "test" }, { force: true });
        return json({ ok: true, envoyees: n });
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
