import path from "node:path"
import { svelte } from "@sveltejs/vite-plugin-svelte"
import solidPlugin from "vite-plugin-solid"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // vite-plugin-solid wires the right Solid resolution conditions and JSX
  // runtime so solid-js / solid-js/web / solid-js/h pick their client
  // builds under jsdom. Without it, vitest externalizes solid-js and Node's
  // resolver picks the server bundle, which throws "Client-only API called
  // on the server side". The plugin is a no-op for non-solid tests.
  //
  // The svelte plugin compiles `.svelte` files (the counter-svelte example
  // imports Counter.svelte). Without it, vite's TS-only transform pipeline
  // chokes on the `<script>...</script>` block. Both plugins are no-ops for
  // tests that don't touch their respective renderers.
  plugins: [solidPlugin(), svelte({ hot: false })],
  resolve: {
    alias: {
      "effect-cycle-core": path.resolve(__dirname, "packages/core/src/index.ts"),
      "effect-cycle-dom": path.resolve(__dirname, "packages/dom/src/index.ts"),
      "effect-cycle-morphdom": path.resolve(__dirname, "packages/morphdom/src/index.ts"),
      "effect-cycle-tachys": path.resolve(__dirname, "packages/tachys/src/index.ts"),
      "effect-cycle-preact": path.resolve(__dirname, "packages/preact/src/index.ts"),
      "effect-cycle-react": path.resolve(__dirname, "packages/react/src/index.ts"),
      "effect-cycle-lit-html": path.resolve(__dirname, "packages/lit-html/src/index.ts"),
      "effect-cycle-vue": path.resolve(__dirname, "packages/vue/src/index.ts"),
      "effect-cycle-solid": path.resolve(__dirname, "packages/solid/src/index.ts"),
      "effect-cycle-svelte": path.resolve(__dirname, "packages/svelte/src/index.ts"),
      "effect-cycle-http": path.resolve(__dirname, "packages/http/src/index.ts"),
      "effect-cycle-ws": path.resolve(__dirname, "packages/ws/src/index.ts"),
      "effect-cycle-router": path.resolve(__dirname, "packages/router/src/index.ts"),
      "effect-cycle-testing": path.resolve(__dirname, "packages/testing/src/index.ts"),
      "effect-cycle-devtools": path.resolve(__dirname, "packages/devtools/src/index.ts"),
    },
  },
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "examples/*/test/**/*.test.ts",
    ],
    passWithNoTests: true,
  },
})
