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
      return { text: 'High Load', bg: 'bg-[#efd4d4] text-black border border-black' };
    }
    if (telemetry.stressLevel === 'moderate') {
      return { text: 'Moderate Load', bg: 'bg-[#f4ecd6] text-black border border-neutral-400' };
    }
    return { text: 'Optimal (Low Stress)', bg: 'bg-[#dceeb1] text-black border border-neutral-300' };
  });
</script>

<div class="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-[#f7f7f5] border border-[#e6e6e6] rounded-full text-xs font-mono text-black shadow-sm">
  <!-- Hardware Mode & Privacy -->
  <div class="flex items-center gap-3">
    <div class="flex items-center gap-1.5 font-medium">
      <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black text-white text-[11px]">
        <Zap class="w-3 h-3 text-[#dceeb1]" />
        {telemetry.hardwareMode}
      </span>
    </div>
    <div class="h-3 w-[1px] bg-[#e6e6e6]"></div>
    <div class="flex items-center gap-1.5 text-neutral-700 font-sans text-xs">
      <ShieldCheck class="w-4 h-4 text-emerald-600" />
      <span>100% Client Privacy (0 Network Calls)</span>
    </div>
  </div>

  <!-- Telemetry Metrics -->
  <div class="flex items-center gap-4">
    <!-- JS Heap Memory -->
    <div class="flex items-center gap-1.5 text-neutral-600" title="Active V8 JavaScript Heap usage">
      <HardDrive class="w-3.5 h-3.5 text-neutral-400" />
      <span>Heap:</span>
      <span class="font-bold text-black">{telemetry.memoryUsedMB} MB</span>
      <span class="text-neutral-400">({telemetry.heapUsagePercent}%)</span>
    </div>

    <!-- FPS -->
    <div class="flex items-center gap-1.5 text-neutral-600" title="Current render framerate">
      <Cpu class="w-3.5 h-3.5 text-neutral-400" />
      <span>FPS:</span>
      <span class="font-bold {telemetry.fps >= 50 ? 'text-black' : 'text-amber-600'}">{telemetry.fps}</span>
    </div>

    <!-- Render Latency -->
    {#if renderLatencyMs > 0}
      <div class="flex items-center gap-1.5 text-neutral-600">
        <Activity class="w-3.5 h-3.5 text-neutral-400" />
        <span>Latency:</span>
        <span class="font-bold text-black">{Math.round(renderLatencyMs)}ms</span>
      </div>
    {/if}

    <!-- Overall Stress Status Badge -->
    <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold {stressBadge.bg}">
      <span class="w-1.5 h-1.5 rounded-full bg-black"></span>
      <span>{stressBadge.text}</span>
    </div>
  </div>
</div>
