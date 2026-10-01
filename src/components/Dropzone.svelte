<script lang="ts">
  import { parseDataFile, type ParseResult } from '../lib/parser';
  import { SAMPLE_DATASETS, type SampleDatasetInfo } from '../lib/sample-datasets';
  import { db } from '../lib/db';
  import {
    UploadCloud,
    FileSpreadsheet,
    FileText,
    Sparkles,
    ShieldCheck,
    AlertCircle,
    Loader2,
    Users,
    TrendingUp,
    ShoppingBag,
    ArrowRight
  } from '@lucide/svelte';

  let { onDataParsed } = $props<{ onDataParsed: (result: ParseResult) => void }>();

  let isDragging = $state(false);
  let isParsing = $state(false);
  let statusMessage = $state('');
  let errorMessage = $state('');

  async function handleFileSelect(file: File) {
    if (!file) return;

    isParsing = true;
    errorMessage = '';
    statusMessage = `Reading and parsing ${file.name}...`;

    try {
      const result = await parseDataFile(file);
      statusMessage = `Persisting ${result.rows.length.toLocaleString()} rows into client IndexedDB...`;
      await db.saveDataset(result.summary, result.rows, result.charts);

      statusMessage = 'Finalizing charts and domain heuristics...';
      onDataParsed(result);
    } catch (err: any) {
      console.error('File parsing error:', err);
      errorMessage = err?.message || 'Failed to parse file. Please verify it is a valid CSV or Excel file.';
    } finally {
      isParsing = false;
      statusMessage = '';
    }
  }

  function onFileInputChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      handleFileSelect(input.files[0]);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      handleFileSelect(event.dataTransfer.files[0]);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragging = false;
  }

  async function loadSample(sample: SampleDatasetInfo) {
    isParsing = true;
    errorMessage = '';
    statusMessage = `Generating synthetic ${sample.name} (${sample.domain})...`;

    try {
      const rows = sample.generateRows();
      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(','),
        ...rows.map(r => headers.map(h => {
          const val = r[h];
          return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
        }).join(','))
      ];
      const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
      const file = new File([blob], sample.filename, { type: 'text/csv' });

      await handleFileSelect(file);
    } catch (err: any) {
      errorMessage = err?.message || 'Error generating sample dataset.';
      isParsing = false;
    }
  }

  // Figma Pastel Themes for sample datasets (Light & Dark)
  function getSampleTheme(domain: string) {
    if (domain === 'HR') return 'bg-[#dceeb1] dark:bg-[#1e2d14] dark:border-[#3c5427]'; // Lime
    if (domain === 'Sales') return 'bg-[#c5b0f4] dark:bg-[#251b3d] dark:border-[#4d377b]'; // Lilac
    return 'bg-[#f3c9b6] dark:bg-[#381f17] dark:border-[#733e2c]'; // Coral
  }
</script>

<div class="w-full max-w-5xl mx-auto px-6 py-12 md:py-16">
  <!-- Figma Signature Magenta Promo Accent -->
  <div class="flex justify-center mb-6">
    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ff3d8b] text-white text-[12px] font-medium shadow-sm">
      <ShieldCheck class="w-4 h-4" />
      <span>100% Client-Side Privacy &bull; Zero Server Network Calls</span>
    </div>
  </div>

  <!-- Editorial Headline in Figma Typography Scale -->
  <div class="text-center max-w-3xl mx-auto mb-12">
    <h1 class="text-[44px] sm:text-[64px] md:text-[76px] font-normal leading-[1.0] tracking-[-1.5px] text-black dark:text-white">
      Decide with data.
    </h1>
    <p class="mt-5 text-[18px] sm:text-[22px] font-light text-neutral-600 dark:text-neutral-400 leading-snug tracking-[-0.26px]">
      Upload your spreadsheets. We ingest them locally, auto-build visual distributions, and trigger non-autoregressive decision models in your browser.
    </p>
  </div>

  <!-- Pastel Dropzone Block (Figma Mint Canvas - Adapted for Light & Dark) -->
  <label
    for="file-upload"
    ondragover={handleDragOver}
    ondragleave={handleDragLeave}
    ondrop={handleDrop}
    class="w-full relative flex flex-col items-center justify-center p-12 md:p-16 rounded-[24px] cursor-pointer transition-all duration-200 border-2 border-dashed
      {isDragging
        ? 'bg-[#bfe0c5] dark:bg-[#233d28] border-black dark:border-white scale-[1.01]'
        : 'bg-[#c8e6cd] dark:bg-[#18291d] border-black/40 dark:border-[#528f5c]/50 hover:border-black dark:hover:border-[#7bc888]'}"
  >
    <input
      id="file-upload"
      type="file"
      accept=".csv,.xlsx,.xls,.tsv,.txt"
      class="hidden"
      onchange={onFileInputChange}
      disabled={isParsing}
    />

    {#if isParsing}
      <div class="flex flex-col items-center gap-4 text-black dark:text-white">
        <Loader2 class="w-10 h-10 animate-spin text-black dark:text-white" />
        <p class="text-lg font-medium tracking-tight">{statusMessage || 'Processing dataset...'}</p>
        <span class="text-xs font-mono text-neutral-700 dark:text-neutral-300">Executing client-side parser & IndexedDB storage...</span>
      </div>
    {:else}
      <div class="flex flex-col items-center text-center text-black dark:text-white">
        <div class="w-16 h-16 rounded-full bg-white dark:bg-[#111111] border border-black dark:border-[#444444] flex items-center justify-center mb-5 shadow-sm">
          <UploadCloud class="w-8 h-8 text-black dark:text-white" />
        </div>
        <p class="text-[20px] md:text-[24px] font-medium tracking-tight text-black dark:text-white">
          Drop your dataset here, or <span class="underline decoration-black dark:decoration-white underline-offset-4 font-semibold">browse</span>
        </p>
        <p class="text-sm text-neutral-700 dark:text-neutral-300 mt-2 max-w-md">
          Supports Excel (.xlsx, .xls) and CSV / TSV files up to 10,000+ rows.
        </p>

        <!-- Figma Pill Badges -->
        <div class="flex items-center gap-2 mt-6">
          <span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#121212] text-black dark:text-white border border-black dark:border-[#444444] text-xs font-mono font-medium">
            <FileSpreadsheet class="w-3.5 h-3.5" /> .XLSX / .XLS
          </span>
          <span class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#121212] text-black dark:text-white border border-black dark:border-[#444444] text-xs font-mono font-medium">
            <FileText class="w-3.5 h-3.5" /> .CSV / .TSV
          </span>
        </div>
      </div>
    {/if}
  </label>

  <!-- Error Alert -->
  {#if errorMessage}
    <div class="w-full mt-6 flex items-center gap-3 p-4 rounded-[16px] bg-[#efd4d4] dark:bg-[#3d1f1f] border border-black dark:border-rose-500 text-black dark:text-white text-xs font-medium">
      <AlertCircle class="w-4 h-4 shrink-0 text-black dark:text-rose-400" />
      <span>{errorMessage}</span>
    </div>
  {/if}

  <!-- 1-Click Sample Datasets (Figma Pastel Blocks) -->
  <div class="w-full mt-16 pt-10 border-t border-[#e6e6e6] dark:border-[#222222]">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2">
        <Sparkles class="w-4 h-4 text-black dark:text-white" />
        <h2 class="text-xs font-mono uppercase tracking-wider font-bold text-black dark:text-white">
          Quick Start with Sample Datasets
        </h2>
      </div>
      <span class="text-xs font-mono text-neutral-500 dark:text-neutral-400">1,000+ rows each</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
      {#each SAMPLE_DATASETS as sample}
        <div
          class="flex flex-col justify-between p-7 rounded-[24px] border transition-all duration-200 {getSampleTheme(sample.domain)}"
        >
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs font-mono uppercase tracking-wider font-semibold text-neutral-800 dark:text-neutral-200">
                {sample.domain} Playbook
              </span>
              {#if sample.domain === 'HR'}
                <Users class="w-4 h-4 text-black dark:text-white" />
              {:else if sample.domain === 'Sales'}
                <TrendingUp class="w-4 h-4 text-black dark:text-white" />
              {:else}
                <ShoppingBag class="w-4 h-4 text-black dark:text-white" />
              {/if}
            </div>
            <h3 class="text-[20px] font-medium leading-tight text-black dark:text-white tracking-tight">
              {sample.name}
            </h3>
            <p class="text-xs text-neutral-700 dark:text-neutral-300 mt-2.5 leading-relaxed">
              {sample.description}
            </p>
          </div>

          <!-- Figma Pill Button (Dark Mode Inverting) -->
          <div class="mt-6 pt-4 border-t border-black/10 dark:border-white/10">
            <button
              type="button"
              onclick={() => loadSample(sample)}
              disabled={isParsing}
              class="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              <span>Load {sample.domain} Demo</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
