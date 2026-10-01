<script lang="ts">
  import { onMount } from 'svelte';
  import Dropzone from './components/Dropzone.svelte';
  import ResultsDashboard from './components/ResultsDashboard.svelte';
  import { db } from './lib/db';
  import { themeManager } from './lib/theme.svelte';
  import type { DatasetSummary, ChartDefinition } from './types';
  import type { ParseResult } from './lib/parser';
  import { Layers, ShieldCheck, Monitor, Sun, Moon } from '@lucide/svelte';

  let currentSummary = $state<DatasetSummary | null>(null);
  let currentRows = $state<Record<string, any>[]>([]);
  let currentCharts = $state<ChartDefinition[]>([]);
  let isRestoring = $state(true);

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
    } finally {
      isRestoring = false;
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
        <!-- Solid Black / White Brand Mark -->
        <div class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black dark:bg-white flex items-center justify-center text-white dark:text-black transition-colors shrink-0">
          <Layers class="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <div class="flex items-center gap-1.5 sm:gap-2">
          <span class="text-sm sm:text-base font-semibold tracking-tight text-black dark:text-white">Laya Studio</span>
          <span class="text-[10px] sm:text-[11px] font-mono px-2 sm:px-2.5 py-0.5 rounded-full bg-[#f7f7f5] dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-300 border border-[#e6e6e6] dark:border-[#2c2c2c]">
            v1.0
          </span>
        </div>
      </div>

      <!-- Header Badges and Theme Switcher (Pills) -->
      <div class="flex items-center gap-2 sm:gap-3">
        <div class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#dceeb1] dark:bg-[#283518] text-black dark:text-[#dceeb1] text-xs font-mono font-medium border dark:border-[#405524]">
          <ShieldCheck class="w-3.5 h-3.5 text-black dark:text-[#dceeb1]" />
          <span>Air-Gapped Client</span>
        </div>

        <div class="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white dark:bg-[#181818] border border-black dark:border-[#333333] text-black dark:text-white text-xs font-mono font-medium">
          <Monitor class="w-3.5 h-3.5" />
          <span>Desktop & Web</span>
        </div>

        <!-- Figma Dark / Light Mode Toggle Pill -->
        <button
          type="button"
          onclick={() => themeManager.toggle()}
          class="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full border border-black dark:border-[#383838] bg-[#f7f7f5] dark:bg-[#1c1c1c] hover:bg-neutral-200 dark:hover:bg-[#252525] text-xs font-mono font-semibold transition-all cursor-pointer shadow-xs"
          title="Toggle light or dark theme"
        >
          {#if themeManager.current === 'dark'}
            <Sun class="w-3.5 h-3.5 text-amber-300" />
            <span class="text-white">Light</span>
          {:else}
            <Moon class="w-3.5 h-3.5 text-neutral-800" />
            <span class="text-black">Dark</span>
          {/if}
        </button>
      </div>
    </div>
  </header>

  <!-- Main View Area -->
  <div class="flex-1 flex flex-col">
    {#if isRestoring}
      <div class="flex-1 flex flex-col items-center justify-center p-8 sm:p-12">
        <div class="w-8 h-8 rounded-full border-2 border-black dark:border-white border-t-transparent animate-spin mb-4"></div>
        <p class="text-xs font-mono text-neutral-500 dark:text-neutral-400">Restoring client database & decision head...</p>
      </div>
    {:else if currentSummary && currentRows.length > 0}
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

  <!-- Editorial Footer -->
  <footer class="border-t border-[#e6e6e6] dark:border-[#222222] py-4 sm:py-5 px-4 sm:px-6 bg-white dark:bg-[#121212] text-xs text-neutral-500 dark:text-neutral-400 transition-colors">
    <div class="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 text-center sm:text-left">
      <span class="font-normal text-neutral-600 dark:text-neutral-300">Laya Open-Source Decision Model &bull; Non-Autoregressive System 1 Inference</span>
      <span class="font-mono text-[10px] sm:text-[11px] text-neutral-400 dark:text-neutral-500">Zero Server Calls &bull; Client-Owned Data</span>
    </div>
  </footer>
</main>
