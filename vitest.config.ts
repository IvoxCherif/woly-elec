import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // « server-only » refuse d'être importé hors de Next.js : neutralisé pour les tests
      "server-only": path.resolve(__dirname, "src/test/empty.ts"),
    },
  },
  // Base PGlite créée et migrée dans beforeAll : peut dépasser 10 s quand plusieurs fichiers tournent en parallèle
  test: { include: ["src/**/*.test.ts"], testTimeout: 30000, hookTimeout: 120000 },
});
