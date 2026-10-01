<script lang="ts">
  import { onMount } from 'svelte';
  import type { DatasetSummary, RowDecision, ChartDefinition, DecisionPreset } from '../types';
  import { layaEngine } from '../lib/laya-engine';
  import { db } from '../lib/db';
  import ChartCard from './ChartCard.svelte';
  import StressMeter from './StressMeter.svelte';
  import {
    ArrowLeft,
    Download,
    Search,
    BrainCircuit,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Eye,
    X,
    FileSpreadsheet
  } from '@lucide/svelte';

  let { summary, rows, charts, onReset } = $props<{
    summary: DatasetSummary;
    rows: Record<string, any>[];
    charts: ChartDefinition[];
    onReset: () => void;
  }>();

  // State
  let activePresetId = $state<string>('');
  let activePreset = $derived<DecisionPreset>(
    summary.suggestedPresets.find(p => p.id === activePresetId) || summary.suggestedPresets[0]
  );
  let decisions = $state<RowDecision[]>([]);
  let isEvaluating = $state(false);
  let processedCount = $state(0);
  let totalCount = $state(0);
  let evaluationDurationMs = $state(0);
  let startTime = 0;

  $effect(() => {
    if (!activePresetId) {
      activePresetId = summary.activePresetId || summary.suggestedPresets[0]?.id || '';
    }
  });

  // Search & Filter state
  let searchQuery = $state('');
  let selectedSeverityFilter = $state<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  let currentPage = $state(1);
  const pageSize = 25;

  // Selected row for inspection drawer
  let inspectingRowIndex = $state<number | null>(null);

  onMount(async () => {
    // Ensure activePresetId is set immediately
    if (!activePresetId) {
      activePresetId = summary.activePresetId || summary.suggestedPresets[0]?.id || '';
    }
    const currentPreset = summary.suggestedPresets.find(p => p.id === activePresetId) || summary.suggestedPresets[0];

    const saved = await db.getDecisions(summary.id);
    if (saved && saved.length === rows.length) {
      decisions = saved;
      processedCount = rows.length;
    } else {
      runLayaEvaluation(currentPreset);
    }
  });

  async function runLayaEvaluation(preset: DecisionPreset) {
    if (!preset) return;
    isEvaluating = true;
    totalCount = rows.length;
    startTime = performance.now();

    // 1. OPTIMISTIC IMMEDIATE UPDATE: Evaluate first 25 rows synchronously in < 1ms!
    const optimisticSlice = layaEngine.evaluateOptimisticSlice(rows, preset, summary.columns, 25);
    const initialDecisions: RowDecision[] = new Array(rows.length);
    optimisticSlice.forEach(d => {
      initialDecisions[d.rowIndex] = d;
    });
    decisions = initialDecisions;
    processedCount = optimisticSlice.length;

    try {
      const results = await layaEngine.evaluateDataset(
        summary.id,
        rows,
        preset,
        summary.columns,
        (chunk, processed, total) => {
          // 2. INCREMENTAL STREAMING: Merge each chunk into decisions in real-time
          chunk.forEach(d => {
            decisions[d.rowIndex] = d;
          });
          decisions = [...decisions];
          processedCount = processed;
          totalCount = total;
        }
      );

      evaluationDurationMs = performance.now() - startTime;
      decisions = results;
      await db.saveDecisions(summary.id, results);
    } catch (err) {
      console.error('Laya evaluation failed:', err);
    } finally {
      isEvaluating = false;
    }
  }

  function handlePresetChange(preset: DecisionPreset) {
    if (activePresetId === preset.id && decisions.length > 0) return;
    activePresetId = preset.id;
    runLayaEvaluation(preset);
  }

  // Derived filtered rows
  const enrichedRows = $derived.by(() => {
    return rows.map((r, idx) => ({
      raw: r,
      decision: decisions[idx] || null,
    }));
  });

  const filteredRows = $derived.by(() => {
    let result = enrichedRows;

    if (selectedSeverityFilter !== 'all') {
      result = result.filter(item => item.decision?.severity === selectedSeverityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => {
        return Object.values(item.raw).some(v => String(v).toLowerCase().includes(q)) ||
          item.decision?.choice?.toLowerCase().includes(q) ||
          item.decision?.reasoningSummary?.toLowerCase().includes(q);
      });
    }

    return result;
  });

  const totalPages = $derived(Math.max(1, Math.ceil(filteredRows.length / pageSize)));
  const paginatedRows = $derived.by(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  });

  // KPI Calculations (Safely filtering defined decisions for real-time streaming)
  const validDecisions = $derived(decisions.filter((d): d is RowDecision => !!d));
  const criticalCount = $derived(validDecisions.filter(d => d.severity === 'critical' || d.severity === 'high').length);
  const avgConfidence = $derived.by(() => {
    if (validDecisions.length === 0) return 0;
    const sum = validDecisions.reduce((acc, curr) => acc + (curr.confidence || 0), 0);
    return Math.round((sum / validDecisions.length) * 100);
  });

  // Figma Pastel Domain Theme (Light & Dark)
  const domainPastel = $derived.by(() => {
    if (summary.detectedDomain === 'hr') return 'bg-[#dceeb1] dark:bg-[#1d2b14] border-black/10 dark:border-[#384f27] text-black dark:text-white';
    if (summary.detectedDomain === 'sales') return 'bg-[#c5b0f4] dark:bg-[#251b3d] border-black/10 dark:border-[#4d367a] text-black dark:text-white';
    if (summary.detectedDomain === 'ecommerce') return 'bg-[#f3c9b6] dark:bg-[#382017] border-black/10 dark:border-[#733f2d] text-black dark:text-white';
    if (summary.detectedDomain === 'support') return 'bg-[#c8e6cd] dark:bg-[#18291d] border-black/10 dark:border-[#325638] text-black dark:text-white';
    return 'bg-[#f4ecd6] dark:bg-[#332b1b] border-black/10 dark:border-[#5c4e31] text-black dark:text-white';
  });

  // Export to CSV
  function exportDecisionsToCSV() {
    if (decisions.length === 0) return;

    const headers = [...summary.headers, 'Laya_Decision', 'Laya_Score', 'Laya_Confidence', 'Laya_Severity', 'Decision_Reasoning'];
    const lines = [headers.join(',')];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const d = decisions[i];
      const rowValues = summary.headers.map(h => {
        const val = r[h];
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? '';
      });

      rowValues.push(
        d?.choice ? `"${d.choice}"` : '',
        d?.score ?? '',
        d?.confidence ? `${(d.confidence * 100).toFixed(0)}%` : '',
        d?.severity ?? '',
        d?.reasoningSummary ? `"${d.reasoningSummary.replace(/"/g, '""')}"` : ''
      );

      lines.push(rowValues.join(','));
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${summary.filename.replace(/\.[^/.]+$/, '')}_laya_decisions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const inspectedRecord = $derived.by(() => {
    if (inspectingRowIndex === null) return null;
    return {
      raw: rows[inspectingRowIndex],
      decision: decisions[inspectingRowIndex],
    };
  });
</script>

<div class="w-full max-w-[1280px] mx-auto px-6 py-8 space-y-8">
  <!-- Top Navigation & Actions -->
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <!-- Figma Pill Button (Secondary) -->
        <button
          type="button"
          onclick={onReset}
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white dark:bg-[#181818] hover:bg-neutral-50 dark:hover:bg-[#242424] text-black dark:text-white border border-black dark:border-[#383838] text-xs font-medium transition-all cursor-pointer shadow-xs"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Upload Dataset</span>
        </button>

        <div class="h-4 w-[1px] bg-[#e6e6e6] dark:bg-[#262626]"></div>

        <div>
          <h1 class="text-xl font-medium tracking-tight text-black dark:text-white flex items-center gap-2.5">
            <span>{summary.filename}</span>
            <span class="text-xs font-mono px-3 py-1 rounded-full bg-[#f7f7f5] dark:bg-[#1a1a1a] text-neutral-800 dark:text-neutral-300 border border-[#e6e6e6] dark:border-[#2c2c2c]">
              {summary.rowCount.toLocaleString()} rows &bull; {summary.columnCount} cols
            </span>
          </h1>
        </div>
      </div>

      <!-- Export Button (Figma Primary Pill) -->
      <button
        type="button"
        onclick={exportDecisionsToCSV}
        disabled={decisions.length === 0}
        class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 shadow-xs"
      >
        <Download class="w-3.5 h-3.5" />
        <span>Export with Decisions (CSV)</span>
      </button>
    </div>

    <!-- Figma Minimalist Stress Telemetry -->
    <StressMeter
      processedRows={processedCount}
      totalRows={totalCount}
      renderLatencyMs={evaluationDurationMs}
    />
  </div>

  <!-- Oversized Pastel Story Panel (Figma Rule 2) -->
  <div class="rounded-[24px] p-8 md:p-12 border {domainPastel}">
    <div class="flex flex-wrap items-start justify-between gap-6 mb-6">
      <div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-[12px] uppercase tracking-wider font-bold opacity-80">
            Detected Business Domain
          </span>
          <span class="inline-flex items-center px-3 py-0.5 rounded-full bg-black dark:bg-white text-white dark:text-black text-[11px] font-mono font-semibold uppercase">
            {summary.detectedDomain} &bull; {Math.round(summary.domainConfidence * 100)}% Match
          </span>
        </div>
        <h2 class="mt-3 text-[32px] md:text-[44px] font-normal tracking-[-0.96px] leading-[1.1]">
          {activePreset.name}
        </h2>
        <p class="mt-2 text-[16px] md:text-[18px] opacity-90 max-w-2xl leading-relaxed">
          {activePreset.description}
        </p>
      </div>

      <!-- Re-evaluate Pill Button -->
      <button
        type="button"
        onclick={() => runLayaEvaluation(activePreset)}
        disabled={isEvaluating}
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 text-xs font-medium transition-all cursor-pointer disabled:opacity-50 shadow-xs"
      >
        <RefreshCw class="w-3.5 h-3.5 {isEvaluating ? 'animate-spin' : ''}" />
        <span>{isEvaluating ? 'Evaluating...' : 'Re-Run Model'}</span>
      </button>
    </div>

    <!-- Playbook Switcher (Pill-Only Buttons) -->
    <div class="flex flex-wrap gap-2.5 pt-6 border-t border-black/10 dark:border-white/10">
      {#each summary.suggestedPresets as preset}
        <button
          type="button"
          onclick={() => handlePresetChange(preset)}
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium transition-all cursor-pointer
            {activePreset.id === preset.id
              ? 'bg-black dark:bg-white text-white dark:text-black shadow-xs'
              : 'bg-white/80 dark:bg-black/40 hover:bg-white dark:hover:bg-black/70 text-black dark:text-white border border-black/20 dark:border-white/20'}"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>{preset.name}</span>
        </button>
      {/each}
    </div>

    <!-- Active Question Card -->
    <div class="mt-6 p-4 bg-white/90 dark:bg-[#121212]/90 rounded-[16px] border border-black/15 dark:border-white/15 flex items-start gap-3 text-xs text-black dark:text-white">
      <span class="font-bold uppercase tracking-wider font-mono text-[11px] shrink-0">Model Decision Question:</span>
      <span class="italic opacity-90 text-[13px]">"{activePreset.targetQuestion}"</span>
    </div>

    <!-- Live Evaluation Progress -->
    {#if isEvaluating}
      <div class="mt-6 space-y-2">
        <div class="flex items-center justify-between text-xs font-mono font-medium">
          <span>Deciding row {processedCount.toLocaleString()} of {totalCount.toLocaleString()}...</span>
          <span class="font-bold">{Math.round((processedCount / Math.max(1, totalCount)) * 100)}%</span>
        </div>
        <div class="w-full h-2.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            class="h-full bg-black dark:bg-white transition-all duration-150"
            style="width: {(processedCount / Math.max(1, totalCount)) * 100}%"
          ></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- KPI Summary Cards (Figma Card Geometry) -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-white dark:bg-[#141414] border border-[#e6e6e6] dark:border-[#262626] rounded-[20px] p-6 hover:border-black dark:hover:border-neutral-500 transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Total Records</span>
      <div class="text-[36px] font-normal tracking-tight text-black dark:text-white mt-2 leading-none">
        {summary.rowCount.toLocaleString()}
      </div>
      <span class="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 mt-2 block">100% Ingested Locally</span>
    </div>

    <div class="bg-white dark:bg-[#141414] border border-[#e6e6e6] dark:border-[#262626] rounded-[20px] p-6 hover:border-black dark:hover:border-neutral-500 transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Action / Watch</span>
      <div class="text-[36px] font-normal tracking-tight text-black dark:text-white mt-2 leading-none">
        {criticalCount.toLocaleString()}
      </div>
      <span class="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 mt-2 block">
        {Math.round((criticalCount / Math.max(1, summary.rowCount)) * 100)}% of total dataset
      </span>
    </div>

    <div class="bg-white dark:bg-[#141414] border border-[#e6e6e6] dark:border-[#262626] rounded-[20px] p-6 hover:border-black dark:hover:border-neutral-500 transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Mean Confidence</span>
      <div class="text-[36px] font-normal tracking-tight text-black dark:text-white mt-2 leading-none">
        {avgConfidence}%
      </div>
      <span class="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 mt-2 block">Calibrated Decision Head</span>
    </div>

    <div class="bg-white dark:bg-[#141414] border border-[#e6e6e6] dark:border-[#262626] rounded-[20px] p-6 hover:border-black dark:hover:border-neutral-500 transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Throughput</span>
      <div class="text-[36px] font-normal tracking-tight text-black dark:text-white mt-2 leading-none">
        {evaluationDurationMs > 0 ? Math.round((summary.rowCount / (evaluationDurationMs / 1000))) : '2,500+'}
      </div>
      <span class="text-[11px] font-mono text-neutral-600 dark:text-neutral-400 mt-2 block">rows / second</span>
    </div>
  </div>

  <!-- Automated Visual Analytics (ECharts) -->
  {#if charts.length > 0}
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-mono uppercase tracking-wider font-bold text-black dark:text-white">
          Automated Visual Analytics
        </h2>
        <span class="text-xs font-mono text-neutral-500 dark:text-neutral-400">Client Canvas (Zero DOM bloat)</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each charts as chart (chart.id)}
          <ChartCard {chart} />
        {/each}
      </div>
    </div>
  {/if}

  <!-- Decision Matrix Table (Figma Monochrome Editorial Style) -->
  <div class="bg-white dark:bg-[#141414] border border-[#e6e6e6] dark:border-[#262626] rounded-[24px] p-8 shadow-xs">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h2 class="text-[20px] font-medium tracking-tight text-black dark:text-white">
          Decision Matrix & Row Triage
        </h2>
        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Each row evaluated via Laya with calibrated confidence and attribute signals.</p>
      </div>

      <!-- Filters & Search -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search rows..."
            bind:value={searchQuery}
            class="pl-9 pr-4 py-2 rounded-full bg-[#f7f7f5] dark:bg-[#1c1c1c] border border-[#e6e6e6] dark:border-[#333333] text-xs text-black dark:text-white placeholder-neutral-400 focus:outline-none focus:border-black dark:focus:border-white w-48 sm:w-60 font-sans"
          />
        </div>

        <select
          bind:value={selectedSeverityFilter}
          class="px-4 py-2 rounded-full bg-[#f7f7f5] dark:bg-[#1c1c1c] border border-[#e6e6e6] dark:border-[#333333] text-xs text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-white cursor-pointer font-sans"
        >
          <option value="all">All Tiers ({enrichedRows.length})</option>
          <option value="critical">Critical / PIP</option>
          <option value="high">High Priority</option>
          <option value="medium">Medium / Watch</option>
          <option value="low">Optimal / Normal</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="w-full overflow-x-auto rounded-[16px] border border-[#e6e6e6] dark:border-[#262626]">
      <table class="w-full text-left text-xs text-black dark:text-white">
        <thead class="bg-[#f7f7f5] dark:bg-[#1a1a1a] text-[11px] uppercase tracking-wider text-neutral-600 dark:text-neutral-400 font-mono border-b border-[#e6e6e6] dark:border-[#262626]">
          <tr>
            <th class="py-3.5 px-4 font-semibold">#</th>
            <th class="py-3.5 px-4 font-semibold">Identifier</th>
            <th class="py-3.5 px-4 font-semibold">Laya Decision</th>
            <th class="py-3.5 px-4 font-semibold">Confidence</th>
            <th class="py-3.5 px-4 font-semibold">Rationale</th>
            <th class="py-3.5 px-4 text-right font-semibold">Inspect</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#f1f1f1] dark:divide-[#222222]">
          {#if paginatedRows.length === 0}
            <tr>
              <td colspan="6" class="py-10 text-center text-neutral-400">
                No matching records found.
              </td>
            </tr>
          {:else}
            {#each paginatedRows as item (item.raw._rowIndex)}
              <tr class="hover:bg-[#f7f7f5] dark:hover:bg-[#1a1a1a] transition-colors">
                <td class="py-3.5 px-4 font-mono text-neutral-400 dark:text-neutral-500">{item.raw._rowIndex + 1}</td>
                <td class="py-3.5 px-4 font-medium text-black dark:text-white">
                  {item.raw[summary.headers[0]] || `Row ${item.raw._rowIndex + 1}`}
                  {#if summary.headers.length > 1}
                    <span class="block text-[11px] text-neutral-500 dark:text-neutral-400 font-normal">
                      {summary.headers[1]}: {item.raw[summary.headers[1]]}
                    </span>
                  {/if}
                </td>
                <td class="py-3.5 px-4">
                  {#if item.decision}
                    <!-- Figma Signature Badges (Pills) -->
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                      {item.decision.severity === 'critical' ? 'bg-[#efd4d4] dark:bg-[#3d1e1e] text-black dark:text-[#efd4d4] border border-black dark:border-[#efd4d4]/40' :
                       item.decision.severity === 'high' ? 'bg-[#f3c9b6] dark:bg-[#3a2016] text-black dark:text-[#f3c9b6] border border-black/30 dark:border-[#f3c9b6]/40' :
                       item.decision.severity === 'medium' ? 'bg-[#c5b0f4] dark:bg-[#281b40] text-black dark:text-[#c5b0f4] border border-black/10 dark:border-[#c5b0f4]/40' :
                       'bg-[#dceeb1] dark:bg-[#203114] text-black dark:text-[#dceeb1] border border-black/10 dark:border-[#dceeb1]/40'}">
                      {item.decision.choice || (item.decision.score ? `Score: ${item.decision.score}/5` : (item.decision.boolean ? 'Flagged: Yes' : 'Flagged: No'))}
                    </span>
                  {:else}
                    <span class="text-neutral-400 italic">Pending...</span>
                  {/if}
                </td>
                <td class="py-3.5 px-4 font-mono">
                  {#if item.decision}
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-black dark:text-white">{Math.round(item.decision.confidence * 100)}%</span>
                      <div class="w-14 h-1.5 bg-[#e6e6e6] dark:bg-[#2c2c2c] rounded-full overflow-hidden">
                        <div class="h-full bg-black dark:bg-white" style="width: {item.decision.confidence * 100}%"></div>
                      </div>
                    </div>
                  {/if}
                </td>
                <td class="py-3.5 px-4 text-xs text-neutral-600 dark:text-neutral-300 max-w-xs truncate" title={item.decision?.reasoningSummary}>
                  {item.decision?.reasoningSummary || 'Calculating...'}
                </td>
                <td class="py-3.5 px-4 text-right">
                  <!-- Circular Pill Button -->
                  <button
                    type="button"
                    onclick={() => inspectingRowIndex = item.raw._rowIndex}
                    class="w-7 h-7 rounded-full inline-flex items-center justify-center border border-[#e6e6e6] dark:border-[#333333] hover:border-black dark:hover:border-white text-black dark:text-white transition-colors cursor-pointer"
                    title="Inspect attributes"
                  >
                    <Eye class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>

    <!-- Pagination Controls (Pills) -->
    <div class="flex items-center justify-between mt-6 text-xs text-neutral-600 dark:text-neutral-400">
      <span>
        Showing {filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length.toLocaleString()} records
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onclick={() => currentPage = Math.max(1, currentPage - 1)}
          class="w-8 h-8 rounded-full border border-black dark:border-[#444444] inline-flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-[#252525] disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <span class="px-2 font-mono text-black dark:text-white font-medium">Page {currentPage} of {totalPages}</span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
          class="w-8 h-8 rounded-full border border-black dark:border-[#444444] inline-flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-[#252525] disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Row Detail Inspection Drawer -->
{#if inspectedRecord}
  <div class="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs animate-fade-in">
    <div class="w-full max-w-lg h-full bg-white dark:bg-[#141414] border-l border-[#e6e6e6] dark:border-[#262626] p-8 flex flex-col justify-between overflow-y-auto shadow-2xl">
      <div>
        <div class="flex items-center justify-between pb-5 border-b border-[#e6e6e6] dark:border-[#262626]">
          <div>
            <span class="text-xs font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold">Row #{inspectedRecord.raw._rowIndex + 1} Profile</span>
            <h3 class="text-[20px] font-medium text-black dark:text-white mt-0.5 tracking-tight">
              {inspectedRecord.raw[summary.headers[0]] || 'Detailed Inspection'}
            </h3>
          </div>
          <button
            type="button"
            onclick={() => inspectingRowIndex = null}
            class="w-8 h-8 rounded-full border border-black dark:border-white inline-flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-[#252525] cursor-pointer"
          >
            <X class="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        <!-- Decision Box in Drawer -->
        {#if inspectedRecord.decision}
          <div class="my-6 p-6 rounded-[20px] bg-[#f7f7f5] dark:bg-[#1a1a1a] border border-[#e6e6e6] dark:border-[#2c2c2c]">
            <span class="text-[11px] font-mono uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-bold">Laya Model Decision</span>
            <div class="text-[22px] font-medium text-black dark:text-white mt-1 flex items-center gap-2.5">
              <span>{inspectedRecord.decision.choice || `Score: ${inspectedRecord.decision.score}`}</span>
              <span class="text-xs font-mono px-2.5 py-0.5 rounded-full bg-black dark:bg-white text-white dark:text-black font-semibold">
                {Math.round(inspectedRecord.decision.confidence * 100)}% Confidence
              </span>
            </div>
            <p class="text-xs text-neutral-700 dark:text-neutral-300 mt-3 p-3 rounded-[12px] bg-white dark:bg-[#121212] border border-[#e6e6e6] dark:border-[#2c2c2c] leading-relaxed">
              <span class="font-semibold text-black dark:text-white">Rationale: </span>
              {inspectedRecord.decision.reasoningSummary}
            </p>
          </div>
        {/if}

        <!-- All Row Fields -->
        <h4 class="text-xs font-mono uppercase tracking-wider text-black dark:text-white font-bold mb-3">Attributes</h4>
        <div class="space-y-2">
          {#each summary.headers as header}
            <div class="flex items-center justify-between p-3 rounded-[12px] bg-[#f7f7f5] dark:bg-[#1a1a1a] border border-[#f1f1f1] dark:border-[#262626] text-xs">
              <span class="text-neutral-600 dark:text-neutral-400 font-medium">{header}</span>
              <span class="text-black dark:text-white font-mono font-medium text-right max-w-xs truncate">{inspectedRecord.raw[header] ?? '—'}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="pt-6 border-t border-[#e6e6e6] dark:border-[#262626] mt-6">
        <button
          type="button"
          onclick={() => inspectingRowIndex = null}
          class="w-full py-3 rounded-full bg-black dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-black text-xs font-medium cursor-pointer transition-colors shadow-xs"
        >
          Close Drawer
        </button>
      </div>
    </div>
  </div>
{/if}
