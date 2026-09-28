<script lang="ts">
	import type { AnalyticsDashboardData } from '$lib/services/api';
	import KpiBanner from './kpi-banner.svelte';
	import BarChart from './bar-chart.svelte';
	import PieChart from './pie-chart.svelte';
	import HistogramChart from './histogram-chart.svelte';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import LightbulbIcon from '@lucide/svelte/icons/lightbulb';
	import TagIcon from '@lucide/svelte/icons/tag';

	interface Props {
		analytics: AnalyticsDashboardData;
	}

	let { analytics }: Props = $props();
</script>

<div class="w-full space-y-6 pt-4">
	<!-- Laya Visual Recommendation Banner -->
	<div class="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-start gap-3.5">
		<div class="flex items-center justify-center size-8 rounded-lg bg-primary/20 text-primary shrink-0 mt-0.5">
			<LightbulbIcon class="size-4" />
		</div>
		<div class="space-y-1">
			<h4 class="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
				<SparklesIcon class="size-3.5" /> Laya Analytics & Visualization Recommendation
			</h4>
			<p class="text-xs sm:text-sm font-medium text-foreground">
				{analytics.laya_recommendation}
			</p>
			<p class="text-[11px] text-muted-foreground font-mono">
				{analytics.headline}
			</p>
		</div>
	</div>

	<!-- 1. Executive KPI Summary Cards -->
	{#if analytics.kpis && analytics.kpis.length > 0}
		<KpiBanner kpis={analytics.kpis} />
	{/if}

	<!-- 2. Dual Chart Grid (Bar Chart & Pie Chart) -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		{#if analytics.bar_chart}
			<BarChart data={analytics.bar_chart} />
		{/if}

		{#if analytics.pie_chart}
			<PieChart data={analytics.pie_chart} />
		{/if}
	</div>

	<!-- 3. Numeric Frequency Distribution Histogram -->
	{#if analytics.histogram}
		<HistogramChart data={analytics.histogram} />
	{/if}

	<!-- Detected Columns Footer -->
	<div class="p-4 rounded-xl border border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
		<div class="flex items-center gap-2">
			<span class="text-muted-foreground flex items-center gap-1">
				<TagIcon class="size-3.5" /> Quantitative Metrics:
			</span>
			<div class="flex flex-wrap gap-1.5">
				{#each analytics.detected_metrics as metric}
					<span class="px-2 py-0.5 rounded-md bg-card border border-border font-medium text-foreground">
						{metric}
					</span>
				{/each}
			</div>
		</div>

		<div class="flex items-center gap-2">
			<span class="text-muted-foreground">Categorical Dimensions:</span>
			<div class="flex flex-wrap gap-1.5">
				{#each analytics.detected_dimensions as dim}
					<span class="px-2 py-0.5 rounded-md bg-card border border-border font-medium text-foreground">
						{dim}
					</span>
				{/each}
			</div>
		</div>
	</div>
</div>
