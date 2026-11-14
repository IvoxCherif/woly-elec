/** Numéro sénégalais normalisé : +221 suivi de 9 chiffres (77, 78, 76, 75, 70, 33…). Sert aux alertes WhatsApp / SMS. */
export function normalizePhone(input: string): string | null {
  let d = String(input).replace(/\D/g, "");
  if (d.startsWith("00221")) d = d.slice(5);
  else if (d.startsWith("221") && d.length === 12) d = d.slice(3);
  return /^[37]\d{8}$/.test(d) ? `+221${d}` : null;
}

/** Adresse e-mail normalisée (minuscules), ou null si invalide. */
export function normalizeEmail(input: string): string | null {
  const e = String(input ?? "").trim().toLowerCase();
  return e.length <= 160 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}
