import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "effect-cycle-core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "effect-cycle-dom": path.resolve(__dirname, "../../packages/dom/src/index.ts"),
      "effect-cycle-http": path.resolve(__dirname, "../../packages/http/src/index.ts"),
      "effect-cycle-router": path.resolve(__dirname, "../../packages/router/src/index.ts"),
      "aeon-core": path.resolve(__dirname, "../../../aeon/packages/core/src/index.ts"),
      "aeon-dom": path.resolve(__dirname, "../../../aeon/packages/dom/src/index.ts"),
      "aeon-effect": path.resolve(__dirname, "../../../aeon/packages/effect/src/index.ts"),
      "aeon-scheduler": path.resolve(__dirname, "../../../aeon/packages/scheduler/src/index.ts"),
      "aeon-types": path.resolve(__dirname, "../../../aeon/packages/types/src/index.ts"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:4100",
    },
  },
})
