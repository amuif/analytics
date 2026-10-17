<script lang="ts">
  import { onMount } from 'svelte';
  import Dropzone from './components/Dropzone.svelte';
  import Logo from './components/Logo.svelte';
  import { db } from './lib/db';
  import { themeManager } from './lib/theme.svelte';
  import type { DatasetSummary, ChartDefinition } from './types';
  import type { ParseResult } from './lib/parser';
  import { Moon, Sun } from 'lucide-svelte';

  // The dashboard pulls in ECharts, so load it only once there is data to show.
  const loadDashboard = () => import('./components/ResultsDashboard.svelte');

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

<main class="min-h-[100dvh] flex flex-col bg-[#fafafa] dark:bg-[#0c0c0e] text-[#18181b] dark:text-[#f4f4f5] font-sans antialiased transition-colors duration-200">
  <!-- Minimalist Header adhering to Taste Standard -->
  <header class="border-b border-neutral-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#121214]/80 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
    <div class="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Decide Brand Mark -->
        <Logo size={28} />
        <div class="flex items-center gap-2">
          <a href="/" class="text-sm sm:text-base font-semibold tracking-tight text-[#18181b] dark:text-[#f4f4f5]">Decide</a>
          <span class="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/10">
            v1.0
          </span>
        </div>

      </div>

      <!-- Header Action Controls -->
      <div class="flex items-center gap-2.5 sm:gap-3">
        <!-- Dark / Light Mode Toggle Pill -->
        <button
          type="button"
          onclick={() => themeManager.toggle()}
          class="w-9 h-9 rounded-full border border-neutral-200/90 dark:border-white/10 bg-neutral-100/80 dark:bg-[#18181b] hover:bg-neutral-200/80 dark:hover:bg-[#252528] text-neutral-700 dark:text-neutral-300 flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-[0.95]"
          title="Toggle light or dark theme"
        >
          {#if themeManager.current === 'light'}
            <Sun size={16} strokeWidth={1.75} />
          {:else}
            <Moon size={16} strokeWidth={1.75} />
          {/if}
        </button>
      </div>
    </div>
  </header>

  <!-- Main View Area -->
  <div class="flex-1 flex flex-col">
    {#if currentSummary && currentRows.length > 0}
      {#await loadDashboard() then { default: ResultsDashboard }}
        <ResultsDashboard
          summary={currentSummary}
          rows={currentRows}
          charts={currentCharts}
          onReset={handleReset}
        />
      {:catch}
        <div class="flex-1 flex items-center justify-center text-sm text-neutral-500">
          Could not load the dashboard. Please refresh the page.
        </div>
      {/await}
    {:else}
      <div class="flex-1 flex items-center justify-center">
        <Dropzone onDataParsed={handleDataParsed} />
      </div>
    {/if}
  </div>
</main>
