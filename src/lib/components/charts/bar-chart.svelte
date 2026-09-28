<script lang="ts">
	import type { BarChartData } from '$lib/services/api';
	import BarChartIcon from '@lucide/svelte/icons/chart-bar';

	interface Props {
		data: BarChartData;
	}

	let { data }: Props = $props();

	let hoveredIndex = $state<number | null>(null);

	let maxValue = $derived(
		data.points.length > 0 ? Math.max(...data.points.map((p) => p.value), 1) : 1
	);

	function formatVal(val: number): string {
		if (val >= 1000) {
			return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
		}
		return val.toFixed(1);
	}
</script>

<div class="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h4 class="text-sm font-bold text-foreground flex items-center gap-2">
				<BarChartIcon class="size-4 text-primary" />
				{data.title}
			</h4>
			<p class="text-xs text-muted-foreground mt-0.5">
				Comparing {data.metric_label} across {data.points.length} {data.dimension_label} categories
			</p>
		</div>
		<span class="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
			Metric: {data.metric_label}
		</span>
	</div>

	<!-- Horizontal Bar List for Maximum Label Legibility -->
	<div class="space-y-3 pt-2">
		{#each data.points as point, idx}
			{@const pct = Math.round((point.value / maxValue) * 100)}
			<div
				class="space-y-1 group cursor-pointer"
				onmouseenter={() => (hoveredIndex = idx)}
				onmouseleave={() => (hoveredIndex = null)}
				role="row"
				tabindex="0"
			>
				<div class="flex items-center justify-between text-xs font-mono">
					<span class="font-semibold text-foreground truncate max-w-[200px]" title={point.label}>
						{point.label}
					</span>
					<span class="text-muted-foreground font-bold group-hover:text-primary transition-colors">
						{formatVal(point.value)}
						{#if point.count}
							<span class="text-[10px] text-muted-foreground/70 font-normal">({point.count} items)</span>
						{/if}
					</span>
				</div>

				<div class="w-full bg-muted/60 rounded-full h-3 overflow-hidden p-0.5 border border-border/40">
					<div
						class="bg-gradient-to-r from-primary/80 to-primary h-full rounded-full transition-all duration-700 ease-out group-hover:brightness-110"
						style="width: {pct}%"
					></div>
				</div>
			</div>
		{/each}
	</div>
</div>
