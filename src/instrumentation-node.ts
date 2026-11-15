import { createHash } from "node:crypto";
import { clientSessionSecret } from "./server/secrets";

/**
 * Démarrage du serveur : tâche planifiée des rappels de renouvellement, toutes les heures entre 8 h et 20 h
 * (heure du Sénégal = UTC). La tâche appelle une route interne protégée par un jeton dérivé du secret serveur,
 * et chaque rappel n'est envoyé qu'une fois (table rappels).
 */
export function startScheduler() {
  if (process.env.NODE_ENV !== "production" || process.env.RAPPELS === "off") return;

  const run = async () => {
    const hour = new Date().getUTCHours();
    if (hour < 8 || hour >= 21) return; // pas d'e-mail la nuit
    const secret = clientSessionSecret();
    if (!secret) return;
    const token = createHash("sha256").update(`woly-cron|${secret}`).digest("hex");
    try {
      const r = await fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/interne/rappels`, { method: "POST", headers: { "x-woly-cron": token } });
      if (!r.ok && r.status !== 503) console.error(`[rappels] tâche planifiée : réponse ${r.status}`);
    } catch (e) {
      console.error("[rappels] tâche planifiée impossible", (e as Error).message);
    }
  };

  console.log("[rappels] tâche planifiée active : rappels de renouvellement toutes les heures (8 h – 21 h)");
  setTimeout(() => void run(), 90_000); // une première fois peu après le démarrage
  setInterval(() => void run(), 3600_000);
}
