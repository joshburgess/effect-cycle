<script lang="ts">
  import type { Readable } from "svelte/store"

  // Props are typed via Svelte 5's $props() rune. The `count` prop is a
  // Readable<number> store created by `ReactiveSink.fromStream`. Reading it
  // with the `$store` shorthand subscribes the template to fine-grained
  // updates: only the text node interpolating `$count` is patched on each
  // emission, not the whole tree.
  let { count }: { count: Readable<number> } = $props()
</script>

<div>
  <h1>Count: {$count}</h1>
  <button class="decrement" type="button">-</button>
  <button class="increment" type="button">+</button>
</div>
