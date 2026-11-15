/** Notifications push côté navigateur : abonnement de ce téléphone (service worker /sw.js + clé VAPID du serveur). */

export type PushState = "indisponible" | "iphone_installer" | "bloque" | "inactif" | "actif";

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

/** État des notifications sur cet appareil. */
export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "indisponible";
  // Sur iPhone, les notifications web ne marchent que dans l'application ajoutée à l'écran d'accueil
  if (isIos() && !isStandalone()) return "iphone_installer";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "indisponible";
  if (Notification.permission === "denied") return "bloque";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "actif" : "inactif";
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Demande l'autorisation, abonne ce téléphone et l'enregistre sur le compte. */
export async function enablePush(): Promise<PushState> {
  const state = await pushState();
  if (state === "indisponible" || state === "iphone_installer" || state === "bloque") return state;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "bloque" : "inactif";
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const r = await fetch("/api/push", { cache: "no-store" });
  if (!r.ok) throw new Error("serveur");
  const { publicKey } = (await r.json()) as { publicKey: string };
  let sub = await reg.pushManager.getSubscription();
  // Clé serveur changée : on remplace l'ancien abonnement
  const current = sub?.options.applicationServerKey ? btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : null;
  if (sub && current !== publicKey) {
    await sub.unsubscribe();
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  const save = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) });
  if (!save.ok) throw new Error("serveur");
  return "actif";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
    await sub.unsubscribe();
  }
  return pushState();
}

export async function testPush(): Promise<number> {
  const r = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ test: true }) });
  const j = await r.json().catch(() => ({}));
  return r.ok ? Number(j.envoyees ?? 0) : -1;
}
