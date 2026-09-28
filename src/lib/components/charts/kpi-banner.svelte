<script lang="ts">
	import type { KPICard } from '$lib/services/api';
	import TrendingUpIcon from '@lucide/svelte/icons/trending-up';
	import DollarSignIcon from '@lucide/svelte/icons/dollar-sign';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import PackageIcon from '@lucide/svelte/icons/package';
	import BarChartIcon from '@lucide/svelte/icons/chart-bar';

	interface Props {
		kpis: KPICard[];
	}

	let { kpis }: Props = $props();

	function getIcon(category: string, label: string) {
		const lower = label.toLowerCase();
		if (lower.includes('revenue') || lower.includes('sales') || lower.includes('dollar') || lower.includes('price')) {
			return DollarSignIcon;
		}
		if (lower.includes('quantity') || lower.includes('units') || lower.includes('records') || lower.includes('volume')) {
			return PackageIcon;
		}
		if (category === 'dimension' || lower.includes('distinct') || lower.includes('category')) {
			return LayersIcon;
		}
		if (category === 'average') {
			return TrendingUpIcon;
		}
		return BarChartIcon;
	}
</script>

<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 w-full">
	{#each kpis as kpi}
		{@const Icon = getIcon(kpi.category, kpi.label)}
		<div class="p-4 rounded-xl border border-border/80 bg-card/70 shadow-2xs hover:border-primary/50 transition-all space-y-1.5">
			<div class="flex items-center justify-between">
				<span class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate" title={kpi.label}>
					{kpi.label}
				</span>
				<div class="flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary shrink-0">
					<Icon class="size-3.5" />
				</div>
			</div>
			<div class="text-xl font-bold font-mono text-foreground tracking-tight truncate" title={kpi.value}>
				{kpi.value}
			</div>
			{#if kpi.description}
				<p class="text-[11px] text-muted-foreground/75 truncate" title={kpi.description}>
					{kpi.description}
				</p>
			{/if}
		</div>
	{/each}
</div>
