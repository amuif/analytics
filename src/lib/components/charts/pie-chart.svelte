<script lang="ts">
	import type { PieChartData } from '$lib/services/api';
	import PieChartIcon from '@lucide/svelte/icons/chart-pie';

	interface Props {
		data: PieChartData;
	}

	let { data }: Props = $props();

	let hoveredIndex = $state<number | null>(null);

	const colors = [
		'#10b981', // emerald
		'#0ea5e9', // sky
		'#8b5cf6', // violet
		'#f59e0b', // amber
		'#f43f5e', // rose
		'#06b6d4', // cyan
		'#64748b'  // slate
	];

	const size = 180;
	const radius = 68;
	const strokeWidth = 24;
	const circumference = 2 * Math.PI * radius;

	// Calculate cumulative offsets
	let sliceSegments = $derived.by(() => {
		let currentOffset = 0;
		return data.slices.map((slice, idx) => {
			const pct = slice.percentage ? slice.percentage / 100 : 0;
			const dash = pct * circumference;
			const offset = -currentOffset;
			currentOffset += dash;
			return {
				...slice,
				dash,
				offset,
				color: colors[idx % colors.length]
			};
		});
	});
</script>

<div class="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h4 class="text-sm font-bold text-foreground flex items-center gap-2">
				<PieChartIcon class="size-4 text-primary" />
				{data.title}
			</h4>
			<p class="text-xs text-muted-foreground mt-0.5">
				Proportion share by {data.dimension_label}
			</p>
		</div>
		<span class="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
			{data.slices.length} Slices
		</span>
	</div>

	<!-- Donut SVG and Legend Layout -->
	<div class="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
		<!-- SVG Donut Chart -->
		<div class="relative shrink-0 flex items-center justify-center">
			<svg width={size} height={size} viewBox="0 0 {size} {size}" class="-rotate-90">
				<!-- Background track -->
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="transparent"
					stroke="currentColor"
					stroke-width={strokeWidth}
					class="text-muted/30"
				/>

				<!-- Slices -->
				{#each sliceSegments as seg, idx}
					<circle
						cx={size / 2}
						cy={size / 2}
						r={radius}
						fill="transparent"
						stroke={seg.color}
						stroke-width={hoveredIndex === idx ? strokeWidth + 4 : strokeWidth}
						stroke-dasharray="{seg.dash} {circumference - seg.dash}"
						stroke-dashoffset={seg.offset}
						stroke-linecap="round"
						class="transition-all duration-300 cursor-pointer"
						role="graphics-symbol"
						aria-label="{seg.label}: {seg.percentage}%"
						onmouseenter={() => (hoveredIndex = idx)}
						onmouseleave={() => (hoveredIndex = null)}
					/>
				{/each}
			</svg>

			<!-- Center Content -->
			<div class="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
				{#if hoveredIndex !== null && data.slices[hoveredIndex]}
					{@const activeSlice = data.slices[hoveredIndex]}
					<span class="text-xs font-bold text-foreground font-mono">{activeSlice.percentage}%</span>
					<span class="text-[10px] text-muted-foreground truncate max-w-[80px]">{activeSlice.label}</span>
				{:else}
					<span class="text-xs font-bold text-foreground font-mono">100%</span>
					<span class="text-[10px] text-muted-foreground">Total</span>
				{/if}
			</div>
		</div>

		<!-- Legend -->
		<div class="flex-1 space-y-2 w-full text-xs font-mono">
			{#each sliceSegments as seg, idx}
				<div
					class="flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer {hoveredIndex === idx ? 'bg-muted/60' : 'hover:bg-muted/30'}"
					onmouseenter={() => (hoveredIndex = idx)}
					onmouseleave={() => (hoveredIndex = null)}
					role="row"
					tabindex="0"
				>
					<div class="flex items-center gap-2 truncate max-w-[150px]">
						<span class="size-2.5 rounded-full shrink-0" style="background-color: {seg.color}"></span>
						<span class="truncate font-medium text-foreground" title={seg.label}>{seg.label}</span>
					</div>
					<div class="flex items-center gap-2 font-bold shrink-0">
						<span class="text-foreground">{seg.percentage}%</span>
						{#if seg.count}
							<span class="text-[10px] text-muted-foreground font-normal">({seg.count})</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>
