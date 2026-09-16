import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

import path from "node:path";

export default defineConfig({
  resolve: { alias: { "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts") } },
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/calc/**"],
      exclude: ["lib/calc/index.ts"],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
