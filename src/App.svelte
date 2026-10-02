<script lang="ts">
  import { onMount } from 'svelte';
  import Dropzone from './components/Dropzone.svelte';
  import ResultsDashboard from './components/ResultsDashboard.svelte';
  import Logo from './components/Logo.svelte';
  import { db } from './lib/db';
  import { themeManager } from './lib/theme.svelte';
  import type { DatasetSummary, ChartDefinition } from './types';
  import type { ParseResult } from './lib/parser';
  import { Moon, Sun } from 'lucide-svelte';
  // State
  let currentSummary = $state<DatasetSummary | null>(null);
  let currentRows = $state<Record<string, any>[]>([]);
  let currentCharts = $state<ChartDefinition[]>([]);

  onMount(async () => {
    try {
      const saved = await db.getLatestDataset();
      if (saved && saved.rows.length > 0) {
        currentSummary = saved.summary;
        currentRows = saved.rows;
        currentCharts = saved.charts;
      }
    } catch (e) {
      console.warn('Could not restore last dataset from IndexedDB:', e);
    } 
  });

  function handleDataParsed(result: ParseResult) {
    currentSummary = result.summary;
    currentRows = result.rows;
    currentCharts = result.charts;
  }

  function handleReset() {
    currentSummary = null;
    currentRows = [];
    currentCharts = [];
  }
</script>

<main class="min-h-screen flex flex-col bg-white dark:bg-[#0d0d0d] text-black dark:text-white font-sans antialiased transition-colors duration-200">
  <!-- Figma Minimalist Header with Dark Mode Support -->
  <header class="border-b border-[#e6e6e6] dark:border-[#222222] bg-white dark:bg-[#121212] sticky top-0 z-40 transition-colors duration-200">
    <div class="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
      <div class="flex items-center gap-2.5 sm:gap-3">
        <!-- Figma Modular D Brand Mark -->
        <Logo size={28} />
        <div class="flex items-center gap-1.5 sm:gap-2">
          <span class="text-sm sm:text-base font-semibold tracking-tight text-black dark:text-white">Decide</span>
          <span class="text-[10px] sm:text-[11px] font-mono px-2 sm:px-2.5 py-0.5 rounded-full bg-[#f7f7f5] dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-300 border border-[#e6e6e6] dark:border-[#2c2c2c]">
            v1.0
          </span>
        </div>
      </div>

      <!-- Header Badges and Theme Switcher (Pure Typography) -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Download Desktop App Pill -->
        <a
          href="/downloads/Decide.exe"
          download="Decide.exe"
          class="inline-flex items-center px-3 sm:px-3.5 py-1.5 rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs font-mono font-semibold transition-all shadow-xs"
          title="Download standalone Windows desktop executable (21.4 MB)"
        >
          <span>Download App</span>
        </a>

        <!-- Figma Dark / Light Mode Toggle Pill -->
        <button
          type="button"
          onclick={() => themeManager.toggle()}
          class="inline-flex items-center px-3 sm:px-3.5 py-1.5 rounded-full border border-black dark:border-[#383838] bg-[#f7f7f5] dark:bg-[#1c1c1c] hover:bg-neutral-200 dark:hover:bg-[#252525] text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs"
          title="Toggle light or dark theme"
        >
        {#if themeManager.current === 'light'}
          <Sun/>
        
        {/if}
        {#if themeManager.current === 'dark'}
          <Moon/>
        {/if}
        </button>
      </div>
    </div>
  </header>

  <!-- Main View Area -->
  <div class="flex-1 flex flex-col">

    {#if currentSummary && currentRows.length > 0}
      <ResultsDashboard
        summary={currentSummary}
        rows={currentRows}
        charts={currentCharts}
        onReset={handleReset}
      />
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <Dropzone onDataParsed={handleDataParsed} />
      </div>
    {/if}
  </div>
</main>
