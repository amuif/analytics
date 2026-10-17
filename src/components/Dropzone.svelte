<script lang="ts">
  import { parseDataFile, MAX_FILE_SIZE_MB, type ParseResult } from '../lib/parser';
  import { SAMPLE_DATASETS, type SampleDatasetInfo } from '../lib/sample-datasets';
  import { db } from '../lib/db';

  let { onDataParsed } = $props<{ onDataParsed: (result: ParseResult) => void }>();

  let isDragging = $state(false);
  let isParsing = $state(false);
  let statusMessage = $state('');
  let currentStep = $state(1);
  let errorMessage = $state('');
  let activePlaybookIndex = $state(0);

  const activePlaybook = $derived(SAMPLE_DATASETS[activePlaybookIndex] || SAMPLE_DATASETS[0]);
  const activeBadge = $derived(getPlaybookBadge(activePlaybookIndex));

  async function handleFileSelect(file: File) {
    if (!file) return;

    isParsing = true;
    errorMessage = '';
    currentStep = 1;
    statusMessage = `Reading binary stream from ${file.name}...`;

    try {
      await new Promise(r => setTimeout(r, 120));
      currentStep = 2;
      statusMessage = `Parsing rows & normalizing dimensional schemas...`;

      const result = await parseDataFile(file);

      currentStep = 3;
      statusMessage = `Computing distribution quantiles & domain heuristics...`;
      await new Promise(r => setTimeout(r, 150));

      currentStep = 4;
      statusMessage = `Persisting ${result.rows.length.toLocaleString()} rows into client IndexedDB...`;
      await db.saveDataset(result.summary, result.rows, result.charts);

      await new Promise(r => setTimeout(r, 120));
      onDataParsed(result);
    } catch (err: any) {
      console.error('File parsing error:', err);
      errorMessage = err?.message || 'Failed to parse file. Please verify it is a valid CSV or Excel file.';
    } finally {
      isParsing = false;
      statusMessage = '';
      currentStep = 1;
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
    currentStep = 1;
    statusMessage = `Synthesizing ${sample.name} benchmark (${sample.domain})...`;

    try {
      await new Promise(r => setTimeout(r, 100));
      currentStep = 2;
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

  function getPlaybookBadge(index: number) {
    if (index === 0) {
      return {
        label: 'Restock Triage',
        tag: 'Inventory Restock',
        bg: 'bg-[#c8e6cd] dark:bg-[#18291d]',
        text: 'text-[#1d3d23] dark:text-[#a3e4ae]',
        border: 'border-[#a8d9af] dark:border-[#2a4e32]'
      };
    }
    if (index === 1) {
      return {
        label: 'Clearance & Dead Stock',
        tag: 'Overstock & Aging',
        bg: 'bg-[#f3c9b6] dark:bg-[#381f17]',
        text: 'text-[#4a2215] dark:text-[#f8bda3]',
        border: 'border-[#e8ab92] dark:border-[#52291d]'
      };
    }
    return {
      label: 'ABC Stratification',
      tag: 'Capital & Pareto Tiers',
      bg: 'bg-[#c5b0f4] dark:bg-[#251b3d]',
      text: 'text-[#351b66] dark:text-[#d7cbfa]',
      border: 'border-[#ab8ff0] dark:border-[#452e72]'
    };
  }
</script>

<div class="w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
  <!-- ========================================== -->
  <!-- 01. ASYMMETRIC SPLIT HERO SECTION          -->
  <!-- ========================================== -->
  <section class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
    
    <!-- LEFT COLUMN: Editorial & Value Proposition (Span 7) -->
    <div class="lg:col-span-7 flex flex-col justify-center">
      
      <!-- Eyebrow Badge (Concentric Pill with Pulsing Live Status) -->
      <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200/90 dark:border-white/10 text-xs font-mono text-neutral-800 dark:text-neutral-200 w-fit mb-5 shadow-xs">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span class="font-semibold tracking-tight">LOCAL-FIRST RUNTIME</span>
        <span class="text-neutral-300 dark:text-neutral-600">•</span>
        <span class="text-neutral-500 dark:text-neutral-400">100% PRIVATE</span>
        <span class="text-neutral-300 dark:text-neutral-600">•</span>
        <span class="text-neutral-500 dark:text-neutral-400">ZERO EGRESS</span>
      </div>

      <!-- Main Editorial Headline (Track-Tight Scale Hierarchy) -->
      <h1 class="text-4xl sm:text-5xl lg:text-[62px] font-semibold leading-[1.05] tracking-[-0.035em] text-[#18181b] dark:text-[#f4f4f5]">
        Decide with data.
        <span class="block font-normal text-neutral-500 dark:text-neutral-400 mt-2 text-2xl sm:text-3xl lg:text-[42px] leading-tight">
          Instant decision models, right in your browser.
        </span>
      </h1>

      <!-- Functional Body Description (65ch Max Width) -->
      <p class="mt-5 text-base sm:text-lg text-[#71717a] dark:text-[#a1a1aa] leading-relaxed max-w-[62ch]">
        Drop your inventory logs, sales velocity matrices, or workforce metrics. Decide normalizes schema headers, computes distribution curves, and applies statistical heuristics — with zero cloud network calls.
      </p>

      <!-- Hardware & Performance Telemetry Ribbon -->
      <div class="mt-8 grid grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/80 dark:border-white/[0.08] max-w-xl">
        <div class="flex flex-col">
          <span class="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Latency</span>
          <span class="text-lg sm:text-xl font-bold font-mono text-[#18181b] dark:text-[#f4f4f5] mt-0.5">0 ms</span>
          <span class="text-[11px] text-neutral-500 dark:text-neutral-400">Air-gapped compute</span>
        </div>
        <div class="flex flex-col border-l border-neutral-200 dark:border-white/10 pl-3 sm:pl-4">
          <span class="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Capacity</span>
          <span class="text-lg sm:text-xl font-bold font-mono text-[#18181b] dark:text-[#f4f4f5] mt-0.5">100k+</span>
          <span class="text-[11px] text-neutral-500 dark:text-neutral-400">Rows in WebWorker</span>
        </div>
        <div class="flex flex-col border-l border-neutral-200 dark:border-white/10 pl-3 sm:pl-4">
          <span class="text-xs font-mono text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Storage</span>
          <span class="text-lg sm:text-xl font-bold font-mono text-[#18181b] dark:text-[#f4f4f5] mt-0.5">IndexedDB</span>
          <span class="text-[11px] text-neutral-500 dark:text-neutral-400">Client-persisted</span>
        </div>
      </div>

      <!-- Quick Playbook Shortcuts (Tactile nested pill triggers) -->
      <div class="mt-8">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-xs font-mono font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Quick Load Inventory Playbook:
          </span>
        </div>
        <div class="flex flex-wrap gap-2.5">
          {#each SAMPLE_DATASETS as sample, idx}
            {@const badge = getPlaybookBadge(idx)}
            <button
              type="button"
              onclick={() => loadSample(sample)}
              disabled={isParsing}
              class="group inline-flex items-center gap-2 pl-3.5 pr-2 py-2 rounded-full border border-neutral-200/90 dark:border-white/10 bg-white dark:bg-[#18181b] hover:border-neutral-400 dark:hover:border-neutral-600 text-xs font-medium text-[#18181b] dark:text-[#f4f4f5] transition-all duration-150 active:scale-[0.98] shadow-xs cursor-pointer disabled:opacity-50"
            >
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold {badge.bg} {badge.text} border {badge.border}">
                {badge.label}
              </span>
              <span class="font-sans font-medium">{sample.name.split('&')[0].trim()}</span>
              <span class="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 dark:text-neutral-400 group-hover:bg-[#18181b] group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-black transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7"></line>
                  <polyline points="7 7 17 7 17 17"></polyline>
                </svg>
              </span>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- RIGHT COLUMN: Double-Bezel Tactile Dropzone (Span 5) -->
    <div class="lg:col-span-5 flex flex-col justify-center">
      
      <!-- Double-Bezel Machined Outer Enclosure -->
      <div class="relative w-full rounded-[2.5rem] p-2.5 sm:p-3 bg-neutral-200/40 dark:bg-white/[0.04] border border-neutral-300/80 dark:border-white/[0.08] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.06)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-200">
        
        <!-- Double-Bezel Inner Core Interactive Box -->
        <label
          for="file-upload"
          ondragover={handleDragOver}
          ondragleave={handleDragLeave}
          ondrop={handleDrop}
          class="w-full relative flex flex-col items-center justify-center min-h-[380px] sm:min-h-[420px] p-6 sm:p-8 rounded-[calc(2.5rem-0.75rem)] cursor-pointer transition-all duration-200 border-2 border-dashed
            {isDragging
              ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-500 dark:border-blue-400 scale-[0.99]'
              : 'bg-white dark:bg-[#141417] border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600'}"
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
            <!-- High-End Skeletal Shimmer & Progress Telemetry (No circular spinner) -->
            <div class="w-full max-w-sm flex flex-col items-center text-center p-4">
              <!-- Active Step Pulsing Graphic -->
              <div class="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="animate-pulse">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>

              <!-- Live Status Message -->
              <h3 class="text-base font-semibold text-[#18181b] dark:text-[#f4f4f5] tracking-tight">
                {statusMessage || 'Processing dataset...'}
              </h3>
              <p class="text-xs font-mono text-neutral-500 dark:text-neutral-400 mt-1">
                Executing client-side worker pipeline
              </p>

              <!-- Skeletal Shimmer Telemetry Bar -->
              <div class="w-full mt-6 h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden relative border border-neutral-200/60 dark:border-white/10">
                <div class="absolute inset-0 bg-blue-500 animate-taste-shimmer rounded-full"></div>
              </div>

              <!-- Multi-Stage Pipeline Checklist -->
              <div class="w-full mt-6 space-y-2 text-left">
                <div class="flex items-center justify-between text-xs font-mono py-1 border-b border-neutral-100 dark:border-white/[0.04]">
                  <span class="text-neutral-500 dark:text-neutral-400">1. Buffer Ingestion</span>
                  <span class={currentStep >= 1 ? 'text-emerald-500 font-bold' : 'text-neutral-400'}>
                    {currentStep > 1 ? 'DONE' : currentStep === 1 ? 'RUNNING' : 'QUEUED'}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs font-mono py-1 border-b border-neutral-100 dark:border-white/[0.04]">
                  <span class="text-neutral-500 dark:text-neutral-400">2. Normalization & Profiling</span>
                  <span class={currentStep >= 2 ? 'text-emerald-500 font-bold' : 'text-neutral-400'}>
                    {currentStep > 2 ? 'DONE' : currentStep === 2 ? 'RUNNING' : 'QUEUED'}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs font-mono py-1 border-b border-neutral-100 dark:border-white/[0.04]">
                  <span class="text-neutral-500 dark:text-neutral-400">3. Distribution & IQR Heuristics</span>
                  <span class={currentStep >= 3 ? 'text-emerald-500 font-bold' : 'text-neutral-400'}>
                    {currentStep > 3 ? 'DONE' : currentStep === 3 ? 'RUNNING' : 'QUEUED'}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs font-mono py-1">
                  <span class="text-neutral-500 dark:text-neutral-400">4. IndexedDB Client Sync</span>
                  <span class={currentStep >= 4 ? 'text-emerald-500 font-bold' : 'text-neutral-400'}>
                    {currentStep >= 4 ? 'SYNCING' : 'QUEUED'}
                  </span>
                </div>
              </div>
            </div>

          {:else}
            <!-- Idle Upload Zone Architecture -->
            <div class="flex flex-col items-center text-center">
              
              <!-- Machined Hardware Deposit Icon -->
              <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200/90 dark:border-white/10 flex items-center justify-center text-neutral-700 dark:text-neutral-300 mb-5 shadow-xs transition-transform duration-200 group-hover:scale-105">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-[#18181b] dark:text-[#f4f4f5]">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>

              <!-- Main Drop Callout -->
              <h2 class="text-xl sm:text-2xl font-semibold tracking-tight text-[#18181b] dark:text-[#f4f4f5]">
                Drop your spreadsheet here
              </h2>
              <p class="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2 max-w-xs leading-relaxed">
                Drag and drop your file into this box, or choose a file from your hard drive.
              </p>

              <!-- Tactile Button-in-Button Action Pill -->
              <div class="mt-6">
                <div class="inline-flex items-center gap-2 pl-5 pr-2 py-2.5 rounded-full bg-[#18181b] dark:bg-white text-white dark:text-black font-semibold text-xs transition-all duration-150 active:scale-[0.98] shadow-sm hover:bg-neutral-800 dark:hover:bg-neutral-200">
                  <span>Browse Local File</span>
                  <span class="w-6 h-6 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14"></path>
                      <path d="m12 5 7 7-7 7"></path>
                    </svg>
                  </span>
                </div>
              </div>

              <!-- Supported Formats Badges -->
              <div class="flex items-center gap-1.5 mt-6">
                <span class="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-[10px] font-mono text-neutral-600 dark:text-neutral-400">.XLSX</span>
                <span class="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-[10px] font-mono text-neutral-600 dark:text-neutral-400">.CSV</span>
                <span class="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-[10px] font-mono text-neutral-600 dark:text-neutral-400">.TSV</span>
                <span class="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-[10px] font-mono text-neutral-600 dark:text-neutral-400">.XLS</span>
                <span class="text-[10px] font-mono text-neutral-500 dark:text-neutral-500">up to {MAX_FILE_SIZE_MB} MB</span>
              </div>

              <!-- Air-gap guarantee badge -->
              <div class="mt-4 flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 dark:text-neutral-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-emerald-500">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path>
                </svg>
                <span>Zero bytes sent over network</span>
              </div>
            </div>
          {/if}
        </label>
      </div>

      <!-- Contextual Error Callout Banner -->
      {#if errorMessage}
        <div class="w-full mt-4 flex items-start gap-3 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-[#18181b] dark:text-[#f4f4f5]">
          <div class="w-5 h-5 rounded-full bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div class="flex-1 text-xs">
            <span class="font-mono font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 block mb-0.5">Parsing Failed</span>
            <span class="text-neutral-700 dark:text-neutral-300 leading-relaxed">{errorMessage}</span>
          </div>
        </div>
      {/if}
    </div>
  </section>

  <!-- ========================================== -->
  <!-- 02. ASYMMETRICAL BENTO PLAYBOOK EXPLORER   -->
  <!-- ========================================== -->
  <section class="mt-16 sm:mt-24 pt-12 border-t border-neutral-200/80 dark:border-white/[0.08]">
    
    <!-- Section Eyebrow Header -->
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div>
        <div class="text-xs font-mono uppercase tracking-[0.2em] font-semibold text-neutral-400 dark:text-neutral-500 mb-1.5">
          LAYER 02 • PRE-BUILT PLAYBOOKS & ARCHITECTURE
        </div>
        <h2 class="text-2xl sm:text-3xl font-semibold tracking-tight text-[#18181b] dark:text-[#f4f4f5]">
          Explore synthetic industry benchmarks
        </h2>
      </div>
      <div class="text-xs font-mono text-neutral-500 dark:text-neutral-400">
        1,000+ rows each &bull; Instantly simulated
      </div>
    </div>

    <!-- Asymmetric Bento Grid (Col 7 / Col 5 / Col 12) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
      
      <!-- Bento Tile 1: Interactive Playbook Spotlight (Col 7) -->
      <div class="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-[2rem] bg-white dark:bg-[#141417] border border-neutral-200/90 dark:border-white/[0.08] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.04)]">
        <div>
          <!-- Tabbed Domain Selector Pills -->
          <div class="flex flex-wrap gap-2 mb-6">
            {#each SAMPLE_DATASETS as sample, idx}
              {@const isSelected = activePlaybookIndex === idx}
              <button
                type="button"
                onclick={() => activePlaybookIndex = idx}
                class="px-3.5 py-1.5 rounded-full text-xs font-mono font-medium transition-all duration-150 cursor-pointer
                  {isSelected
                    ? 'bg-[#18181b] dark:bg-white text-white dark:text-black shadow-xs'
                    : 'bg-neutral-100 dark:bg-white/[0.05] text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white'}"
              >
                {getPlaybookBadge(idx).label}
              </button>
            {/each}
          </div>

          <!-- Active Playbook Details Card -->
          <div class="flex items-center gap-2 mb-3">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold {activeBadge.bg} {activeBadge.text} border {activeBadge.border}">
              {activeBadge.tag}
            </span>
            <span class="text-xs font-mono text-neutral-400 dark:text-neutral-500">&bull; {activePlaybook.filename}</span>
          </div>

          <h3 class="text-xl sm:text-2xl font-semibold text-[#18181b] dark:text-[#f4f4f5] tracking-tight">
            {activePlaybook.name}
          </h3>

          <p class="mt-3 text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-xl">
            {activePlaybook.description}
          </p>

          <!-- Heuristic Capabilities Chips -->
          <div class="mt-6 pt-5 border-t border-neutral-100 dark:border-white/[0.06] flex flex-wrap gap-2">
            {#if activePlaybookIndex === 0}
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Stockout Risk Scoring</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Holding Cost vs Turnover</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Safety Stock Quantiles</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Supplier Lead Time Buffer</span>
            {:else if activePlaybookIndex === 1}
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Dead Stock Liquidation (60% Off)</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Clearance Markdown Urgency</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Tied Working Capital Release</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Days Dormant Thresholds</span>
            {:else}
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Pareto 80/20 ABC Classification</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Class A Capital Driver Controls</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Annual Consumption Value</span>
              <span class="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] text-[11px] font-mono text-neutral-700 dark:text-neutral-300">Annual Carrying Cost Exposure</span>
            {/if}
          </div>
        </div>

        <!-- Launch Button with Button-in-Button Trailing Arrow -->
        <div class="mt-8 pt-6 border-t border-neutral-100 dark:border-white/[0.06] flex items-center justify-between">
          <div class="text-xs font-mono text-neutral-500 dark:text-neutral-400">
            Synthesizes ~1,200 inventory rows in client memory
          </div>
          <button
            type="button"
            onclick={() => loadSample(activePlaybook)}
            disabled={isParsing}
            class="inline-flex items-center gap-2.5 pl-5 pr-2 py-2.5 rounded-full bg-[#18181b] dark:bg-white text-white dark:text-black font-semibold text-xs transition-all duration-150 active:scale-[0.98] shadow-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 cursor-pointer disabled:opacity-50"
          >
            <span>Launch {activeBadge.label} Demo</span>
            <span class="w-6 h-6 rounded-full bg-white/20 dark:bg-black/10 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </span>
          </button>
        </div>
      </div>

      <!-- Bento Tile 2: Air-Gapped Privacy Architecture (Col 5) -->
      <div class="lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-[2rem] bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/90 dark:border-white/[0.08] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.04)]">
        <div>
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
          </div>

          <h3 class="text-xl font-semibold text-[#18181b] dark:text-[#f4f4f5] tracking-tight">
            Air-Gapped Client Security
          </h3>
          <p class="mt-2.5 text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Enterprise analytics often expose proprietary financial and payroll data to external cloud APIs. Decide executes 100% inside your local machine.
          </p>

          <div class="mt-6 space-y-3.5">
            <div class="flex items-start gap-3">
              <span class="w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-700 dark:text-neutral-300">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <div>
                <span class="text-xs font-semibold text-[#18181b] dark:text-[#f4f4f5] block">Zero Server Network Egress</span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">No telemetry or payload packets leave your browser sandbox.</span>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <span class="w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-700 dark:text-neutral-300">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <div>
                <span class="text-xs font-semibold text-[#18181b] dark:text-[#f4f4f5] block">Encrypted IndexedDB Persistence</span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">Datasets remain saved locally across page reloads without cloud databases.</span>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <span class="w-5 h-5 rounded-full bg-neutral-200/70 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-neutral-700 dark:text-neutral-300">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </span>
              <div>
                <span class="text-xs font-semibold text-[#18181b] dark:text-[#f4f4f5] block">Zero Installation Required</span>
                <span class="text-[11px] text-neutral-500 dark:text-neutral-400">Pure web architecture running entirely in modern browsers via Web Workers and WASM.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="mt-8 pt-5 border-t border-neutral-200 dark:border-white/[0.08] flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 font-mono">
          <span class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            100% Client-Side Web Architecture
          </span>
          <span class="text-[11px]">No installation needed</span>
        </div>
      </div>

      <!-- Bento Tile 3: Full-Width Capabilities Ribbon (Col 12) -->
      <div class="lg:col-span-12 p-6 sm:p-8 rounded-[2rem] bg-white dark:bg-[#141417] border border-neutral-200/90 dark:border-white/[0.08] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.04)]">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
              <span class="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>HEURISTIC INFERENCE</span>
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Auto-detects semantic schemas (SKUs, currency, dates, velocity) without manual schema mapping.
            </p>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>STATISTICAL DISTRIBUTIONS</span>
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Evaluates Pareto 80/20 curves, continuous quantiles, and IQR anomaly thresholds automatically.
            </p>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
              <span class="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>TRIAGE STRESS METER</span>
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Identifies critical operational anomalies, runaway holding costs, or pipeline stalls in real-time.
            </p>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2 text-xs font-mono font-semibold text-neutral-800 dark:text-neutral-200 mb-1.5">
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>MULTI-FORMAT INGESTION</span>
            </div>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Supports `.xlsx`, `.xls`, `.csv`, `.tsv` workbooks with multiple sheets and dirty headers.
            </p>
          </div>

        </div>
      </div>

    </div>
  </section>
</div>
