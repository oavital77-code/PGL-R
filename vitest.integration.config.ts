import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

/** Integration tests need DATABASE_URL (migrated + seeded). Run: pnpm test:integration */
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  test: { include: ["tests/integration/**/*.test.ts"], environment: "node", fileParallelism: false, testTimeout: 60_000 },
});
