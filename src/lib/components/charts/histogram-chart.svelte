<script lang="ts">
	import type { HistogramData } from '$lib/services/api';
	import ActivityIcon from '@lucide/svelte/icons/activity';

	interface Props {
		data: HistogramData;
	}

	let { data }: Props = $props();

	let maxFreq = $derived(
		data.bins.length > 0 ? Math.max(...data.bins.map((b) => b.frequency), 1) : 1
	);

	let hoveredBinIndex = $state<number | null>(null);
</script>

<div class="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h4 class="text-sm font-bold text-foreground flex items-center gap-2">
				<ActivityIcon class="size-4 text-primary" />
				{data.title}
			</h4>
			<p class="text-xs text-muted-foreground mt-0.5">
				Distribution across {data.bins.length} numeric intervals ({data.total_samples} samples)
			</p>
		</div>
		<span class="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
			Metric: {data.metric_label}
		</span>
	</div>

	<!-- Vertical Histogram Bars -->
	<div class="pt-6 pb-2">
		<div class="flex items-end justify-between gap-2.5 h-44 border-b border-border/70 pb-2">
			{#each data.bins as bin, idx}
				{@const heightPct = Math.max(Math.round((bin.frequency / maxFreq) * 100), 8)}
				<div
					class="flex-1 flex flex-col items-center justify-end h-full gap-2 group cursor-pointer"
					onmouseenter={() => (hoveredBinIndex = idx)}
					onmouseleave={() => (hoveredBinIndex = null)}
					role="row"
					tabindex="0"
				>
					<!-- Frequency Count Label on Top -->
					<span
						class="text-[11px] font-mono font-bold transition-all duration-200 {hoveredBinIndex === idx
							? 'text-primary scale-110'
							: 'text-muted-foreground'}"
					>
						{bin.frequency}
					</span>

					<!-- Bar -->
					<div class="w-full bg-muted/40 rounded-t-xl overflow-hidden p-0.5 h-full flex items-end">
						<div
							class="w-full rounded-t-lg transition-all duration-500 ease-out {hoveredBinIndex === idx
								? 'bg-primary brightness-110'
								: 'bg-primary/80 group-hover:bg-primary'}"
							style="height: {heightPct}%"
						></div>
					</div>

					<!-- Range Label at Bottom -->
					<span
						class="text-[10px] font-mono text-center text-muted-foreground truncate w-full group-hover:text-foreground transition-colors"
						title={bin.bin_label}
					>
						{bin.bin_label}
					</span>
				</div>
			{/each}
		</div>

		<!-- Axis Legend -->
		<div class="flex items-center justify-between text-[11px] text-muted-foreground/75 font-mono pt-2">
			<span>Lower Value Range</span>
			<span>{data.metric_label} Intervals</span>
			<span>Higher Value Range</span>
		</div>
	</div>
</div>
