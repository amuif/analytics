<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  // Register only the pieces this card uses so the rest of ECharts is tree-shaken out.
  import * as echarts from 'echarts/core';
  import { BarChart, PieChart } from 'echarts/charts';
  import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
  import { CanvasRenderer } from 'echarts/renderers';

  import type { EChartsOption } from 'echarts';
  import type { ChartDefinition } from '../types';
  import { themeManager } from '../lib/theme.svelte';

  echarts.use([BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

  let { chart }: { chart: ChartDefinition } = $props();

  let chartContainer: HTMLDivElement;
  let chartInstance: echarts.ECharts | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let showDetails = $state(true); // Default open to keep user informed as requested!
  let barOrientation = $state<'horizontal' | 'vertical'>('horizontal'); // Default horizontal to solve wide category crowding
  let pieLegendPosition = $state<'top' | 'bottom'>('top'); // Default top legend with pie pushed down

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

  // Watch chart data, theme, and user orientation/legend preferences
  $effect(() => {
    void themeManager.current;
    void barOrientation;
    void pieLegendPosition;
    if (chart && chartInstance) {
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

    let options: EChartsOption = {
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
        grid: {
          left: '3%',
          right: '3%',
          bottom: xData.length > 5 ? '16%' : '10%',
          top: '12%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: xData,
          axisLine: { lineStyle: { color: axisLineColor, width: 1.5 } },
          axisTick: { show: false },
          axisLabel: {
            color: axisLabelColor,
            fontSize: 10,
            interval: 0,
            rotate: xData.length > 5 ? 25 : 0,
          },
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
      const categories = chart.data.map(d => d.category);
      const counts = chart.data.map(d => d.count);

      if (barOrientation === 'horizontal') {
        // Horizontal Bar Chart: perfectly handles wide category names and labels
        options = {
          ...options,
          grid: {
            left: '3%',
            right: '8%',
            bottom: '4%',
            top: '4%',
            containLabel: true,
          },
          xAxis: {
            type: 'value',
            splitLine: { lineStyle: { color: splitLineColor } },
            axisLabel: { color: axisLabelColor, fontSize: 10 },
            axisLine: { show: false },
          },
          yAxis: {
            type: 'category',
            data: categories,
            inverse: true, // Rank #1 highest group on top
            axisLine: { lineStyle: { color: axisLineColor, width: 1.5 } },
            axisTick: { show: false },
            axisLabel: {
              color: axisLabelColor,
              fontSize: 11,
              width: 105,
              overflow: 'truncate',
              ellipsis: '...',
              formatter: (val: string) => (val.length > 15 ? val.slice(0, 14) + '…' : val),
            },
          },
          series: [
            {
              name: 'Total',
              type: 'bar',
              data: counts,
              barMaxWidth: 20,
              itemStyle: {
                color: '#dceeb1', // Figma Lime
                borderColor: isDark ? '#ffffff' : '#000000',
                borderWidth: 1.5,
                borderRadius: [0, 6, 6, 0],
              },
              label: {
                show: true,
                position: 'right',
                color: axisLabelColor,
                fontSize: 10,
                fontFamily: 'monospace',
                formatter: '{c}',
              },
            },
          ],
        };
      } else {
        // Vertical Bar Chart option
        options = {
          ...options,
          grid: {
            left: '4%',
            right: '4%',
            bottom: '16%',
            top: '10%',
            containLabel: true,
          },
          xAxis: {
            type: 'category',
            data: categories,
            axisLine: { lineStyle: { color: axisLineColor, width: 1.5 } },
            axisTick: { show: false },
            axisLabel: {
              color: axisLabelColor,
              fontSize: 10,
              interval: 0,
              rotate: categories.length > 4 ? 25 : 0,
              width: 60,
              overflow: 'truncate',
              ellipsis: '...',
            },
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
              data: counts,
              barMaxWidth: 36,
              itemStyle: {
                color: '#dceeb1', // Figma Lime
                borderColor: isDark ? '#ffffff' : '#000000',
                borderWidth: 1.5,
                borderRadius: [6, 6, 0, 0],
              },
            },
          ],
        };
      }
    } else if (chart.type === 'pie') {
      const isLegendTop = pieLegendPosition === 'top';

      options = {
        ...options,
        tooltip: {
          trigger: 'item',
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          textStyle: { color: '#ffffff', fontSize: 12, fontFamily: 'Google Sans Flex, Google Sans, sans-serif' },
          borderRadius: 8,
          padding: [8, 12],
          formatter: '{b}: <b>{c}</b> ({d}%)',
        },
        legend: {
          show: true,
          type: 'scroll',
          orient: 'horizontal',
          top: isLegendTop ? '2%' : undefined,
          bottom: !isLegendTop ? '2%' : undefined,
          left: 'center',
          itemWidth: 10,
          itemHeight: 10,
          itemGap: 14,
          icon: 'circle',
          textStyle: { color: axisLabelColor, fontSize: 11, fontFamily: 'Google Sans Flex, Google Sans, sans-serif' },
          pageIconColor: isDark ? '#ffffff' : '#000000',
          pageIconInactiveColor: isDark ? '#555555' : '#cccccc',
          pageTextStyle: { color: axisLabelColor, fontSize: 10 },
        },
        series: [
          {
            name: chart.title,
            type: 'pie',
            // When legend is at top: push donut down to center ['50%', '64%']
            // When legend is at bottom: center donut at ['50%', '40%']
            radius: ['38%', '60%'],
            center: isLegendTop ? ['50%', '64%'] : ['50%', '40%'],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 6,
              borderColor: isDark ? '#141414' : '#ffffff',
              borderWidth: 2,
            },
            label: {
              show: false,
            },
            emphasis: {
              scale: true,
              scaleSize: 6,
              label: {
                show: true,
                fontSize: 12,
                fontWeight: 'bold',
                color: isDark ? '#ffffff' : '#000000',
                formatter: '{b}\n{d}%',
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
      <h3 class="text-[15px] sm:text-[16px] font-semibold text-black dark:text-white tracking-tight">
        {chart.title}
      </h3>
      <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{chart.description}</p>
    </div>

    <!-- Header Actions & Chart Type Badge -->
    <div class="flex items-center gap-1.5 shrink-0">
      {#if chart.type === 'bar'}
        <!-- Bar Orientation Pill Switcher -->
        <div class="inline-flex p-0.5 rounded-full bg-[#f7f7f5] dark:bg-[#1a1a1a] border border-[#e6e6e6] dark:border-[#333333]">
          <button
            type="button"
            onclick={() => barOrientation = 'horizontal'}
            class="px-2 py-0.5 rounded-full text-[10px] font-mono transition-all {barOrientation === 'horizontal' ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs' : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer'}"
            title="Horizontal bars (optimized for wide categories)"
          >
            Horiz
          </button>
          <button
            type="button"
            onclick={() => barOrientation = 'vertical'}
            class="px-2 py-0.5 rounded-full text-[10px] font-mono transition-all {barOrientation === 'vertical' ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs' : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer'}"
            title="Vertical bars"
          >
            Vert
          </button>
        </div>
      {:else if chart.type === 'pie'}
        <!-- Pie Legend / Position Pill Switcher -->
        <div class="inline-flex p-0.5 rounded-full bg-[#f7f7f5] dark:bg-[#1a1a1a] border border-[#e6e6e6] dark:border-[#333333]">
          <button
            type="button"
            onclick={() => pieLegendPosition = 'top'}
            class="px-2 py-0.5 rounded-full text-[10px] font-mono transition-all {pieLegendPosition === 'top' ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs' : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer'}"
            title="Top legend with pie pushed down"
          >
            Pushed Down
          </button>
          <button
            type="button"
            onclick={() => pieLegendPosition = 'bottom'}
            class="px-2 py-0.5 rounded-full text-[10px] font-mono transition-all {pieLegendPosition === 'bottom' ? 'bg-black dark:bg-white text-white dark:text-black font-semibold shadow-xs' : 'text-neutral-500 dark:text-neutral-400 hover:text-black dark:hover:text-white cursor-pointer'}"
            title="Bottom legend"
          >
            Bottom
          </button>
        </div>
      {/if}

      <span class="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider px-2.5 sm:px-3 py-1 bg-[#f7f7f5] dark:bg-[#1f1f1f] text-black dark:text-white border border-[#e6e6e6] dark:border-[#333333] rounded-full font-medium">
        {chart.type}
      </span>
    </div>
  </div>

  <!-- Interactive ECharts Canvas (extra height for pie to accommodate pushed-down donut & legend) -->
  <div
    bind:this={chartContainer}
    class="w-full {chart.type === 'pie' ? 'h-64 sm:h-72 min-h-[260px]' : 'h-56 sm:h-64 min-h-[220px]'}"
  ></div>

  <!-- Real Key Details & Findings Section (Informing the User) -->
  {#if chart.insights}
    <div class="mt-4 pt-3.5 border-t border-[#e6e6e6] dark:border-[#222222]">
      <div class="flex items-center justify-between mb-2">
        <button
          type="button"
          onclick={() => showDetails = !showDetails}
          class="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-mono font-medium text-neutral-700 dark:text-neutral-300 hover:text-black dark:hover:text-white cursor-pointer transition-colors"
        >
          <span>Findings & method</span>
          <span class="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono">[{showDetails ? 'Hide' : 'Show'}]</span>
        </button>

        {#if chart.insights.metricSummary && chart.insights.metricSummary.length > 0}
          <span class="hidden sm:inline-block max-w-[140px] truncate text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f7f7f5] dark:bg-[#1a1a1a] text-neutral-600 dark:text-neutral-400 border border-[#e6e6e6] dark:border-[#2c2c2c]">
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
                <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#121212] border border-[#e6e6e6] dark:border-[#333333] text-[10px] font-mono max-w-[200px]">
                  <span class="text-neutral-500 dark:text-neutral-400 shrink-0">{metric.label}:</span>
                  <span class="font-bold text-black dark:text-white truncate" title={metric.value}>{metric.value}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
