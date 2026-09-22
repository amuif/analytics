<script lang="ts">
	import type { QueryResult } from '$lib/services/duckdb';
	import ChartBarIcon from '@lucide/svelte/icons/chart-column';
	import ChartLineIcon from '@lucide/svelte/icons/chart-line';
	import ChartAreaIcon from '@lucide/svelte/icons/chart-area';
	import ChartScatterIcon from '@lucide/svelte/icons/chart-scatter';
	import ChartHistogramIcon from '@lucide/svelte/icons/chart-no-axes-column';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import TableIcon from '@lucide/svelte/icons/table';

	interface Props {
		result: QueryResult | null;
		onSwitchToGrid?: () => void;
	}

	let { result, onSwitchToGrid }: Props = $props();

	type ChartType = 'bar' | 'line' | 'area' | 'scatter' | 'histogram';
	type AggType = 'NONE' | 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';

	let chartType = $state<ChartType>('bar');
	let xAxisCol = $state<string>('');
	let yAxisCol = $state<string>('');
	let aggregation = $state<AggType>('NONE');
	let hoveredPoint = $state<{ x: number; y: number; label: string; value: number } | null>(null);

	// Auto-select initial columns when result changes
	$effect(() => {
		if (result && result.columns.length > 0) {
			const cols = result.columns.map((c) => c.name);
			if (!xAxisCol || !cols.includes(xAxisCol)) {
				xAxisCol = cols[0];
			}
			if (!yAxisCol || !cols.includes(yAxisCol)) {
				// Pick first numeric column if available
				const numericCol = result.columns.find((c) => {
					const t = c.type.toUpperCase();
					return (
						t.includes('INT') ||
						t.includes('DOUBLE') ||
						t.includes('FLOAT') ||
						t.includes('DECIMAL') ||
						t.includes('REAL')
					);
				});
				yAxisCol = numericCol ? numericCol.name : cols[1] || cols[0];
			}
		}
	});

	interface DataPoint {
		label: string;
		value: number;
		rawX?: unknown;
	}

	// Compute processed chart data
	let chartData = $derived.by<DataPoint[]>(() => {
		if (!result || result.rows.length === 0 || !xAxisCol) return [];

		if (chartType === 'histogram') {
			// Extract numeric values from yAxisCol or xAxisCol
			const targetCol = yAxisCol || xAxisCol;
			const values = result.rows
				.map((r) => Number(r[targetCol]))
				.filter((n) => !isNaN(n) && isFinite(n));

			if (values.length === 0) return [];

			const min = Math.min(...values);
			const max = Math.max(...values);
			if (min === max) {
				return [{ label: String(min), value: values.length }];
			}

			const binCount = 10;
			const binWidth = (max - min) / binCount;
			const bins: number[] = new Array(binCount).fill(0);

			for (const val of values) {
				const binIdx = Math.min(Math.floor((val - min) / binWidth), binCount - 1);
				bins[binIdx]++;
			}

			return bins.map((count, i) => {
				const bStart = min + i * binWidth;
				const bEnd = bStart + binWidth;
				return {
					label: `${bStart.toFixed(1)}-${bEnd.toFixed(1)}`,
					value: count
				};
			});
		}

		if (aggregation === 'NONE') {
			// Direct row plotting (limit top 60 to prevent overplotting)
			return result.rows.slice(0, 60).map((r, i) => {
				const xVal = r[xAxisCol];
				const yVal = Number(r[yAxisCol]);
				return {
					label: xVal !== null && xVal !== undefined ? String(xVal) : `#${i + 1}`,
					value: isNaN(yVal) ? 0 : yVal,
					rawX: xVal
				};
			});
		}

		// Aggregated
		const groupMap = new Map<string, { sum: number; count: number; min: number; max: number }>();

		for (const r of result.rows) {
			const key = String(r[xAxisCol] ?? 'null');
			const val = Number(r[yAxisCol]);
			const numVal = isNaN(val) ? 0 : val;

			if (!groupMap.has(key)) {
				groupMap.set(key, { sum: numVal, count: 1, min: numVal, max: numVal });
			} else {
				const entry = groupMap.get(key)!;
				entry.sum += numVal;
				entry.count += 1;
				entry.min = Math.min(entry.min, numVal);
				entry.max = Math.max(entry.max, numVal);
			}
		}

		const entries: DataPoint[] = [];
		for (const [key, data] of groupMap.entries()) {
			let finalVal = data.sum;
			if (aggregation === 'AVG') finalVal = data.sum / data.count;
			else if (aggregation === 'COUNT') finalVal = data.count;
			else if (aggregation === 'MIN') finalVal = data.min;
			else if (aggregation === 'MAX') finalVal = data.max;

			entries.push({
				label: key,
				value: Number(finalVal.toFixed(2))
			});
		}

		// Sort by value descending and take top 40
		return entries.sort((a, b) => b.value - a.value).slice(0, 40);
	});

	// SVG layout bounds
	const svgWidth = 800;
	const svgHeight = 360;
	const padding = { top: 30, right: 30, bottom: 65, left: 65 };
	const chartAreaWidth = svgWidth - padding.left - padding.right;
	const chartAreaHeight = svgHeight - padding.top - padding.bottom;

	let maxVal = $derived(
		chartData.length > 0 ? Math.max(1, ...chartData.map((d) => d.value)) : 1
	);
	let minVal = $derived(
		chartData.length > 0 ? Math.min(0, ...chartData.map((d) => d.value)) : 0
	);
	let valRange = $derived(maxVal - minVal || 1);

	function getY(val: number): number {
		const ratio = (val - minVal) / valRange;
		return padding.top + chartAreaHeight * (1 - ratio);
	}

	function getX(idx: number): number {
		if (chartData.length <= 1) return padding.left + chartAreaWidth / 2;
		return padding.left + (idx / (chartData.length - 1)) * chartAreaWidth;
	}

	let linePath = $derived.by(() => {
		if (chartData.length === 0) return '';
		return chartData
			.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.value)}`)
			.join(' ');
	});

	let areaPath = $derived.by(() => {
		if (chartData.length === 0) return '';
		const baselineY = getY(Math.max(0, minVal));
		const firstX = getX(0);
		const lastX = getX(chartData.length - 1);
		return `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;
	});

	let labelStep = $derived(Math.max(1, Math.ceil(chartData.length / 12)));

	let summaryStats = $derived.by(() => {
		if (chartData.length === 0) return null;
		const vals = chartData.map((d) => d.value);
		const sum = vals.reduce((a, b) => a + b, 0);
		const avg = sum / vals.length;
		const min = Math.min(...vals);
		const max = Math.max(...vals);
		return {
			count: vals.length,
			sum: Number(sum.toFixed(2)),
			avg: Number(avg.toFixed(2)),
			min: Number(min.toFixed(2)),
			max: Number(max.toFixed(2))
		};
	});

	function exportChartSvg() {
		const svgEl = document.querySelector('#visualization-svg');
		if (!svgEl) return;
		const serializer = new XMLSerializer();
		const source = serializer.serializeToString(svgEl);
		const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `chart_${chartType}_${Date.now()}.svg`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex flex-col h-full min-h-0 bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
	<!-- Chart Controls Header -->
	<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
		<!-- Chart Type Switcher -->
		<div class="flex items-center gap-1 p-1 rounded-lg border border-border bg-background">
			<button
				type="button"
				onclick={() => (chartType = 'bar')}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {chartType === 'bar' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
				title="Bar Chart"
			>
				<ChartBarIcon class="size-3.5" />
				<span>Bar</span>
			</button>
			<button
				type="button"
				onclick={() => (chartType = 'line')}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {chartType === 'line' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
				title="Line Chart"
			>
				<ChartLineIcon class="size-3.5" />
				<span>Line</span>
			</button>
			<button
				type="button"
				onclick={() => (chartType = 'area')}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {chartType === 'area' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
				title="Area Chart"
			>
				<ChartAreaIcon class="size-3.5" />
				<span>Area</span>
			</button>
			<button
				type="button"
				onclick={() => (chartType = 'scatter')}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {chartType === 'scatter' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
				title="Scatter Plot"
			>
				<ChartScatterIcon class="size-3.5" />
				<span>Scatter</span>
			</button>
			<button
				type="button"
				onclick={() => (chartType = 'histogram')}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors {chartType === 'histogram' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
				title="Histogram Distribution"
			>
				<ChartHistogramIcon class="size-3.5" />
				<span>Histogram</span>
			</button>
		</div>

		<!-- Axis & Aggregation Pickers -->
		<div class="flex flex-wrap items-center gap-2.5 text-xs">
			{#if result && result.columns.length > 0}
				<!-- X Axis -->
				<div class="flex items-center gap-1.5">
					<span class="text-muted-foreground font-mono">X:</span>
					<select
						bind:value={xAxisCol}
						class="px-2 py-1 rounded-md border border-border bg-background text-foreground font-mono focus:outline-none"
					>
						{#each result.columns as c}
							<option value={c.name}>{c.name}</option>
						{/each}
					</select>
				</div>

				<!-- Y Axis -->
				{#if chartType !== 'histogram'}
					<div class="flex items-center gap-1.5">
						<span class="text-muted-foreground font-mono">Y:</span>
						<select
							bind:value={yAxisCol}
							class="px-2 py-1 rounded-md border border-border bg-background text-foreground font-mono focus:outline-none"
						>
							{#each result.columns as c}
								<option value={c.name}>{c.name}</option>
							{/each}
						</select>
					</div>

					<!-- Aggregation -->
					<div class="flex items-center gap-1.5">
						<span class="text-muted-foreground font-mono">Agg:</span>
						<select
							bind:value={aggregation}
							class="px-2 py-1 rounded-md border border-border bg-background text-foreground font-mono focus:outline-none"
						>
							<option value="NONE">None</option>
							<option value="SUM">SUM</option>
							<option value="AVG">AVG</option>
							<option value="COUNT">COUNT</option>
							<option value="MIN">MIN</option>
							<option value="MAX">MAX</option>
						</select>
					</div>
				{/if}
			{/if}

			<button
				type="button"
				onclick={exportChartSvg}
				disabled={chartData.length === 0}
				class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50 cursor-pointer"
				title="Export chart as SVG vector image"
			>
				<DownloadIcon class="size-3" />
				SVG
			</button>

			{#if onSwitchToGrid}
				<button
					type="button"
					onclick={onSwitchToGrid}
					class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
					title="Switch back to tabular Data Grid"
				>
					<TableIcon class="size-3.5 text-muted-foreground" />
					<span>Table View</span>
				</button>
			{/if}
		</div>
	</div>

	<!-- Chart Render Area -->
	<div class="flex-1 min-h-0 overflow-auto flex flex-col items-center justify-center p-4 relative">
		{#if !result || chartData.length === 0}
			<div class="flex flex-col items-center justify-center text-center p-6 space-y-2">
				<ChartBarIcon class="size-10 text-muted-foreground/60 stroke-1" />
				<p class="text-sm font-medium text-foreground">No chartable data</p>
				<p class="text-xs text-muted-foreground">Select valid X and Y columns to render visualizations.</p>
			</div>
		{:else}
			<div class="w-full max-w-4xl relative">
				<svg
					id="visualization-svg"
					viewBox="0 0 {svgWidth} {svgHeight}"
					class="w-full h-auto overflow-visible select-none"
				>
					<!-- Horizontal Grid Lines & Y-Ticks -->
					{#each [0, 0.25, 0.5, 0.75, 1] as tick}
						{@const tickVal = minVal + (maxVal - minVal) * (1 - tick)}
						{@const yPos = padding.top + chartAreaHeight * tick}
						<g class="transition-all duration-200">
							<line
								x1={padding.left}
								y1={yPos}
								x2={svgWidth - padding.right}
								y2={yPos}
								class="stroke-border/50"
								stroke-dasharray="3 3"
							/>
							<text
								x={padding.left - 8}
								y={yPos + 3.5}
								text-anchor="end"
								class="text-[10px] fill-muted-foreground font-mono"
							>
								{tickVal.toFixed(tickVal >= 100 ? 0 : 1)}
							</text>
						</g>
					{/each}

					<!-- Area Fill (if Area Chart) -->
					{#if chartType === 'area'}
						<defs>
							<linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stop-color="#6366f1" stop-opacity="0.35" />
								<stop offset="100%" stop-color="#6366f1" stop-opacity="0.0" />
							</linearGradient>
						</defs>
						<path d={areaPath} fill="url(#areaGradient)" />
					{/if}

					<!-- Line (if Line or Area Chart) -->
					{#if chartType === 'line' || chartType === 'area'}
						<path
							d={linePath}
							fill="none"
							class="stroke-indigo-600 dark:stroke-indigo-400"
							stroke-width="2.5"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					{/if}

					<!-- Bar Chart / Histogram -->
					{#if chartType === 'bar' || chartType === 'histogram'}
						{@const barWidth = Math.max(4, Math.min(32, (chartAreaWidth / chartData.length) * 0.75))}
						{@const slotWidth = chartAreaWidth / chartData.length}
						{@const zeroY = getY(0)}
						{#each chartData as d, i}
							{@const xCenter = padding.left + i * slotWidth + slotWidth / 2}
							{@const xPos = xCenter - barWidth / 2}
							{@const yPos = getY(d.value)}
							{@const topY = Math.min(yPos, zeroY)}
							{@const h = Math.max(2, Math.abs(yPos - zeroY))}
							<rect
								role="img"
								aria-label="{d.label}: {d.value}"
								x={xPos}
								y={topY}
								width={barWidth}
								height={h}
								rx={2}
								class="fill-indigo-600/85 hover:fill-indigo-500 dark:fill-indigo-500/85 dark:hover:fill-indigo-400 transition-all duration-150 cursor-pointer"
								onmouseenter={() => (hoveredPoint = { x: xCenter, y: yPos, label: d.label, value: d.value })}
								onmouseleave={() => (hoveredPoint = null)}
							/>
						{/each}
					{/if}

					<!-- Scatter Plot / Line Points -->
					{#if chartType === 'line' || chartType === 'area' || chartType === 'scatter'}
						{#each chartData as d, i}
							{@const xPos = getX(i)}
							{@const yPos = getY(d.value)}
							<circle
								role="img"
								aria-label="{d.label}: {d.value}"
								cx={xPos}
								cy={yPos}
								r={chartType === 'scatter' ? 5 : 3.5}
								class="fill-indigo-600 dark:fill-indigo-400 stroke-background hover:scale-150 transition-transform duration-150 cursor-pointer"
								stroke-width="2"
								onmouseenter={() => (hoveredPoint = { x: xPos, y: yPos, label: d.label, value: d.value })}
								onmouseleave={() => (hoveredPoint = null)}
							/>
						{/each}
					{/if}

					<!-- X-Axis Labels (sample every N labels to avoid overlapping) -->
					{#each chartData as d, i}
						{#if i % labelStep === 0}
							{@const xPos = chartType === 'bar' || chartType === 'histogram'
								? padding.left + i * (chartAreaWidth / chartData.length) + (chartAreaWidth / chartData.length) / 2
								: getX(i)}
							<text
								x={xPos}
								y={svgHeight - padding.bottom + 18}
								text-anchor="middle"
								class="text-[9px] fill-muted-foreground font-mono truncate"
							>
								{d.label.length > 8 ? d.label.substring(0, 8) + '…' : d.label}
							</text>
						{/if}
					{/each}
				</svg>

				<!-- Hover Tooltip -->
				{#if hoveredPoint}
					{@const leftPercent = (hoveredPoint.x / svgWidth) * 100}
					{@const topPercent = (hoveredPoint.y / svgHeight) * 100}
					<div
						class="absolute -translate-x-1/2 -translate-y-full mb-2 pointer-events-none z-20 px-2.5 py-1.5 rounded-lg border border-border bg-popover text-popover-foreground text-xs shadow-md font-mono"
						style="left: {leftPercent}%; top: {topPercent}%;"
					>
						<div class="font-bold text-foreground">{hoveredPoint.label}</div>
						<div class="text-indigo-600 dark:text-indigo-400 font-semibold">{hoveredPoint.value.toLocaleString()}</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Bottom Summary Stats Bar -->
	{#if summaryStats}
		<div class="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 border-t border-border bg-muted/20 text-xs font-mono shrink-0">
			<div class="flex items-center gap-3 text-muted-foreground flex-wrap">
				<span>Points: <strong class="text-foreground font-semibold">{summaryStats.count}</strong></span>
				<span>•</span>
				<span>Min: <strong class="text-foreground font-semibold">{summaryStats.min}</strong></span>
				<span>•</span>
				<span>Max: <strong class="text-foreground font-semibold">{summaryStats.max}</strong></span>
				<span>•</span>
				<span>Avg: <strong class="text-foreground font-semibold">{summaryStats.avg}</strong></span>
				<span>•</span>
				<span>Sum: <strong class="text-foreground font-semibold">{summaryStats.sum.toLocaleString()}</strong></span>
			</div>
			<div class="text-[11px] text-muted-foreground font-sans">
				Hover over bars or points to inspect values
			</div>
		</div>
	{/if}
</div>
