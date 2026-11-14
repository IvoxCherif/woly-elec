const nf0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 12450 → "12 450 F" (espace insécable fine remplacée par une espace simple pour l'affichage) */
export const fcfa = (n: number) => `${nf0.format(Math.round(n)).replace(/ /g, " ")} F`;
export const num = (n: number, digits = 1) =>
  (digits === 0 ? nf0 : nf1).format(n).replace(/ /g, " ");
export const kwh = (n: number, digits = 1) => `${num(n, digits)} kWh`;

export function days(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n < 1) return "moins d'un jour";
  const r = Math.floor(n);
  return `${r} jour${r > 1 ? "s" : ""}`;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

export const monthName = (d: Date) => MONTHS[d.getMonth()];
export const monthShort = (m: number) => MONTHS_SHORT[((m % 12) + 12) % 12];
export const monthYear = (d: Date) => `${MONTHS[d.getMonth()][0].toUpperCase()}${MONTHS[d.getMonth()].slice(1)} ${d.getFullYear()}`;

export const ddmm = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`;
};
export const ddmmyyyy = (d: Date | string) => {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${ddmm(x)}/${x.getFullYear()}`;
};
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "il y a 2 jours", "aujourd'hui", "hier" */
export function ago(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((new Date(isoDate(now)).getTime() - new Date(isoDate(d)).getTime()) / 86400000);
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  return `il y a ${diff} jours`;
}

/** Saisie française "41,6" → 41.6 */
export const parseNum = (s: string) => {
  const n = parseFloat(s.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/** 20 chiffres groupés par 4 */
export const token = (s: string) => s.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
