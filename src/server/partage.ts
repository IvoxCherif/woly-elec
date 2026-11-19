import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as t from "@/db/schema";
import type { Access, AccessRole, State } from "@/lib/demo";
import { computeStats } from "@/lib/stats";
import { ActionError, buildState, effectiveSub, userOf } from "./repo";
import { invitationMail, mailEnabled, sendMail } from "./mail";
import { sendAdminPush, sendPush } from "./push";

/**
 * Partage du compte Woly Elec :
 * - membres invités par e-mail, sur tous les compteurs ou certains, rôle « consulter » ou « gerer » ;
 * - liens de lecture d'un compteur, sans compte.
 * Chaque membre garde ses propres identifiants ; le titulaire peut retirer un accès à tout moment.
 */

export type Role = "consulter" | "gerer";
const INVITE_DAYS = 7;
/** Personnes invitées au plus, selon l'offre du titulaire. */
export const SHARE_LIMITS = { essai: 1, simple: 3, ia: 5 } as const;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(24).toString("base64url");
const isEmail = (v: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(v);
const roleOf = (r: string): Role => (r === "gerer" ? "gerer" : "consulter");

async function shareLimit(db: DB, ownerId: string) {
  const sub = await effectiveSub(db, ownerId);
  if (sub.vip) return SHARE_LIMITS.ia;
  if (sub.statut === "essai") return SHARE_LIMITS.essai;
  if (sub.statut !== "actif") return 0;
  return sub.offre === "simple" ? SHARE_LIMITS.simple : SHARE_LIMITS.ia;
}

async function ownerMeters(db: DB, ownerId: string) {
  return db.select({ id: t.compteurs.id, nom: t.compteurs.nom, numero: t.compteurs.numero }).from(t.compteurs).where(eq(t.compteurs.clientId, ownerId)).orderBy(asc(t.compteurs.createdAt));
}

/** Compteurs autorisés : null = tous ; sinon uniquement ceux du titulaire. */
async function cleanMeters(db: DB, ownerId: string, ids: unknown): Promise<string[] | null> {
  if (ids === null || ids === undefined) return null;
  if (!Array.isArray(ids)) throw new ActionError("compteurs_invalides");
  const own = new Set((await ownerMeters(db, ownerId)).map((m) => m.id));
  const list = [...new Set(ids.map(String))].filter((id) => own.has(id));
  if (!list.length) throw new ActionError("compteurs_invalides");
  return list.length === own.size ? null : list;
}

// ——— Invitations ———

export async function inviteMember(db: DB, ownerId: string, input: { email?: unknown; role?: unknown; compteurIds?: unknown }, origin: string) {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!isEmail(email)) throw new ActionError("email_invalide");
  const [owner] = await db.select().from(t.clients).where(eq(t.clients.id, ownerId));
  if (!owner) throw new ActionError("non_connecte", 401);
  if (owner.email === email) throw new ActionError("invitation_soi_meme");
  const role = roleOf(String(input.role ?? ""));
  const compteurIds = await cleanMeters(db, ownerId, input.compteurIds);

  const current = await db.select().from(t.partages).where(and(eq(t.partages.proprietaireId, ownerId), ne(t.partages.statut, "retire")));
  const existing = current.find((p) => p.email === email);
  const limit = await shareLimit(db, ownerId);
  if (!existing && current.length >= limit) throw new ActionError(limit === 0 ? "abonnement_requis" : "limite_partage", 402);

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86400_000);
  let id: string;
  if (existing) {
    // Déjà invité ou membre : on met à jour ses droits ; une invitation non acceptée est renvoyée
    await db
      .update(t.partages)
      .set({ role, compteurIds, ...(existing.statut === "invite" ? { tokenHash: hashToken(token), expiresAt } : {}) })
      .where(eq(t.partages.id, existing.id));
    id = existing.id;
    if (existing.statut === "actif") return { id, renvoye: false };
  } else {
    const [row] = await db.insert(t.partages).values({ proprietaireId: ownerId, email, role, compteurIds, tokenHash: hashToken(token), expiresAt }).returning({ id: t.partages.id });
    id = row.id;
  }

  const meters = await ownerMeters(db, ownerId);
  const what = compteurIds === null ? (meters.length > 1 ? `ses ${meters.length} compteurs` : `son compteur « ${meters[0]?.nom ?? ""} »`) : meters.filter((m) => compteurIds.includes(m.id)).map((m) => `« ${m.nom} »`).join(", ");
  const url = `${origin}/invitation/${token}`;
  let sent = false;
  if (mailEnabled()) sent = (await sendMail({ to: email, ...invitationMail(owner.nom, role, what, url) }).catch(() => ({ sent: false }))).sent;

  // La personne a déjà un compte : l'invitation l'attend aussi dans l'application
  const [invitee] = await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.email, email));
  if (invitee) await sendPush(db, invitee.id, { title: "Invitation Woly Elec", body: `${owner.nom || "Un client"} vous invite à suivre son électricité. Ouvrez « Partage » pour accepter.`, url: "/app/partage", tag: `invitation-${id}` });
  return { id, renvoye: true, emailEnvoye: sent, lien: process.env.NODE_ENV === "production" ? undefined : url };
}

async function inviteByToken(db: DB, token: string) {
  const [p] = await db.select().from(t.partages).where(eq(t.partages.tokenHash, hashToken(String(token))));
  if (!p || p.statut !== "invite") return null;
  if (p.expiresAt < new Date()) return null;
  return p;
}

/** Résumé d'une invitation pour la page /invitation/[token] (sans rien révéler d'autre). */
export async function invitationPreview(db: DB, token: string) {
  const p = await inviteByToken(db, token);
  if (!p) return null;
  const [owner] = await db.select({ nom: t.clients.nom }).from(t.clients).where(eq(t.clients.id, p.proprietaireId));
  const meters = await ownerMeters(db, p.proprietaireId);
  const names = (p.compteurIds === null ? meters : meters.filter((m) => p.compteurIds!.includes(m.id))).map((m) => m.nom);
  const [account] = await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.email, p.email));
  return { ownerName: owner?.nom || "Un client Woly Elec", role: roleOf(p.role), compteurs: names, email: p.email, compteExiste: !!account };
}

async function activate(db: DB, p: typeof t.partages.$inferSelect, memberId: string) {
  if (memberId === p.proprietaireId) throw new ActionError("invitation_soi_meme");
  // Un seul accès actif par titulaire et par membre
  await db.update(t.partages).set({ statut: "retire" }).where(and(eq(t.partages.proprietaireId, p.proprietaireId), eq(t.partages.membreId, memberId), ne(t.partages.id, p.id)));
  await db.update(t.partages).set({ statut: "actif", membreId: memberId, acceptedAt: new Date(), tokenHash: hashToken(newToken()) }).where(eq(t.partages.id, p.id));
  const [m] = await db.select({ nom: t.clients.nom, email: t.clients.email }).from(t.clients).where(eq(t.clients.id, memberId));
  const who = m?.nom || m?.email || p.email;
  const msg = `${who} suit maintenant votre électricité (${p.role === "gerer" ? "peut faire les relevés et les recharges" : "consultation seulement"}). Vous pouvez retirer cet accès à tout moment dans « Partage ».`;
  await db.insert(t.alertes).values({ clientId: p.proprietaireId, type: "partage", ton: "ok", icone: "users", titre: "Invitation acceptée", message: msg, canal: "push" });
  await sendPush(db, p.proprietaireId, { title: "Invitation acceptée", body: msg, url: "/app/partage", tag: `partage-${p.id}` });
  await sendAdminPush(db, "inscription", { title: "Nouveau membre invité", body: `${who} a rejoint un compte partagé`, url: "/admin/utilisateurs", tag: `partage-${p.id}` });
  return p.proprietaireId;
}

/** Acceptation par le lien reçu par e-mail, par la personne connectée. */
export async function acceptByToken(db: DB, token: string, memberId: string) {
  const p = await inviteByToken(db, token);
  if (!p) throw new ActionError("invitation_invalide", 404);
  return activate(db, p, memberId);
}

/** Acceptation depuis l'application : invitation adressée à l'e-mail du compte connecté. */
export async function acceptById(db: DB, id: string, memberId: string) {
  const [me] = await db.select({ email: t.clients.email }).from(t.clients).where(eq(t.clients.id, memberId));
  const [p] = await db.select().from(t.partages).where(eq(t.partages.id, id));
  if (!p || !me || p.email !== me.email || p.statut !== "invite" || p.expiresAt < new Date()) throw new ActionError("invitation_invalide", 404);
  return activate(db, p, memberId);
}

/**
 * Invité sans compte : création d'un accès (nom + mot de passe). Le lien vient de sa boîte mail,
 * l'adresse est donc confirmée. Ce compte n'a pas de compteur à lui : il voit le compte partagé.
 */
export async function createMemberAccount(db: DB, token: string, input: { name: string; passwordHash: string }) {
  const p = await inviteByToken(db, token);
  if (!p) throw new ActionError("invitation_invalide", 404);
  const [exists] = await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.email, p.email));
  if (exists) throw new ActionError("deja_inscrit", 409);
  const [c] = await db
    .insert(t.clients)
    .values({ email: p.email, motDePasseHash: input.passwordHash, emailVerifie: true, nom: input.name.trim().slice(0, 80), canaux: { push: true, whatsapp: false, sms: false, email: true }, consentement: true })
    .returning({ id: t.clients.id });
  await activate(db, p, c.id);
  return c.id;
}

export async function declineInvitation(db: DB, id: string, memberId: string) {
  const [me] = await db.select({ email: t.clients.email }).from(t.clients).where(eq(t.clients.id, memberId));
  await db.update(t.partages).set({ statut: "retire" }).where(and(eq(t.partages.id, id), eq(t.partages.email, me?.email ?? "-"), eq(t.partages.statut, "invite")));
}

export async function revokeMember(db: DB, ownerId: string, id: string) {
  const [p] = await db.update(t.partages).set({ statut: "retire" }).where(and(eq(t.partages.id, id), eq(t.partages.proprietaireId, ownerId))).returning();
  if (!p) throw new ActionError("partage_introuvable", 404);
  if (p.membreId) await sendPush(db, p.membreId, { title: "Accès retiré", body: "Le titulaire du compte a retiré votre accès à son électricité sur Woly Elec.", url: "/app", tag: `partage-${id}` });
}

export async function updateMember(db: DB, ownerId: string, id: string, patch: { role?: unknown; compteurIds?: unknown }) {
  const set: Partial<typeof t.partages.$inferInsert> = {};
  if (patch.role !== undefined) set.role = roleOf(String(patch.role));
  if (patch.compteurIds !== undefined) set.compteurIds = await cleanMeters(db, ownerId, patch.compteurIds);
  const [p] = await db.update(t.partages).set(set).where(and(eq(t.partages.id, id), eq(t.partages.proprietaireId, ownerId), ne(t.partages.statut, "retire"))).returning({ id: t.partages.id });
  if (!p) throw new ActionError("partage_introuvable", 404);
}

/** Le membre quitte un compte partagé. */
export async function leaveAccount(db: DB, memberId: string, ownerId: string) {
  await db.update(t.partages).set({ statut: "retire" }).where(and(eq(t.partages.proprietaireId, ownerId), eq(t.partages.membreId, memberId)));
}

// ——— Accès : quel compte la personne connectée voit-elle, avec quels droits ? ———

export type Resolved = { accountId: string; role: AccessRole; meterIds: string[] | null; access: Access } | null;

export async function resolveAccess(db: DB, clientId: string, wanted?: string | null): Promise<Resolved> {
  const [me] = await db.select().from(t.clients).where(eq(t.clients.id, clientId));
  if (!me) return null;
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.compteurs).where(eq(t.compteurs.clientId, clientId));
  const shares = await db
    .select({ p: t.partages, nom: t.clients.nom, email: t.clients.email })
    .from(t.partages)
    .innerJoin(t.clients, eq(t.clients.id, t.partages.proprietaireId))
    .where(and(eq(t.partages.membreId, clientId), eq(t.partages.statut, "actif")))
    .orderBy(asc(t.partages.acceptedAt));
  const accounts: Access["accounts"] = [];
  if (n > 0) accounts.push({ id: clientId, name: "Mon compte", role: "titulaire" });
  for (const s of shares) accounts.push({ id: s.p.proprietaireId, name: `Compte de ${s.nom || s.email}`, role: roleOf(s.p.role) });
  if (!accounts.length) return null;
  const pick = accounts.find((a) => a.id === wanted) ?? accounts[0];
  const share = shares.find((s) => s.p.proprietaireId === pick.id);
  return {
    accountId: pick.id,
    role: pick.role,
    meterIds: share ? share.p.compteurIds ?? null : null,
    access: { role: pick.role, accountId: pick.id, ownerName: share ? share.nom || share.email || undefined : undefined, accounts },
  };
}

/** État affiché : celui du compte choisi, limité aux compteurs partagés, avec le profil de la personne connectée. */
export async function stateFor(db: DB, clientId: string, wanted?: string | null): Promise<State | "aucun_acces" | null> {
  const r = await resolveAccess(db, clientId, wanted);
  if (!r) {
    const [me] = await db.select({ id: t.clients.id }).from(t.clients).where(eq(t.clients.id, clientId));
    return me ? "aucun_acces" : null;
  }
  if (r.role === "titulaire") {
    const s = await buildState(db, clientId);
    return s && { ...s, access: r.access };
  }
  const s = await buildState(db, r.accountId, undefined, { touch: false });
  if (!s) return null;
  await db.update(t.clients).set({ lastSeenAt: new Date() }).where(eq(t.clients.id, clientId));
  const [me] = await db.select().from(t.clients).where(eq(t.clients.id, clientId));
  const allowed = (id: string) => r.meterIds === null || r.meterIds.includes(id);
  const meters = s.meters.filter((m) => allowed(m.id));
  return {
    ...s,
    user: userOf(me),
    meters,
    selectedMeterId: meters[0]?.id ?? "",
    readings: s.readings.filter((x) => allowed(x.meterId)),
    recharges: s.recharges.filter((x) => allowed(x.meterId)),
    alerts: s.alerts.filter((x) => !x.meterId || allowed(x.meterId)),
    iaUsed: Object.fromEntries(Object.entries(s.iaUsed).filter(([k]) => allowed(k))),
    subscription: { ...s.subscription, payments: [] },
    pendingPayment: undefined,
    access: r.access,
  };
}

const MEMBER_ACTIONS: Record<Role, string[]> = {
  consulter: ["alerts.read", "alert.dismiss"],
  gerer: ["alerts.read", "alert.dismiss", "reading", "recharge"],
};

/**
 * Action demandée par un membre sur le compte partagé : vérifie le rôle et le compteur.
 * Renvoie l'identifiant du titulaire à utiliser pour appliquer l'action.
 */
export function checkMemberAction(r: NonNullable<Resolved>, action: { type: string; meterId?: string }) {
  if (r.role === "titulaire") return r.accountId;
  if (!MEMBER_ACTIONS[r.role].includes(action.type)) throw new ActionError(r.role === "consulter" ? "acces_lecture" : "acces_titulaire", 403);
  if (action.meterId && r.meterIds !== null && !r.meterIds.includes(action.meterId)) throw new ActionError("acces_compteur", 403);
  return r.accountId;
}

/** Compteur accessible à la personne connectée (le sien ou partagé) : renvoie le titulaire et le rôle. */
export async function meterAccess(db: DB, clientId: string, meterId: string): Promise<{ ownerId: string; role: AccessRole } | null> {
  const [m] = await db.select({ owner: t.compteurs.clientId }).from(t.compteurs).where(eq(t.compteurs.id, meterId));
  if (!m) return null;
  if (m.owner === clientId) return { ownerId: clientId, role: "titulaire" };
  const [p] = await db.select().from(t.partages).where(and(eq(t.partages.proprietaireId, m.owner), eq(t.partages.membreId, clientId), eq(t.partages.statut, "actif")));
  if (!p || (p.compteurIds !== null && !p.compteurIds.includes(meterId))) return null;
  return { ownerId: m.owner, role: roleOf(p.role) };
}

/** Membres à prévenir pour une alerte sur ce compteur. */
export async function membersFor(db: DB, ownerId: string, meterId: string) {
  const rows = await db.select().from(t.partages).where(and(eq(t.partages.proprietaireId, ownerId), eq(t.partages.statut, "actif")));
  return rows.filter((p) => p.membreId && (p.compteurIds === null || p.compteurIds.includes(meterId))).map((p) => p.membreId!);
}

// ——— Vue d'ensemble pour la page « Partage » ———

export async function sharingOverview(db: DB, clientId: string) {
  const [me] = await db.select().from(t.clients).where(eq(t.clients.id, clientId));
  const meters = await ownerMeters(db, clientId);
  const mine = await db
    .select({ p: t.partages, nom: t.clients.nom })
    .from(t.partages)
    .leftJoin(t.clients, eq(t.clients.id, t.partages.membreId))
    .where(and(eq(t.partages.proprietaireId, clientId), ne(t.partages.statut, "retire")))
    .orderBy(desc(t.partages.createdAt));
  const accesses = await db
    .select({ p: t.partages, nom: t.clients.nom, email: t.clients.email })
    .from(t.partages)
    .innerJoin(t.clients, eq(t.clients.id, t.partages.proprietaireId))
    .where(
      or(
        and(eq(t.partages.membreId, clientId), eq(t.partages.statut, "actif")),
        and(eq(t.partages.email, me?.email ?? "-"), eq(t.partages.statut, "invite"), sql`${t.partages.expiresAt} > now()`),
      ),
    );
  const links = meters.length ? await db.select().from(t.liensPartage).where(and(inArray(t.liensPartage.compteurId, meters.map((m) => m.id)), eq(t.liensPartage.actif, true))) : [];
  return {
    limite: meters.length ? await shareLimit(db, clientId) : 0,
    compteurs: meters,
    membres: mine.map(({ p, nom }) => ({
      id: p.id,
      email: p.email,
      nom: nom ?? "",
      role: roleOf(p.role),
      compteurIds: p.compteurIds ?? null,
      statut: p.statut === "invite" && p.expiresAt < new Date() ? "expire" : p.statut,
      createdAt: p.createdAt.toISOString(),
    })),
    acces: accesses.map(({ p, nom, email }) => ({ id: p.id, titulaireId: p.proprietaireId, titulaire: nom || email, role: roleOf(p.role), statut: p.statut, tous: p.compteurIds === null })),
    liens: links.map((l) => ({ id: l.id, compteurId: l.compteurId, token: l.token, vues: l.vues, createdAt: l.createdAt.toISOString() })),
  };
}

// ——— Liens de lecture (sans compte) ———

export async function createReadLink(db: DB, ownerId: string, meterId: string) {
  const [m] = await db.select({ id: t.compteurs.id }).from(t.compteurs).where(and(eq(t.compteurs.id, meterId), eq(t.compteurs.clientId, ownerId)));
  if (!m) throw new ActionError("compteur_introuvable", 404);
  if ((await shareLimit(db, ownerId)) === 0) throw new ActionError("abonnement_requis", 402);
  // Un seul lien actif par compteur : en créer un nouveau désactive l'ancien
  await db.update(t.liensPartage).set({ actif: false }).where(eq(t.liensPartage.compteurId, meterId));
  const token = randomBytes(12).toString("base64url");
  await db.insert(t.liensPartage).values({ compteurId: meterId, clientId: ownerId, token });
  return token;
}

export async function revokeReadLink(db: DB, ownerId: string, id: number) {
  await db.update(t.liensPartage).set({ actif: false }).where(and(eq(t.liensPartage.id, id), eq(t.liensPartage.clientId, ownerId)));
}

/** Données publiques d'un lien de lecture : nom du compteur, crédit, autonomie, date de coupure prévue. */
export async function readLinkView(db: DB, token: string) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return null;
  const [l] = await db.select().from(t.liensPartage).where(and(eq(t.liensPartage.token, token), eq(t.liensPartage.actif, true)));
  if (!l) return null;
  const s = await buildState(db, l.clientId, undefined, { touch: false });
  if (!s) return null;
  const meter = s.meters.find((m) => m.id === l.compteurId);
  if (!meter) return null;
  await db.update(t.liensPartage).set({ vues: sql`${t.liensPartage.vues} + 1`, vuAt: new Date() }).where(eq(t.liensPartage.id, l.id));
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const st = computeStats(s, meter.id, today);
  const [owner] = await db.select({ nom: t.clients.nom }).from(t.clients).where(eq(t.clients.id, l.clientId));
  return {
    compteur: meter.name,
    numeroFin: meter.number.replace(/\D/g, "").slice(-3),
    titulaire: owner?.nom ?? "",
    dernierReleve: st.last?.date ?? null,
    creditKwh: st.last?.balanceKwh ?? null,
    autonomieJours: st.last ? Math.floor(st.plan.autonomy) : null,
    coupure: st.plan.depletionDate ? st.plan.depletionDate.toISOString().slice(0, 10) : null,
    montantConseille: st.plan.coversMonth ? 0 : Math.round(st.plan.recommendedAmount),
    niveau: st.plan.level,
    abonnementActif: s.subscription.status !== "expire",
  };
}
