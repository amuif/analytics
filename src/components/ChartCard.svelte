<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as echarts from 'echarts';
  import type { ChartDefinition } from '../types';
  import { themeManager } from '../lib/theme.svelte';
  import { BarChart3, PieChart as PieIcon, LineChart, Info, ChevronDown, ChevronUp } from '@lucide/svelte';

  let { chart } = $props<{ chart: ChartDefinition }>();

  let chartContainer: HTMLDivElement;
  let chartInstance: echarts.ECharts | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let showDetails = $state(true); // Default open to keep user informed as requested!

  onMount(() => {
    if (!chartContainer) return;

    chartInstance = echarts.init(chartContainer, undefined, {
      renderer: 'canvas',
    });

    updateChartOptions();

    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize();
    });
    resizeObserver.observe(chartContainer);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    chartInstance?.dispose();
  });

  // Watch both chart data and themeManager.current
  $effect(() => {
    if (chart && chartInstance && themeManager.current) {
      updateChartOptions();
    }
  });

  function updateChartOptions() {
    if (!chartInstance) return;

    const isDark = themeManager.current === 'dark';

    // Figma Design System Palette (adapted for light / dark)
    const FIGMA_PALETTE = isDark
      ? ['#ffffff', '#c5b0f4', '#c8e6cd', '#f3c9b6', '#dceeb1', '#efd4d4', '#f4ecd6', '#a78bfa']
      : ['#000000', '#c5b0f4', '#c8e6cd', '#f3c9b6', '#dceeb1', '#efd4d4', '#f4ecd6', '#1f1d3d'];

    const axisLineColor = isDark ? '#ffffff' : '#000000';
    const axisLabelColor = isDark ? '#a0a0a0' : '#555555';
    const splitLineColor = isDark ? '#222222' : '#f1f1f1';
    const tooltipBg = isDark ? '#1a1a1a' : '#000000';
    const tooltipBorder = isDark ? '#333333' : '#000000';

    let options: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: chart.type === 'pie' ? 'item' : 'axis',
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        textStyle: { color: '#ffffff', fontSize: 12, fontFamily: 'Google Sans Flex, Google Sans, sans-serif' },
        borderRadius: 8,
        padding: [8, 12],
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '8%',
        top: '16%',
        containLabel: true,
      },
    };

    if (chart.type === 'histogram') {
      const xData = chart.data.map(d => d.range);
      const yData = chart.data.map(d => d.count);

      options = {
        ...options,
        xAxis: {
          type: 'category',
          data: xData,
          axisLine: { lineStyle: { color: axisLineColor, width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: axisLabelColor, fontSize: 10, rotate: xData.length > 5 ? 25 : 0 },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: axisLabelColor, fontSize: 10 },
        },
        series: [
          {
            name: 'Count',
            type: 'bar',
            data: yData,
            barWidth: '65%',
            itemStyle: {
              color: '#c5b0f4', // Figma Lilac
              borderColor: isDark ? '#ffffff' : '#000000',
              borderWidth: 1.5,
              borderRadius: [6, 6, 0, 0],
            },
          },
        ],
      };
    } else if (chart.type === 'bar') {
      const xData = chart.data.map(d => d.category);
      const yData = chart.data.map(d => d.count);

      options = {
        ...options,
        xAxis: {
          type: 'category',
          data: xData,
          axisLine: { lineStyle: { color: axisLineColor, width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: axisLabelColor, fontSize: 10, rotate: xData.length > 4 ? 25 : 0 },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: axisLabelColor, fontSize: 10 },
        },
        series: [
          {
            name: 'Total',
            type: 'bar',
            data: yData,
            barMaxWidth: 44,
            itemStyle: {
              color: '#dceeb1', // Figma Lime
              borderColor: isDark ? '#ffffff' : '#000000',
              borderWidth: 1.5,
              borderRadius: [6, 6, 0, 0],
            },
          },
        ],
      };
    } else if (chart.type === 'pie') {
      options = {
        ...options,
        legend: {
          bottom: '1%',
          textStyle: { color: axisLabelColor, fontSize: 10 },
          itemWidth: 10,
          itemHeight: 10,
          icon: 'circle',
        },
        series: [
          {
            name: chart.title,
            type: 'pie',
            radius: ['45%', '72%'],
            center: ['50%', '46%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 6,
              borderColor: isDark ? '#141414' : '#ffffff',
              borderWidth: 2,
            },
            label: {
              show: false,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 12,
                fontWeight: 'bold',
                color: isDark ? '#ffffff' : '#000000',
              },
            },
            data: chart.data,
            color: FIGMA_PALETTE,
          },
        ],
      };
    }

    chartInstance.setOption(options, true);
  }
</script>

<div class="flex flex-col bg-white dark:bg-[#141414] border border-[#e6e6e6] dark:border-[#262626] rounded-[20px] sm:rounded-[24px] p-4 sm:p-6 shadow-xs hover:border-black dark:hover:border-neutral-500 transition-all duration-200">
  <!-- Card Header -->
  <div class="flex items-start justify-between gap-3 mb-3">
    <div>
      <h3 class="text-[15px] sm:text-[16px] font-semibold text-black dark:text-white flex items-center gap-2 tracking-tight">
        {#if chart.type === 'histogram'}
          <BarChart3 class="w-4 h-4 text-black dark:text-white shrink-0" />
        {:else if chart.type === 'pie'}
          <PieIcon class="w-4 h-4 text-black dark:text-white shrink-0" />
        {:else}
          <LineChart class="w-4 h-4 text-black dark:text-white shrink-0" />
        {/if}
        <span>{chart.title}</span>
      </h3>
      <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{chart.description}</p>
    </div>
    <span class="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider px-2.5 sm:px-3 py-1 bg-[#f7f7f5] dark:bg-[#1f1f1f] text-black dark:text-white border border-[#e6e6e6] dark:border-[#333333] rounded-full font-medium shrink-0">
      {chart.type}
    </span>
  </div>

  <!-- Interactive ECharts Canvas -->
  <div bind:this={chartContainer} class="w-full h-56 sm:h-64 min-h-[220px]"></div>

  <!-- Real Key Details & Findings Section (Informing the User) -->
  {#if chart.insights}
    <div class="mt-4 pt-3.5 border-t border-[#e6e6e6] dark:border-[#222222]">
      <div class="flex items-center justify-between mb-2">
        <button
          type="button"
          onclick={() => showDetails = !showDetails}
          class="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
        >
          <Info class="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <span>Methodology & key findings</span>
          {#if showDetails}
            <ChevronUp class="w-3 h-3 text-neutral-400 shrink-0" />
          {:else}
            <ChevronDown class="w-3 h-3 text-neutral-400 shrink-0" />
          {/if}
        </button>

        {#if chart.insights.metricSummary && chart.insights.metricSummary.length > 0}
          <span class="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f7f7f5] dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-400 border border-[#e6e6e6] dark:border-[#2c2c2c]">
            {chart.insights.metricSummary[0].label}: {chart.insights.metricSummary[0].value}
          </span>
        {/if}
      </div>

      {#if showDetails}
        <div class="space-y-2.5 text-xs text-neutral-600 dark:text-neutral-300 bg-[#f7f7f5] dark:bg-[#1a1a1a] p-3 sm:p-3.5 rounded-[14px] border border-[#e6e6e6] dark:border-[#2a2a2a] animate-fade-in font-sans">
          <!-- Methodology Explanation -->
          <div class="flex items-start gap-2">
            <span class="font-mono text-[10px] uppercase font-bold text-neutral-500 dark:text-neutral-400 shrink-0 mt-0.5">Method:</span>
            <p class="text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-200">
              {chart.insights.methodology}
            </p>
          </div>

          <!-- Key Findings Bullets -->
          {#if chart.insights.keyFindings && chart.insights.keyFindings.length > 0}
            <div class="space-y-1 pt-1.5 border-t border-[#e6e6e6]/60 dark:border-[#2c2c2c]">
              {#each chart.insights.keyFindings as finding}
                <div class="flex items-start gap-2 text-[11px] leading-snug">
                  <span class="w-1.5 h-1.5 rounded-full bg-black dark:bg-white shrink-0 mt-1.5 opacity-60"></span>
                  <span>{finding}</span>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Metric Summary Pills -->
          {#if chart.insights.metricSummary && chart.insights.metricSummary.length > 0}
            <div class="flex flex-wrap gap-1.5 pt-1.5">
              {#each chart.insights.metricSummary as metric}
                <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#121212] border border-[#e6e6e6] dark:border-[#333333] text-[10px] font-mono">
                  <span class="text-neutral-500 dark:text-neutral-400">{metric.label}:</span>
                  <span class="font-bold text-black dark:text-white">{metric.value}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
