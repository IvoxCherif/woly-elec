"use client";

/**
 * Préparation de la photo de l'écran du compteur avant lecture :
 * recadrage sur l'écran, niveaux de gris, contraste renforcé, taille réduite.
 * Une image petite et nette se lit plus vite et plus juste qu'une photo entière de 4 000 px.
 */

const MAX_W = 1200;
const MIN_W = 700;

/** Niveaux de gris + étirement du contraste (2 % les plus sombres → noir, 2 % les plus clairs → blanc). */
function enhance(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    hist[g]++;
  }
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  const range = Math.max(30, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

/** Dessine la zone (sx, sy, sw, sh) de la source dans un JPEG préparé. */
function render(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number): string {
  const scale = sw > MAX_W ? MAX_W / sw : sw < MIN_W ? MIN_W / sw : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  enhance(ctx, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/**
 * Capture depuis la vidéo de l'appareil photo, recadrée sur le cadre de visée affiché à l'écran
 * (la vidéo est en object-fit: cover, on convertit les coordonnées du cadre en pixels de la caméra).
 */
export function captureFrame(video: HTMLVideoElement, guide: HTMLElement): string {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const v = video.getBoundingClientRect();
  const g = guide.getBoundingClientRect();
  const scale = Math.max(v.width / vw, v.height / vh);
  const x0 = (v.width - vw * scale) / 2;
  const y0 = (v.height - vh * scale) / 2;
  // petite marge autour du cadre : un chiffre au bord n'est pas coupé
  const mx = g.width * 0.06;
  const my = g.height * 0.12;
  let sx = (g.left - v.left - mx - x0) / scale;
  let sy = (g.top - v.top - my - y0) / scale;
  let sw = (g.width + 2 * mx) / scale;
  let sh = (g.height + 2 * my) / scale;
  sx = Math.max(0, sx);
  sy = Math.max(0, sy);
  sw = Math.min(vw - sx, sw);
  sh = Math.min(vh - sy, sh);
  return render(video, sx, sy, sw, sh);
}

/** Photo choisie dans la galerie : image entière, préparée de la même façon. */
export async function prepareFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("photo_illisible"));
      i.src = url;
    });
    return render(img, 0, 0, img.naturalWidth, img.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type PhotoCode = "801" | "813" | "814";
export type PhotoAnswer = { valeur: number | null; lisible: boolean; texte: string };

const ERR: Record<string, string> = {
  trop_de_photos: "Trop de photos envoyées : réessayez dans une heure.",
  photo_indisponible: "La lecture par photo n'est pas disponible pour le moment : saisissez la valeur.",
  lecture_impossible: "Lecture impossible pour le moment : saisissez la valeur.",
  photo_trop_lourde: "Photo trop lourde : reprenez-la.",
  non_connecte: "Votre session a expiré : reconnectez-vous.",
};

/** Envoie l'image préparée au serveur, qui la fait lire par Claude. */
export async function readPhoto(meterId: string, image: string): Promise<{ ok: true; answer: PhotoAnswer } | { ok: false; error: string }> {
  try {
    const r = await fetch("/api/releve/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meterId, image }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: ERR[j.error] ?? "Lecture impossible : saisissez la valeur." };
    return { ok: true, answer: j as PhotoAnswer };
  } catch {
    return { ok: false, error: "Connexion coupée : réessayez." };
  }
}
