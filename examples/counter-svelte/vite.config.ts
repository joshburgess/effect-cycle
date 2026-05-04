import path from "node:path"
import { fileURLToPath } from "node:url"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import { defineConfig } from "vite"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      "effect-cycle-core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
      "effect-cycle-dom": path.resolve(__dirname, "../../packages/dom/src/index.ts"),
      "effect-cycle-svelte": path.resolve(__dirname, "../../packages/svelte/src/index.ts"),
    },
  },
})
