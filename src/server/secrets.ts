import { readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * Secrets serveur : variable d'environnement, sinon fichier dans SECRETS_DIR (/run/woly en production).
 * Sur le VPS, le conteneur « secrets » génère ces fichiers au premier démarrage : rien à saisir à la main.
 */
export function readSecret(file: string, envName: string): string | null {
  const fromEnv = process.env[envName];
  if (fromEnv) return fromEnv.trim();
  try {
    const v = readFileSync(path.join(process.env.SECRETS_DIR ?? "/run/woly", file), "utf8").trim();
    return v || null;
  } catch {
    return null;
  }
}

// Partagé via globalThis : en développement, chaque route a son propre module, il faut le même secret partout.
const g = globalThis as unknown as { __wolyDevSecret?: string };

/** Secret des sessions clients. En développement sans secret, un secret temporaire est créé (sessions perdues au redémarrage). */
export function clientSessionSecret(): string | null {
  const s = readSecret("session_secret", "SESSION_SECRET");
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return (g.__wolyDevSecret ??= randomBytes(32).toString("base64url"));
  return null;
}
