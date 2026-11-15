import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { clientSessionSecret } from "./secrets";

/**
 * Chiffrement des secrets enregistrés en base (AES-256-GCM), clé dérivée du secret serveur.
 * « usage » sépare les clés (saspay, push…) : un secret chiffré pour un usage ne se déchiffre pas pour un autre.
 */
function cipherKey(usage: string): Buffer {
  const s = clientSessionSecret();
  if (!s) throw new Error("secret_serveur_absent");
  return createHash("sha256").update(`woly-${usage}|${s}`).digest();
}

export function seal(usage: string, plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(usage), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function unseal(usage: string, box: string | undefined): string | null {
  if (!box) return null;
  try {
    const [iv, tag, data] = box.split(".").map((x) => Buffer.from(x, "base64url"));
    const d = createDecipheriv("aes-256-gcm", cipherKey(usage), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString("utf8");
  } catch {
    return null; // secret serveur changé : la valeur doit être ressaisie ou régénérée
  }
}
