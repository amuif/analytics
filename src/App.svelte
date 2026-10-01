<script lang="ts">
  import { onMount } from 'svelte';
  import Dropzone from './components/Dropzone.svelte';
  import ResultsDashboard from './components/ResultsDashboard.svelte';
  import { db } from './lib/db';
  import type { DatasetSummary, ChartDefinition } from './types';
  import type { ParseResult } from './lib/parser';
  import { Layers, ShieldCheck, Monitor } from '@lucide/svelte';

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

<main class="min-h-screen flex flex-col bg-white text-black font-sans antialiased">
  <!-- Figma Minimalist Header -->
  <header class="border-b border-[#e6e6e6] bg-white sticky top-0 z-40">
    <div class="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Solid Black Brand Mark -->
        <div class="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white">
          <Layers class="w-4 h-4" />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-base font-semibold tracking-tight text-black">Laya Studio</span>
          <span class="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#f7f7f5] text-neutral-800 border border-[#e6e6e6]">
            v1.0
          </span>
        </div>
      </div>

      <!-- Header Badges (Pills) -->
      <div class="flex items-center gap-3">
        <div class="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#dceeb1] text-black text-xs font-mono font-medium">
          <ShieldCheck class="w-3.5 h-3.5 text-black" />
          <span>Air-Gapped Client</span>
        </div>
        <div class="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-black text-black text-xs font-mono font-medium">
          <Monitor class="w-3.5 h-3.5" />
          <span>Desktop & Web</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Main View Area -->
  <div class="flex-1 flex flex-col">
    {#if isRestoring}
      <div class="flex-1 flex flex-col items-center justify-center p-12">
        <div class="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin mb-4"></div>
        <p class="text-xs font-mono text-neutral-500">Restoring client database & decision head...</p>
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
  <footer class="border-t border-[#e6e6e6] py-5 px-6 bg-white text-xs text-neutral-500">
    <div class="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-4">
      <span class="font-normal text-neutral-600">Laya Open-Source Decision Model &bull; Non-Autoregressive System 1 Inference</span>
      <span class="font-mono text-[11px] text-neutral-400">Zero Server Calls &bull; Client-Owned Data</span>
    </div>
  </footer>
</main>
