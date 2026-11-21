/** Suivi Meta (Facebook / Instagram) côté navigateur. Rien n'est envoyé sans l'accord du visiteur. */
export const PIXEL_CONSENT = "woly_cookies_mesure"; // "oui" | "non"

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };
type W = Window & { fbq?: Fbq; _fbq?: Fbq };

export function readConsent(): "oui" | "non" | null {
  try {
    const v = localStorage.getItem(PIXEL_CONSENT);
    return v === "oui" || v === "non" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(v: "oui" | "non") {
  try {
    localStorage.setItem(PIXEL_CONSENT, v);
  } catch {
    /* stockage indisponible : la question reviendra à la prochaine visite */
  }
}

/** Charge le script Meta une seule fois (code officiel fbevents, réécrit sans eval). */
export function loadPixel(id: string) {
  const w = window as W;
  if (w.fbq) return;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue!.push(args);
  } as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  w.fbq = n;
  w._fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  n("init", id);
}

/** Événement standard Meta (PageView, CompleteRegistration, StartTrial, Subscribe, Purchase…). Sans effet si le Pixel n'est pas chargé. */
export function track(event: string, params?: Record<string, unknown>, opts?: { once?: string }) {
  const w = window as W;
  if (!w.fbq) return;
  if (opts?.once) {
    try {
      const k = `woly_px_${opts.once}`;
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {
      /* pas de garde : l'événement part quand même */
    }
  }
  w.fbq("track", event, params);
}
