import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./admin-session";
import { hashPassword, verifyPassword } from "./admin-password";

const SECRET = "x".repeat(48);

describe("session admin", () => {
  it("accepte un jeton valide", async () => {
    expect(await verifySessionToken(await createSessionToken(SECRET), SECRET)).toBe(true);
  });
  it("refuse un jeton expiré", async () => {
    const t = await createSessionToken(SECRET, Date.now() - 9 * 3600 * 1000);
    expect(await verifySessionToken(t, SECRET)).toBe(false);
  });
  it("refuse un jeton falsifié ou signé avec un autre secret", async () => {
    const t = await createSessionToken(SECRET);
    const [exp, sig] = t.split(".");
    expect(await verifySessionToken(`${Number(exp) + 1}.${sig}`, SECRET)).toBe(false);
    expect(await verifySessionToken(t, "y".repeat(48))).toBe(false);
    expect(await verifySessionToken(undefined, SECRET)).toBe(false);
  });
});

describe("mot de passe admin", () => {
  it("vérifie le bon mot de passe et refuse le mauvais", async () => {
    const h = await hashPassword("Un-mot-de-passe-solide-2026");
    expect(h.startsWith("scrypt:")).toBe(true);
    expect(h.includes("$")).toBe(false);
    expect(await verifyPassword("Un-mot-de-passe-solide-2026", h)).toBe(true);
    expect(await verifyPassword("mauvais", h)).toBe(false);
    expect(await verifyPassword("x", "n'importe quoi")).toBe(false);
  });
});
