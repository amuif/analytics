<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { stressMonitor } from '../lib/stress-monitor';
  import type { StressTelemetry } from '../types';
  import { Activity, Cpu, HardDrive, Zap, ShieldCheck } from '@lucide/svelte';

  let { processedRows = 0, totalRows = 0, renderLatencyMs = 0 } = $props<{
    processedRows?: number;
    totalRows?: number;
    renderLatencyMs?: number;
  }>();

  let telemetry = $state<StressTelemetry>(stressMonitor.getTelemetry());
  let intervalId: any = null;

  onMount(() => {
    intervalId = setInterval(() => {
      telemetry = stressMonitor.getTelemetry(processedRows, totalRows, renderLatencyMs);
    }, 500);
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const stressBadge = $derived.by(() => {
    if (telemetry.stressLevel === 'high') {
      return {
        text: 'High Load',
        bg: 'bg-[#efd4d4] dark:bg-[#381e1e] text-black dark:text-[#efd4d4] border border-black dark:border-[#efd4d4]/40',
      };
    }
    if (telemetry.stressLevel === 'moderate') {
      return {
        text: 'Moderate Load',
        bg: 'bg-[#f4ecd6] dark:bg-[#322a1b] text-black dark:text-[#f4ecd6] border border-neutral-400 dark:border-[#f4ecd6]/40',
      };
    }
    return {
      text: 'Optimal (Low Stress)',
      bg: 'bg-[#dceeb1] dark:bg-[#283518] text-black dark:text-[#dceeb1] border border-neutral-300 dark:border-[#dceeb1]/40',
    };
  });
</script>

<div class="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#f7f7f5] dark:bg-[#161616] border border-[#e6e6e6] dark:border-[#262626] rounded-[20px] sm:rounded-full text-xs font-mono text-black dark:text-white shadow-xs transition-colors">
  <!-- Hardware Mode & Privacy -->
  <div class="flex flex-wrap items-center gap-2 sm:gap-3">
    <div class="flex items-center gap-1.5 font-medium">
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[11px] font-semibold transition-colors">
        <Zap class="w-3 h-3 text-[#dceeb1] dark:text-[#1f1d3d]" />
        {telemetry.hardwareMode}
      </span>
    </div>
    <div class="hidden sm:block h-3 w-[1px] bg-[#e6e6e6] dark:bg-[#2c2c2c]"></div>
    <div class="flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 font-sans text-xs">
      <ShieldCheck class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      <span class="text-[11px] sm:text-xs">Air-Gapped (0 Network Calls)</span>
    </div>
  </div>

  <!-- Telemetry Metrics -->
  <div class="flex flex-wrap items-center gap-2.5 sm:gap-4">
    <!-- JS Heap Memory -->
    <div class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400" title="Active V8 JavaScript Heap usage">
      <HardDrive class="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
      <span>Heap:</span>
      <span class="font-bold text-black dark:text-white">{telemetry.memoryUsedMB} MB</span>
      <span class="text-neutral-400 dark:text-neutral-500 text-[10px] sm:text-xs">({telemetry.heapUsagePercent}%)</span>
    </div>

    <!-- FPS -->
    <div class="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400" title="Current render framerate">
      <Cpu class="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
      <span>FPS:</span>
      <span class="font-bold {telemetry.fps >= 50 ? 'text-black dark:text-white' : 'text-amber-600 dark:text-amber-400'}">{telemetry.fps}</span>
    </div>

    <!-- Render Latency -->
    {#if renderLatencyMs > 0}
      <div class="hidden sm:flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
        <Activity class="w-3.5 h-3.5 text-neutral-400 dark:text-neutral-500" />
        <span>Latency:</span>
        <span class="font-bold text-black dark:text-white">{Math.round(renderLatencyMs)}ms</span>
      </div>
    {/if}

    <!-- Overall Stress Status Badge -->
    <div class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold {stressBadge.bg}">
      <span class="w-1.5 h-1.5 rounded-full bg-black dark:bg-white"></span>
      <span>{stressBadge.text}</span>
    </div>
  </div>
</div>
