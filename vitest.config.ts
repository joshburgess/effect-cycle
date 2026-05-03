import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "effect-cycle-core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "effect-cycle-dom": path.resolve(__dirname, "packages/dom/src/index.ts"),
      "effect-cycle-morphdom": path.resolve(__dirname, "packages/morphdom/src/index.ts"),
      "effect-cycle-tachys": path.resolve(__dirname, "packages/tachys/src/index.ts"),
      "effect-cycle-http": path.resolve(__dirname, "packages/http/src/index.ts"),
      "effect-cycle-ws": path.resolve(__dirname, "packages/ws/src/index.ts"),
      "effect-cycle-router": path.resolve(__dirname, "packages/router/src/index.ts"),
      "effect-cycle-testing": path.resolve(__dirname, "packages/testing/src/index.ts"),
      "effect-cycle-devtools": path.resolve(__dirname, "packages/devtools/src/index.ts"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "packages/*/test/**/*.test.ts"],
    passWithNoTests: true,
  },
})
