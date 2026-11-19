import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { readSecret } from "./secrets";

/**
 * Envoi des e-mails Woly Elec par la messagerie Hostinger.
 * - Expéditeur : wolyelec@wolyelec.com (alias de la boîte support@wolyelec.com)
 * - Connexion SMTP : boîte support@wolyelec.com (seul identifiant SMTP valide pour l'alias)
 * - Réponses : support@wolyelec.com
 * Le mot de passe de la boîte vient de la variable SMTP_PASSWORD (hPanel), jamais du code.
 */
export const MAIL_FROM = process.env.MAIL_FROM ?? "Woly Elec <wolyelec@wolyelec.com>";
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@wolyelec.com";
const SMTP_USER = process.env.SMTP_USER ?? "support@wolyelec.com";
const smtpPassword = () => readSecret("smtp_password", "SMTP_PASSWORD");

export const mailEnabled = () => !!smtpPassword();

const g = globalThis as unknown as { __wolyMail?: Transporter };

function transport(): Transporter {
  return (g.__wolyMail ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.hostinger.com",
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: Number(process.env.SMTP_PORT ?? 465) === 465,
    auth: { user: SMTP_USER, pass: smtpPassword()! },
  }));
}

export type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };

/** Envoie un e-mail. Sans SMTP configuré : rien n'est envoyé (en développement, le contenu est affiché dans la console). */
export async function sendMail(m: Mail): Promise<{ sent: boolean }> {
  if (!mailEnabled()) {
    if (process.env.NODE_ENV !== "production") console.info(`[mail non envoyé — SMTP non configuré] À : ${m.to} · ${m.subject}\n${m.text}`);
    return { sent: false };
  }
  try {
    await transport().sendMail({ from: MAIL_FROM, replyTo: m.replyTo ?? SUPPORT_EMAIL, to: m.to, subject: m.subject, html: m.html, text: m.text });
    return { sent: true };
  } catch (e) {
    console.error("[mail] échec d'envoi", (e as Error).message);
    return { sent: false };
  }
}

// ——— Modèles ———

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const SITE = process.env.APP_URL ?? "https://wolyelec.com";

function layout(title: string, body: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#F3F6F4;font-family:Arial,Helvetica,sans-serif;color:#4B5A54">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F6F4;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E1E8E4">
<tr><td style="background:#0B3D2E;padding:20px 28px"><span style="font:800 22px Arial,sans-serif;color:#ffffff">WOLY <span style="color:#FACC15">ELEC</span></span><br><span style="font-size:13px;font-weight:700;color:#FACC15">Saytu sa kuuraŋ</span><span style="font-size:12px;color:#9CC4B0"> · Votre électricité, sous contrôle</span></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font:800 22px Arial,sans-serif;color:#0B3D2E">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 28px;background:#F3F6F4;font-size:12px;line-height:1.5;color:#5C6B64">
Une question ? Répondez à cet e-mail ou écrivez à <a href="mailto:${SUPPORT_EMAIL}" style="color:#1D4ED8">${SUPPORT_EMAIL}</a>.<br>
Woly Elec est un service indépendant, non affilié à la Senelec. Une solution 100&nbsp;% sénégalaise.
</td></tr></table></td></tr></table></body></html>`;
}

const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">${t}</p>`;
const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:#1D4ED8;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">${esc(label)}</a></p>`;

export function codeMail(code: string, usage: "verification" | "reinitialisation" | "admin" | "connexion"): Omit<Mail, "to"> {
  const T = {
    verification: { intro: "Voici votre code pour confirmer votre adresse e-mail et créer votre compte Woly Elec :", subject: `${code} est votre code de vérification Woly Elec`, title: "Confirmez votre adresse e-mail" },
    admin: { intro: "Voici votre code pour choisir un nouveau mot de passe ADMINISTRATEUR Woly Elec :", subject: `${code} : réinitialisation du mot de passe administrateur Woly Elec`, title: "Mot de passe administrateur oublié" },
    reinitialisation: { intro: "Voici votre code pour choisir un nouveau mot de passe Woly Elec :", subject: `${code} est votre code de réinitialisation Woly Elec`, title: "Mot de passe oublié" },
    connexion: { intro: "Voici votre code pour vous connecter à Woly Elec :", subject: `${code} est votre code de connexion Woly Elec`, title: "Code de connexion" },
  }[usage];
  const warn =
    usage === "connexion"
      ? "Ce code expire dans 10 minutes. Si vous n'essayez pas de vous connecter, quelqu'un connaît peut-être votre mot de passe : changez-le avec « Mot de passe oublié »."
      : "Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet e-mail.";
  return {
    subject: T.subject,
    html: layout(T.title, `${p(T.intro)}
<p style="margin:18px 0;font:800 34px Arial,sans-serif;letter-spacing:8px;color:#0B3D2E;background:#E3EEE8;border-radius:12px;padding:14px;text-align:center">${code}</p>
${p(warn)}`),
    text: `${T.intro}

${code}

${warn}

Woly Elec — ${SUPPORT_EMAIL}`,
  };
}

export function welcomeMail(name: string, trial: boolean): Omit<Mail, "to"> {
  const hello = name ? `Bonjour ${esc(name)},` : "Bonjour,";
  const trialLine = trial ? "Votre essai gratuit de 30 jours commence aujourd'hui : accès complet pour un compteur." : "Ce compte ou ce compteur a déjà bénéficié d'un essai gratuit : abonnez-vous pour activer vos alertes.";
  return {
    subject: "Bienvenue sur Woly Elec",
    html: layout("Bienvenue sur Woly Elec", `${p(hello)}${p(trialLine)}${p("Faites un relevé chaque jour (codes 801, 813 et 814 de votre compteur) : plus vous en faites, plus le montant à recharger et la date d'épuisement sont précis.")}${button(`${SITE}/app`, "Ouvrir mon tableau de bord")}`),
    text: `${name ? `Bonjour ${name},` : "Bonjour,"}\n\n${trialLine}\n\nFaites un relevé chaque jour pour des prévisions plus précises : ${SITE}/app\n\nWoly Elec — ${SUPPORT_EMAIL}`,
  };
}

export function alertMail(title: string, message: string): Omit<Mail, "to"> {
  return {
    subject: `Woly Elec : ${title}`,
    html: layout(title, `${p(esc(message))}${button(`${SITE}/app/plan`, "Voir combien recharger")}`),
    text: `${title}\n\n${message}\n\n${SITE}/app/plan`,
  };
}

export function supportAckMail(reference: string, sujet: string): Omit<Mail, "to"> {
  return {
    subject: `[${reference}] Nous avons bien reçu votre demande`,
    html: layout("Demande bien reçue", `${p(`Votre demande <b>${esc(reference)}</b> « ${esc(sujet)} » a bien été enregistrée.`)}${p("Notre équipe vous répond par e-mail, en général en quelques heures (du lundi au samedi). Pour compléter votre demande, répondez simplement à cet e-mail.")}`),
    text: `Votre demande ${reference} « ${sujet} » a bien été enregistrée. Nous vous répondons par e-mail en quelques heures (du lundi au samedi). Pour compléter, répondez à cet e-mail.\n\nWoly Elec — ${SUPPORT_EMAIL}`,
  };
}

export function supportNotifyMail(d: { reference: string; nom: string; email: string; categorie: string; sujet: string; message: string; client: boolean }): Omit<Mail, "to"> {
  const lines = [`Référence : ${d.reference}`, `Catégorie : ${d.categorie}`, `De : ${d.nom || "—"} <${d.email}>`, `Compte client : ${d.client ? "oui" : "non"}`];
  return {
    subject: `[${d.reference}] ${d.categorie === "reclamation" ? "Réclamation" : "Support"} · ${d.sujet}`,
    html: layout(d.sujet, `${p(lines.map(esc).join("<br>"))}<div style="white-space:pre-wrap;font-size:15px;line-height:1.6;background:#F3F6F4;border-radius:12px;padding:14px">${esc(d.message)}</div>${button(`${SITE}/admin/support`, "Ouvrir dans l'administration")}`),
    text: `${lines.join("\n")}\n\n${d.message}\n\n${SITE}/admin/support`,
  };
}

/** Rappel de renouvellement : avant la fin de l'essai ou de l'abonnement, puis le jour où il se termine. */
export function renewalMail(v: { kind: "essai" | "abonnement"; days: number; endDate: string; offer: string; price: number }): Omit<Mail, "to"> {
  const what = v.kind === "essai" ? "Votre essai gratuit" : `Votre abonnement ${v.offer}`;
  const when = v.days <= 0 ? "est terminé" : v.days === 1 ? "se termine demain" : `se termine dans ${v.days} jours`;
  const title = `${what} ${when}`;
  const intro =
    v.days <= 0
      ? `${what} est arrivé à son terme le ${esc(v.endDate)}. Vos données sont conservées : réabonnez-vous pour retrouver vos alertes avant coupure et votre montant exact à recharger.`
      : `${what} ${when}, le ${esc(v.endDate)}. Renouvelez-le pour continuer à recevoir vos alertes avant coupure et votre montant exact à recharger.`;
  const price = `${v.offer} : à partir de ${v.price.toLocaleString("fr-FR")} F par mois. Paiement sécurisé par Wave, Orange Money, Free Money ou carte bancaire.`;
  return {
    subject: `${title} · Woly Elec`,
    text: `${intro}\n\n${price}\n\nRenouveler : ${SITE}/app/abonnement/paiement`,
    html: layout(title, `${p(intro)}${p(esc(price))}${button(`${SITE}/app/abonnement/paiement`, v.days <= 0 ? "Me réabonner" : "Renouveler mon abonnement")}`),
  };
}

/** Invitation à suivre le compte d'un client (partage). */
export function invitationMail(ownerName: string, role: "consulter" | "gerer", compteurs: string, url: string): Omit<Mail, "to"> {
  const who = ownerName || "Un client Woly Elec";
  const what =
    role === "gerer"
      ? "voir le crédit restant, recevoir les alertes avant coupure, et faire les relevés et les recharges"
      : "voir le crédit restant et recevoir les alertes avant coupure";
  const intro = `${who} vous invite à suivre son électricité sur Woly Elec (${compteurs}) : vous pourrez ${what}.`;
  return {
    subject: `${who} vous invite sur Woly Elec`,
    html: layout("Vous êtes invité sur Woly Elec", `${p(esc(intro))}${button(url, "Accepter l'invitation")}${p("Cette invitation est valable 7 jours. Vous gardez votre propre mot de passe : vos identifiants ne sont jamais partagés. Si vous ne connaissez pas cette personne, ignorez cet e-mail.")}`),
    text: `${intro}\n\nAccepter l'invitation : ${url}\n\nCette invitation est valable 7 jours.\n\nWoly Elec — ${SUPPORT_EMAIL}`,
  };
}
