<script lang="ts">
  let { size = 28, class: className = '', showDot = true }: { size?: number; class?: string; showDot?: boolean } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 100 100"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  class="shrink-0 {className}"
  aria-label="Decide Logo"
>
  <!-- Top Left Stem: Figma Lilac (#c5b0f4) -->
  <path
    d="M14 22C14 17.5817 17.5817 14 22 14H36V50H14V22Z"
    fill="#c5b0f4"
  />

  <!-- Bottom Left Stem: Figma Coral (#f3c9b6) -->
  <path
    d="M14 50H36V86H22C17.5817 86 14 82.4183 14 78V50Z"
    fill="#f3c9b6"
  />

  <!-- Top Right Bowl: Figma Mint (#c8e6cd) -->
  <path
    d="M36 14H50C69.8823 14 86 30.1177 86 50H66C66 41.1634 58.8366 34 50 34H36V14Z"
    fill="#c8e6cd"
  />

  <!-- Bottom Right Bowl: Figma Lime (#dceeb1) -->
  <path
    d="M86 50C86 69.8823 69.8823 86 50 86H36V66H50C58.8366 66 66 58.8366 66 50H86Z"
    fill="#dceeb1"
  />

  {#if showDot}
    <!-- Focal Decision Core: Figma Accent Magenta (#ff3d8b) -->
    <circle
      cx="48"
      cy="50"
      r="6"
      fill="#ff3d8b"
    />
  {/if}
</svg>
