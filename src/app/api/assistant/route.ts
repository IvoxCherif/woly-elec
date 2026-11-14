import { and, eq } from "drizzle-orm";
import { compteurs, iaUsage } from "@/db/schema";
import { contextFor, localAnswer } from "@/lib/assistant";
import { isoDate } from "@/lib/format";
import { computeStats } from "@/lib/stats";
import { currentClientId } from "@/server/auth";
import { askClaude, CLAUDE_MODEL, claudeKeyStatus } from "@/server/claude";
import { json, readJson, withDb } from "@/server/http";
import { applyAction, buildState, effectiveSub, iaQuotaFor, recordIaCall } from "@/server/repo";
import { clientIp, isBlocked, recordFailure } from "@/server/ratelimit";

export const runtime = "nodejs";

/** État de l'assistant (diagnostic sans coût) : la clé est-elle présente et acceptée ? */
export async function GET() {
  return json({ modele: CLAUDE_MODEL, cle: await claudeKeyStatus() });
}

/**
 * Assistant Woly Elec IA (Claude Haiku 5.5).
 * Réservé aux clients connectés avec l'offre Woly Elec IA ; 30 questions par mois et par compteur,
 * comptées par le serveur. Le contexte chiffré est recalculé depuis la base (jamais fourni par le navigateur).
 * Si Claude est indisponible, la réponse vient du moteur de calcul local (et n'est pas décomptée).
 */
export async function POST(req: Request) {
  return withDb(async (db) => {
    const clientId = await currentClientId();
    if (!clientId) return json({ error: "non_connecte" }, 401);
    const ipKey = `ia:${clientIp(req)}`;
    if (isBlocked(ipKey, 40, 3600_000)) return json({ error: "trop_de_requetes" }, 429);

    const body = await readJson<{ meterId?: string; question?: string }>(req);
    const question = String(body?.question ?? "").trim().slice(0, 600);
    if (!question || !body?.meterId) return json({ error: "question_vide" }, 400);

    const [m] = await db.select({ id: compteurs.id }).from(compteurs).where(and(eq(compteurs.id, body.meterId), eq(compteurs.clientId, clientId)));
    if (!m) return json({ error: "compteur_introuvable" }, 404);
    const sub = await effectiveSub(db, clientId); // un client VIP a l'offre IA sans payer
    if (sub.offre !== "ia" || sub.statut === "expire") return json({ error: "offre_ia_requise" }, 402);
    const [u] = await db.select().from(iaUsage).where(and(eq(iaUsage.compteurId, m.id), eq(iaUsage.mois, isoDate(new Date()).slice(0, 7))));
    if ((u?.requetes ?? 0) >= (await iaQuotaFor(db, clientId))) return json({ error: "quota_atteint" }, 429);

    const state = await buildState(db, clientId);
    if (!state) return json({ error: "non_connecte" }, 401);
    const stats = computeStats(state, m.id, new Date(new Date().setHours(0, 0, 0, 0)));
    recordFailure(ipKey, 3600_000); // compte les questions par IP

    const r = await askClaude(contextFor(stats), state.chat, question);
    if (r.usage) await recordIaCall(db, { clientId, meterId: m.id, ...r.usage, model: r.usage.model, statut: r.ok ? "ok" : "refus" });
    if (!r.ok) {
      // Repli : réponse du moteur de calcul, non décomptée du quota
      return json({ answer: localAnswer(question, stats), source: "moteur", raison: r.reason, state });
    }
    await applyAction(db, clientId, { type: "ia", meterId: m.id, question, answer: r.text });
    return json({ answer: r.text, source: "claude", state: await buildState(db, clientId) });
  });
}
