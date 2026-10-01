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
    const saved = await db.getDecisions(summary.id);
    if (saved && saved.length === rows.length) {
      decisions = saved;
      processedCount = rows.length;
    } else {
      runLayaEvaluation(activePreset);
    }
  });

  async function runLayaEvaluation(preset: DecisionPreset) {
    isEvaluating = true;
    processedCount = 0;
    totalCount = rows.length;
    startTime = performance.now();

    try {
      const results = await layaEngine.evaluateDataset(
        summary.id,
        rows,
        preset,
        summary.columns,
        (processed, total) => {
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

  // KPI Calculations
  const criticalCount = $derived(decisions.filter(d => d.severity === 'critical' || d.severity === 'high').length);
  const avgConfidence = $derived.by(() => {
    if (decisions.length === 0) return 0;
    const sum = decisions.reduce((acc, curr) => acc + curr.confidence, 0);
    return Math.round((sum / decisions.length) * 100);
  });

  // Figma Pastel Domain Theme
  const domainPastel = $derived.by(() => {
    if (summary.detectedDomain === 'hr') return 'bg-[#dceeb1]'; // Lime
    if (summary.detectedDomain === 'sales') return 'bg-[#c5b0f4]'; // Lilac
    if (summary.detectedDomain === 'ecommerce') return 'bg-[#f3c9b6]'; // Coral
    if (summary.detectedDomain === 'support') return 'bg-[#c8e6cd]'; // Mint
    return 'bg-[#f4ecd6]'; // Cream
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
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-neutral-50 text-black border border-black text-xs font-medium transition-all cursor-pointer"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Upload Dataset</span>
        </button>

        <div class="h-4 w-[1px] bg-[#e6e6e6]"></div>

        <div>
          <h1 class="text-xl font-medium tracking-tight text-black flex items-center gap-2.5">
            <span>{summary.filename}</span>
            <span class="text-xs font-mono px-3 py-1 rounded-full bg-[#f7f7f5] text-neutral-800 border border-[#e6e6e6]">
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
        class="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
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
  <div class="rounded-[24px] p-8 md:p-12 text-black {domainPastel} border border-black/10">
    <div class="flex flex-wrap items-start justify-between gap-6 mb-6">
      <div>
        <div class="flex items-center gap-2">
          <span class="font-mono text-[12px] uppercase tracking-wider font-bold opacity-80">
            Detected Business Domain
          </span>
          <span class="inline-flex items-center px-3 py-0.5 rounded-full bg-black text-white text-[11px] font-mono font-semibold uppercase">
            {summary.detectedDomain} &bull; {Math.round(summary.domainConfidence * 100)}% Match
          </span>
        </div>
        <h2 class="mt-3 text-[32px] md:text-[44px] font-normal tracking-[-0.96px] leading-[1.1] text-black">
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
        class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-black text-white hover:bg-neutral-800 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
      >
        <RefreshCw class="w-3.5 h-3.5 {isEvaluating ? 'animate-spin' : ''}" />
        <span>{isEvaluating ? 'Evaluating...' : 'Re-Run Model'}</span>
      </button>
    </div>

    <!-- Playbook Switcher (Pill-Only Buttons) -->
    <div class="flex flex-wrap gap-2.5 pt-6 border-t border-black/10">
      {#each summary.suggestedPresets as preset}
        <button
          type="button"
          onclick={() => handlePresetChange(preset)}
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium transition-all cursor-pointer {activePreset.id === preset.id ? 'bg-black text-white' : 'bg-white/80 hover:bg-white text-black border border-black/20'}"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>{preset.name}</span>
        </button>
      {/each}
    </div>

    <!-- Active Question Card -->
    <div class="mt-6 p-4 bg-white/90 rounded-[16px] border border-black/15 flex items-start gap-3 text-xs text-black">
      <span class="font-bold uppercase tracking-wider font-mono text-[11px] shrink-0">Model Decision Question:</span>
      <span class="italic text-neutral-800 text-[13px]">"{activePreset.targetQuestion}"</span>
    </div>

    <!-- Live Evaluation Progress -->
    {#if isEvaluating}
      <div class="mt-6 space-y-2">
        <div class="flex items-center justify-between text-xs font-mono font-medium">
          <span>Deciding row {processedCount.toLocaleString()} of {totalCount.toLocaleString()}...</span>
          <span class="font-bold">{Math.round((processedCount / Math.max(1, totalCount)) * 100)}%</span>
        </div>
        <div class="w-full h-2.5 bg-black/10 rounded-full overflow-hidden">
          <div
            class="h-full bg-black transition-all duration-150"
            style="width: {(processedCount / Math.max(1, totalCount)) * 100}%"
          ></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- KPI Summary Cards (Figma Card Geometry) -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-white border border-[#e6e6e6] rounded-[20px] p-6 hover:border-black transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500">Total Records</span>
      <div class="text-[36px] font-normal tracking-tight text-black mt-2 leading-none">
        {summary.rowCount.toLocaleString()}
      </div>
      <span class="text-[11px] font-mono text-neutral-600 mt-2 block">100% Ingested Locally</span>
    </div>

    <div class="bg-white border border-[#e6e6e6] rounded-[20px] p-6 hover:border-black transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500">Action / Watch</span>
      <div class="text-[36px] font-normal tracking-tight text-black mt-2 leading-none">
        {criticalCount.toLocaleString()}
      </div>
      <span class="text-[11px] font-mono text-neutral-600 mt-2 block">
        {Math.round((criticalCount / Math.max(1, summary.rowCount)) * 100)}% of total dataset
      </span>
    </div>

    <div class="bg-white border border-[#e6e6e6] rounded-[20px] p-6 hover:border-black transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500">Mean Confidence</span>
      <div class="text-[36px] font-normal tracking-tight text-black mt-2 leading-none">
        {avgConfidence}%
      </div>
      <span class="text-[11px] font-mono text-neutral-600 mt-2 block">Calibrated Decision Head</span>
    </div>

    <div class="bg-white border border-[#e6e6e6] rounded-[20px] p-6 hover:border-black transition-colors">
      <span class="text-xs font-mono uppercase tracking-wider text-neutral-500">Throughput</span>
      <div class="text-[36px] font-normal tracking-tight text-black mt-2 leading-none">
        {evaluationDurationMs > 0 ? Math.round((summary.rowCount / (evaluationDurationMs / 1000))) : '2,500+'}
      </div>
      <span class="text-[11px] font-mono text-neutral-600 mt-2 block">rows / second</span>
    </div>
  </div>

  <!-- Automated Visual Analytics (ECharts) -->
  {#if charts.length > 0}
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs font-mono uppercase tracking-wider font-bold text-black">
          Automated Visual Analytics
        </h2>
        <span class="text-xs font-mono text-neutral-500">Client Canvas (Zero DOM bloat)</span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {#each charts as chart (chart.id)}
          <ChartCard {chart} />
        {/each}
      </div>
    </div>
  {/if}

  <!-- Decision Matrix Table (Figma Monochrome Editorial Style) -->
  <div class="bg-white border border-[#e6e6e6] rounded-[24px] p-8 shadow-sm">
    <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <h2 class="text-[20px] font-medium tracking-tight text-black">
          Decision Matrix & Row Triage
        </h2>
        <p class="text-xs text-neutral-500 mt-1">Each row evaluated via Laya with calibrated confidence and attribute signals.</p>
      </div>

      <!-- Filters & Search -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search rows..."
            bind:value={searchQuery}
            class="pl-9 pr-4 py-2 rounded-full bg-[#f7f7f5] border border-[#e6e6e6] text-xs text-black placeholder-neutral-400 focus:outline-none focus:border-black w-48 sm:w-60 font-sans"
          />
        </div>

        <select
          bind:value={selectedSeverityFilter}
          class="px-4 py-2 rounded-full bg-[#f7f7f5] border border-[#e6e6e6] text-xs text-black focus:outline-none focus:border-black cursor-pointer font-sans"
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
    <div class="w-full overflow-x-auto rounded-[16px] border border-[#e6e6e6]">
      <table class="w-full text-left text-xs text-black">
        <thead class="bg-[#f7f7f5] text-[11px] uppercase tracking-wider text-neutral-600 font-mono border-b border-[#e6e6e6]">
          <tr>
            <th class="py-3.5 px-4 font-semibold">#</th>
            <th class="py-3.5 px-4 font-semibold">Identifier</th>
            <th class="py-3.5 px-4 font-semibold">Laya Decision</th>
            <th class="py-3.5 px-4 font-semibold">Confidence</th>
            <th class="py-3.5 px-4 font-semibold">Rationale</th>
            <th class="py-3.5 px-4 text-right font-semibold">Inspect</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#f1f1f1]">
          {#if paginatedRows.length === 0}
            <tr>
              <td colspan="6" class="py-10 text-center text-neutral-400">
                No matching records found.
              </td>
            </tr>
          {:else}
            {#each paginatedRows as item (item.raw._rowIndex)}
              <tr class="hover:bg-[#f7f7f5] transition-colors">
                <td class="py-3.5 px-4 font-mono text-neutral-400">{item.raw._rowIndex + 1}</td>
                <td class="py-3.5 px-4 font-medium text-black">
                  {item.raw[summary.headers[0]] || `Row ${item.raw._rowIndex + 1}`}
                  {#if summary.headers.length > 1}
                    <span class="block text-[11px] text-neutral-500 font-normal">
                      {summary.headers[1]}: {item.raw[summary.headers[1]]}
                    </span>
                  {/if}
                </td>
                <td class="py-3.5 px-4">
                  {#if item.decision}
                    <!-- Figma Signature Badges (Pills) -->
                    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold
                      {item.decision.severity === 'critical' ? 'bg-[#efd4d4] text-black border border-black' :
                       item.decision.severity === 'high' ? 'bg-[#f3c9b6] text-black border border-black/30' :
                       item.decision.severity === 'medium' ? 'bg-[#c5b0f4] text-black' :
                       'bg-[#dceeb1] text-black'}">
                      {item.decision.choice || (item.decision.score ? `Score: ${item.decision.score}/5` : (item.decision.boolean ? 'Flagged: Yes' : 'Flagged: No'))}
                    </span>
                  {:else}
                    <span class="text-neutral-400 italic">Pending...</span>
                  {/if}
                </td>
                <td class="py-3.5 px-4 font-mono">
                  {#if item.decision}
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-black">{Math.round(item.decision.confidence * 100)}%</span>
                      <div class="w-14 h-1.5 bg-[#e6e6e6] rounded-full overflow-hidden">
                        <div class="h-full bg-black" style="width: {item.decision.confidence * 100}%"></div>
                      </div>
                    </div>
                  {/if}
                </td>
                <td class="py-3.5 px-4 text-xs text-neutral-600 max-w-xs truncate" title={item.decision?.reasoningSummary}>
                  {item.decision?.reasoningSummary || 'Calculating...'}
                </td>
                <td class="py-3.5 px-4 text-right">
                  <!-- Circular Pill Button -->
                  <button
                    type="button"
                    onclick={() => inspectingRowIndex = item.raw._rowIndex}
                    class="w-7 h-7 rounded-full inline-flex items-center justify-center border border-[#e6e6e6] hover:border-black text-black transition-colors cursor-pointer"
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
    <div class="flex items-center justify-between mt-6 text-xs text-neutral-600">
      <span>
        Showing {filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length.toLocaleString()} records
      </span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onclick={() => currentPage = Math.max(1, currentPage - 1)}
          class="w-8 h-8 rounded-full border border-black inline-flex items-center justify-center hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <span class="px-2 font-mono text-black font-medium">Page {currentPage} of {totalPages}</span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onclick={() => currentPage = Math.min(totalPages, currentPage + 1)}
          class="w-8 h-8 rounded-full border border-black inline-flex items-center justify-center hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Row Detail Inspection Drawer -->
{#if inspectedRecord}
  <div class="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
    <div class="w-full max-w-lg h-full bg-white border-l border-[#e6e6e6] p-8 flex flex-col justify-between overflow-y-auto shadow-2xl">
      <div>
        <div class="flex items-center justify-between pb-5 border-b border-[#e6e6e6]">
          <div>
            <span class="text-xs font-mono uppercase tracking-wider text-neutral-500 font-semibold">Row #{inspectedRecord.raw._rowIndex + 1} Profile</span>
            <h3 class="text-[20px] font-medium text-black mt-0.5 tracking-tight">
              {inspectedRecord.raw[summary.headers[0]] || 'Detailed Inspection'}
            </h3>
          </div>
          <button
            type="button"
            onclick={() => inspectingRowIndex = null}
            class="w-8 h-8 rounded-full border border-black inline-flex items-center justify-center hover:bg-neutral-100 cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Decision Box in Drawer -->
        {#if inspectedRecord.decision}
          <div class="my-6 p-6 rounded-[20px] bg-[#f7f7f5] border border-[#e6e6e6]">
            <span class="text-[11px] font-mono uppercase tracking-wider text-neutral-500 font-bold">Laya Model Decision</span>
            <div class="text-[22px] font-medium text-black mt-1 flex items-center gap-2.5">
              <span>{inspectedRecord.decision.choice || `Score: ${inspectedRecord.decision.score}`}</span>
              <span class="text-xs font-mono px-2.5 py-0.5 rounded-full bg-black text-white">
                {Math.round(inspectedRecord.decision.confidence * 100)}% Confidence
              </span>
            </div>
            <p class="text-xs text-neutral-700 mt-3 p-3 rounded-[12px] bg-white border border-[#e6e6e6] leading-relaxed">
              <span class="font-semibold text-black">Rationale: </span>
              {inspectedRecord.decision.reasoningSummary}
            </p>
          </div>
        {/if}

        <!-- All Row Fields -->
        <h4 class="text-xs font-mono uppercase tracking-wider text-black font-bold mb-3">Attributes</h4>
        <div class="space-y-2">
          {#each summary.headers as header}
            <div class="flex items-center justify-between p-3 rounded-[12px] bg-[#f7f7f5] border border-[#f1f1f1] text-xs">
              <span class="text-neutral-600 font-medium">{header}</span>
              <span class="text-black font-mono font-medium text-right max-w-xs truncate">{inspectedRecord.raw[header] ?? '—'}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="pt-6 border-t border-[#e6e6e6] mt-6">
        <button
          type="button"
          onclick={() => inspectingRowIndex = null}
          class="w-full py-3 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-medium cursor-pointer"
        >
          Close Drawer
        </button>
      </div>
    </div>
  </div>
{/if}
