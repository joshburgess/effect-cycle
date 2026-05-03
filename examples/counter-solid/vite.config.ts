import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import solidPlugin from "vite-plugin-solid"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  plugins: [solidPlugin()],
  resolve: {
    alias: {
      "effect-cycle-core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "effect-cycle-dom": path.resolve(__dirname, "../../packages/dom/src/index.ts"),
      "effect-cycle-solid": path.resolve(__dirname, "../../packages/solid/src/index.ts"),
    },
  },
})
