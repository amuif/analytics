<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import * as echarts from 'echarts';
  import type { ChartDefinition } from '../types';
  import { BarChart3, PieChart as PieIcon, LineChart } from '@lucide/svelte';

  let { chart } = $props<{ chart: ChartDefinition }>();

  let chartContainer: HTMLDivElement;
  let chartInstance: echarts.ECharts | null = null;
  let resizeObserver: ResizeObserver | null = null;

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

  $effect(() => {
    if (chart && chartInstance) {
      updateChartOptions();
    }
  });

  function updateChartOptions() {
    if (!chartInstance) return;

    // Figma Design System Palette
    const FIGMA_PALETTE = ['#000000', '#c5b0f4', '#c8e6cd', '#f3c9b6', '#dceeb1', '#efd4d4', '#f4ecd6', '#1f1d3d'];

    let options: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: chart.type === 'pie' ? 'item' : 'axis',
        backgroundColor: '#000000',
        borderColor: '#000000',
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
          axisLine: { lineStyle: { color: '#000000', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: '#555555', fontSize: 11, rotate: xData.length > 6 ? 25 : 0 },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#f1f1f1' } },
          axisLabel: { color: '#777777', fontSize: 11 },
        },
        series: [
          {
            name: 'Count',
            type: 'bar',
            data: yData,
            barWidth: '65%',
            itemStyle: {
              color: '#c5b0f4', // Figma Lilac
              borderColor: '#000000',
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
          axisLine: { lineStyle: { color: '#000000', width: 1.5 } },
          axisTick: { show: false },
          axisLabel: { color: '#555555', fontSize: 11, rotate: xData.length > 5 ? 30 : 0 },
        },
        yAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: '#f1f1f1' } },
          axisLabel: { color: '#777777', fontSize: 11 },
        },
        series: [
          {
            name: 'Total',
            type: 'bar',
            data: yData,
            barMaxWidth: 44,
            itemStyle: {
              color: '#dceeb1', // Figma Lime
              borderColor: '#000000',
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
          bottom: '2%',
          textStyle: { color: '#555555', fontSize: 11 },
          itemWidth: 12,
          itemHeight: 12,
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
              borderColor: '#ffffff',
              borderWidth: 2,
            },
            label: {
              show: false,
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 13,
                fontWeight: 'bold',
                color: '#000000',
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

<div class="flex flex-col bg-white border border-[#e6e6e6] rounded-[24px] p-6 shadow-sm hover:border-black transition-all duration-200">
  <div class="flex items-start justify-between mb-4">
    <div>
      <h3 class="text-[16px] font-semibold text-black flex items-center gap-2 tracking-tight">
        {#if chart.type === 'histogram'}
          <BarChart3 class="w-4 h-4 text-black" />
        {:else if chart.type === 'pie'}
          <PieIcon class="w-4 h-4 text-black" />
        {:else}
          <LineChart class="w-4 h-4 text-black" />
        {/if}
        {chart.title}
      </h3>
      <p class="text-xs text-neutral-500 mt-1">{chart.description}</p>
    </div>
    <span class="text-[11px] font-mono uppercase tracking-wider px-3 py-1 bg-[#f7f7f5] text-black border border-[#e6e6e6] rounded-full font-medium">
      {chart.type}
    </span>
  </div>

  <div bind:this={chartContainer} class="w-full h-64 min-h-[250px]"></div>
</div>
