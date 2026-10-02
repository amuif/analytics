<script lang="ts">
  let { size = 32, class: className = '' }: { size?: number; class?: string } = $props();

  // Aspect ratio is 38:57 (width:height) -> width = size * (38/57)
  let computedWidth = $derived(Math.round(size * (38 / 57)));
</script>

<svg
  width={computedWidth}
  height={size}
  viewBox="0 0 38 57"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  class="shrink-0 {className}"
  aria-label="Decide Logo"
>
  <!-- Top Left: Figma Lilac (#c5b0f4) -->
  <path
    d="M0 9.5C0 4.25329 4.25329 0 9.5 0H19V19H9.5C4.25329 19 0 14.7467 0 9.5Z"
    fill="#c5b0f4"
  />

  <!-- Top Right: Figma Coral (#f3c9b6) -->
  <path
    d="M19 0H28.5C33.7467 0 38 4.25329 38 9.5C38 14.7467 33.7467 19 28.5 19H19V0Z"
    fill="#f3c9b6"
  />

  <!-- Mid Left: Figma Lime (#dceeb1) -->
  <path
    d="M0 28.5C0 23.2533 4.25329 19 9.5 19H19V38H9.5C4.25329 38 0 33.7467 0 28.5Z"
    fill="#dceeb1"
  />

  <!-- Mid Right: Figma Mint Circle (#c8e6cd) -->
  <circle
    cx="28.5"
    cy="28.5"
    r="9.5"
    fill="#c8e6cd"
  />

  <!-- Bottom Left: Figma Navy (#1f1d3d) in light mode / Cream (#f4ecd6) in dark mode -->
  <path
    d="M0 38H19V57H9.5C4.25329 57 0 52.7467 0 47.5V38Z"
    class="fill-[#1f1d3d] dark:fill-[#f4ecd6] transition-colors"
  />

  <!-- Bottom Right: Figma Accent Magenta (#ff3d8b) -->
  <path
    d="M19 38H28.5C33.7467 38 38 42.2533 38 47.5C38 52.7467 33.7467 57 28.5 57H19V38Z"
    fill="#ff3d8b"
  />
</svg>
