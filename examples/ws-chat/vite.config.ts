import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "effect-cycle-core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "effect-cycle-dom": path.resolve(__dirname, "../../packages/dom/src/index.ts"),
      "effect-cycle-ws": path.resolve(__dirname, "../../packages/ws/src/index.ts"),
    },
  },
})
