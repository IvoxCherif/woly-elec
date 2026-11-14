/** Modèles de messages du cahier des charges, renommés Woly Elec. {lien} = lien personnel et expirable. */
export const TEMPLATES = [
  { id: "a5", name: "Alerte à 5 jours", channel: "WhatsApp / push", text: "Woly Elec : il vous reste environ {jours} jours d'électricité. Mettez à jour votre compteur pour recevoir votre montant exact : {lien}" },
  { id: "a3", name: "Alerte à 3 jours", channel: "WhatsApp / push", text: "Votre crédit couvre environ {jours} jours. Mettez à jour votre solde et recevez le montant exact pour tenir jusqu'à la fin du mois : {lien}" },
  { id: "a1", name: "Alerte à 1 jour", channel: "SMS + WhatsApp", text: "Urgence : votre électricité devrait s'épuiser dans environ 1 jour. Rechargez maintenant. Cliquez pour voir votre montant recommandé : {lien}" },
  { id: "rp", name: "Rappel avant la date de recharge", channel: "WhatsApp / push", text: "Votre recharge est prévue dans 3 jours. Mettez à jour votre compteur pour recevoir le montant optimal : {lien}" },
  { id: "rc", name: "Message après recharge", channel: "WhatsApp / push", text: "Recharge enregistrée : {montant}. Vous devriez recevoir environ {kwh} kWh. Votre électricité devrait durer jusqu'au {date}. Mettez à jour votre compteur après la recharge : {lien}" },
  { id: "fm", name: "Message de fin de mois", channel: "E-mail", text: "Votre bilan du mois est prêt : {kwh} kWh consommés, {recharges} recharges. Consultez votre plan pour le mois prochain : {lien}" },
  { id: "fe", name: "Expiration de l'abonnement", channel: "WhatsApp / e-mail", text: "Votre abonnement expire dans 3 jours. Sans abonnement, vous ne recevrez plus vos alertes de coupure ni votre montant exact pour tenir jusqu'à la fin du mois. {lien}" },
];
