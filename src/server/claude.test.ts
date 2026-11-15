import { describe, expect, it } from "vitest";
import { parseDisplay } from "./claude";

describe("lecture de l'écran du compteur", () => {
  it("convertit le texte recopié en kWh", () => {
    expect(parseDisplay("0041.6")).toBe(41.6);
    expect(parseDisplay("41,6")).toBe(41.6);
    expect(parseDisplay("00152")).toBe(152);
    expect(parseDisplay(" 7.25 kWh")).toBe(7.25);
    expect(parseDisplay("")).toBeNull();
    expect(parseDisplay("4.1.6")).toBeNull();
    expect(parseDisplay("--.-")).toBeNull();
  });
});
