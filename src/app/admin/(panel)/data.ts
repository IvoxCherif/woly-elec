/** Données d'exemple pour l'administration (remplacées par l'API en production). */

export type AdminUser = { id: string; name: string; phone: string; meters: number; pack: "Essai" | "Woly Elec 1" | "Woly Elec IA"; status: "Actif" | "Essai" | "Expiré"; readings: number; lastSeen: string; city: string; expires: string };

export const USERS: AdminUser[] = [
  { id: "u1", name: "M. Ba", phone: "+221 77 ••• •• 12", meters: 1, pack: "Woly Elec 1", status: "Actif", readings: 22, lastSeen: "aujourd'hui", city: "Dakar", expires: "14/11/2027" },
  { id: "u2", name: "Mme Sow", phone: "+221 78 ••• •• 40", meters: 2, pack: "Woly Elec IA", status: "Actif", readings: 31, lastSeen: "hier", city: "Pikine", expires: "02/12/2026" },
  { id: "u3", name: "M. Fall", phone: "+221 76 ••• •• 08", meters: 1, pack: "Essai", status: "Essai", readings: 6, lastSeen: "il y a 2 jours", city: "Rufisque", expires: "19/11/2026" },
  { id: "u4", name: "Mme Ndiaye", phone: "+221 77 ••• •• 91", meters: 1, pack: "Woly Elec 1", status: "Expiré", readings: 14, lastSeen: "il y a 9 jours", city: "Thiès", expires: "10/11/2026" },
  { id: "u5", name: "M. Diallo", phone: "+221 77 ••• •• 67", meters: 6, pack: "Woly Elec IA", status: "Actif", readings: 54, lastSeen: "aujourd'hui", city: "Dakar", expires: "13/10/2027" },
  { id: "u6", name: "Mme Diop", phone: "+221 70 ••• •• 33", meters: 1, pack: "Essai", status: "Essai", readings: 2, lastSeen: "aujourd'hui", city: "Guédiawaye", expires: "08/12/2026" },
  { id: "u7", name: "M. Sarr", phone: "+221 77 ••• •• 55", meters: 3, pack: "Woly Elec 1", status: "Actif", readings: 18, lastSeen: "il y a 3 jours", city: "Saint-Louis", expires: "21/12/2026" },
  { id: "u8", name: "Mme Faye", phone: "+221 78 ••• •• 02", meters: 1, pack: "Woly Elec IA", status: "Actif", readings: 27, lastSeen: "hier", city: "Dakar", expires: "30/11/2026" },
];

export type AlertLog = { time: string; user: string; type: string; channel: "WhatsApp" | "SMS" | "Push" | "E-mail"; status: "Remis" | "En attente" | "Échec" };

export const ALERT_LOG: AlertLog[] = [
  { time: "08:12", user: "M. Ba", type: "Alerte 3 jours", channel: "WhatsApp", status: "Remis" },
  { time: "08:12", user: "Mme Sow", type: "Alerte 1 jour", channel: "SMS", status: "Remis" },
  { time: "07:40", user: "M. Fall", type: "Relance hebdo", channel: "Push", status: "En attente" },
  { time: "07:05", user: "Mme Ndiaye", type: "Fin de mois", channel: "E-mail", status: "Échec" },
  { time: "06:30", user: "M. Diallo", type: "Alerte 5 jours", channel: "WhatsApp", status: "Remis" },
  { time: "06:30", user: "Mme Diop", type: "Fin d'essai J-3", channel: "WhatsApp", status: "Remis" },
  { time: "Hier 21:00", user: "M. Sarr", type: "Rappel de recharge", channel: "Push", status: "Remis" },
  { time: "Hier 18:42", user: "Mme Faye", type: "Recharge enregistrée", channel: "WhatsApp", status: "Remis" },
];

export type AdminRow = { id: string; name: string; phone: string; email?: string; method?: string; meters: number; readings: number; pack: string; status: string; expires: string; monthly: number; createdAt: string; lastSeen: string };

export const sampleUsers = (): AdminRow[] =>
  USERS.map((u) => ({ id: u.id, name: u.name, phone: u.phone, meters: u.meters, readings: u.readings, pack: u.pack, status: u.status, expires: u.expires, monthly: 0, createdAt: "", lastSeen: u.lastSeen }));

export { TEMPLATES } from "@/lib/templates";
