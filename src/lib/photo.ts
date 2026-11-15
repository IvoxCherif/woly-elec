"use client";

/** Réduit une photo du téléphone (souvent 4 000 px, plusieurs Mo) en JPEG ≤ 1 600 px avant l'envoi. */
export async function shrinkPhoto(file: File, max = 1600, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("photo_illisible"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type PhotoCode = "801" | "813" | "814";
export type PhotoAnswer = { valeur: number | null; code: PhotoCode | null; lisible: boolean };

const ERR: Record<string, string> = {
  trop_de_photos: "Trop de photos envoyées : réessayez dans une heure.",
  photo_indisponible: "La lecture par photo n'est pas disponible pour le moment : saisissez la valeur.",
  lecture_impossible: "Lecture impossible pour le moment : saisissez la valeur.",
  photo_trop_lourde: "Photo trop lourde : reprenez-la.",
  non_connecte: "Votre session a expiré : reconnectez-vous.",
};

/** Envoie la photo au serveur, qui la fait lire par Claude. */
export async function readPhoto(meterId: string, file: File): Promise<{ ok: true; answer: PhotoAnswer } | { ok: false; error: string }> {
  try {
    const image = await shrinkPhoto(file);
    const r = await fetch("/api/releve/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meterId, image }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: ERR[j.error] ?? "Lecture impossible : saisissez la valeur." };
    return { ok: true, answer: j as PhotoAnswer };
  } catch {
    return { ok: false, error: "Photo illisible ou connexion coupée : réessayez." };
  }
}
