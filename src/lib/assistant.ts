/**
 * Assistant Woly Elec : réponses locales construites uniquement à partir du moteur de calcul.
 * Sert de repli quand l'API Claude n'est pas configurée, et fournit le contexte chiffré envoyé à Claude.
 * Règle produit : l'IA n'invente jamais de chiffres.
 */
import type { MeterStats } from "./store";
import { days, fcfa, kwh, num } from "./format";

export function contextFor(s: MeterStats): string {
  const p = s.plan;
  return [
    `Compteur : ${s.meter.name} (${s.meter.phase === "mono" ? "monophasé" : "triphasé"})`,
    `Solde actuel (code 801) : ${kwh(s.last?.balanceKwh ?? 0)}`,
    `Consommation moyenne : ${num(s.avg7)} kWh/jour sur 7 jours, ${num(s.avg3)} kWh/jour sur 3 jours`,
    `Autonomie estimée : ${days(p.autonomy)}${p.depletionDate && !p.coversMonth ? `, épuisement estimé le ${p.depletionDate.getDate()}` : ", couvre la fin du mois"}`,
    `Jours restants dans le mois : ${p.daysLeft}`,
    `kWh achetés ce mois-ci : ${kwh(s.boughtMonthKwh, 0)} (tranche ${s.tier}, ${s.tier === 1 ? `${kwh(s.leftInTier, 0)} restants en tranche 1` : "tranche 1 épuisée"})`,
    `Recharges ce mois-ci : ${s.monthRecharges.map((r) => `${r.date} ${fcfa(r.amount)} → ${kwh(r.kwh, 0)}`).join(" ; ") || "aucune"}`,
    `Besoin jusqu'à la fin du mois : ${kwh(p.needKwh)} ; montant minimum ${fcfa(p.minAmount)}, recommandé ${fcfa(p.recommendedAmount)} (marge ${Math.round(p.margin * 100)} %)`,
    `Meilleur jour de recharge : ${s.best.title} — ${s.best.reason}`,
    `Fiabilité : ${s.reliability.label} (${s.readings.length} relevés)`,
    `Grille : 82 F/kWh jusqu'à 150 kWh achetés dans le mois, 136,49 F/kWh de 151 à 250 kWh ; taxe communale 2,5 % ; redevance mensuelle sur la 1re recharge.`,
  ].join("\n");
}

export function localAnswer(question: string, s: MeterStats): string {
  const q = question.toLowerCase();
  const p = s.plan;
  if (/bilan|mois|résumé|resume/.test(q))
    return `Ce mois-ci, vous avez acheté ${kwh(s.boughtMonthKwh, 0)} en ${s.monthRecharges.length} recharge(s) et vous consommez environ ${num(s.avg7)} kWh par jour. ${s.tier === 1 ? `Vous êtes encore en tranche 1 : il vous reste ${kwh(s.leftInTier, 0)} à 82 F avant la tranche 2.` : "Vous avez dépassé 150 kWh achetés : vos prochains kWh coûtent 136,49 F jusqu'au 1er."}`;
  if (/économ|econom|réduire|reduire|moins/.test(q))
    return `Votre moyenne est d'environ ${num(s.avg7)} kWh par jour. Les appareils qui chauffent ou refroidissent (climatiseur, fer, chauffe-eau) pèsent le plus : déclarez-les dans « Appareils » pour voir leur part. Et rechargez le gros de votre crédit en début de mois pour rester en tranche 1.`;
  if (/combien|montant|recharg/.test(q))
    return p.needKwh > 0
      ? `D'après vos relevés, il vous manque environ ${kwh(p.needKwh)} pour finir le mois. Comptez au minimum ${fcfa(p.minAmount)} ; je conseille ${fcfa(p.recommendedAmount)} pour garder une marge. ${s.best.reason}`
      : `Votre solde couvre les ${p.daysLeft} jours restants. Inutile de recharger avant le 1er : vos kWh repartiront en tranche 1.`;
  if (/quand|jour|date|coupure|épuis|epuis/.test(q))
    return p.coversMonth
      ? `Votre crédit (${kwh(s.last?.balanceKwh ?? 0)}) devrait tenir jusqu'à la fin du mois. Meilleur moment pour recharger : le 1er.`
      : `Votre crédit couvre environ ${days(p.autonomy)}, jusqu'au ${p.depletionDate?.getDate()}. ${s.best.reason}`;
  if (/tranche|prix|kwh|pourquoi/.test(q))
    return `Le prix du kWh dépend de vos achats du mois : 82 F jusqu'à 150 kWh achetés, puis 136,49 F. Vous en êtes à ${kwh(s.boughtMonthKwh, 0)} (tranche ${s.tier}). Le même montant donne donc plus de kWh en début de mois.`;
  return `Voici votre situation : solde ${kwh(s.last?.balanceKwh ?? 0)}, environ ${days(p.autonomy)} d'autonomie, tranche ${s.tier}. ${p.needKwh > 0 ? `Pour finir le mois : ${fcfa(p.minAmount)} minimum.` : "Votre crédit couvre le mois."} Posez-moi une question sur votre bilan, votre montant ou le meilleur jour.`;
}
