<script lang="ts">
	import type { QueryResult } from '$lib/services/duckdb';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import SearchIcon from '@lucide/svelte/icons/search';
	import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';
	import TableIcon from '@lucide/svelte/icons/table';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';

	interface Props {
		result: QueryResult | null;
		onSwitchToChart?: () => void;
	}

	let { result, onSwitchToChart }: Props = $props();

	let searchQuery = $state('');
	let sortColumn = $state<string | null>(null);
	let sortAsc = $state(true);
	let pageSize = $state(50);
	let currentPage = $state(1);
	let copiedCell = $state<string | null>(null);

	// Reset page when result or search changes
	$effect(() => {
		if (result || searchQuery) {
			currentPage = 1;
		}
	});

	function handleSort(colName: string) {
		if (sortColumn === colName) {
			if (sortAsc) {
				sortAsc = false;
			} else {
				sortColumn = null;
				sortAsc = true;
			}
		} else {
			sortColumn = colName;
			sortAsc = true;
		}
	}

	let filteredRows = $derived.by(() => {
		if (!result || !result.rows) return [];
		const query = searchQuery.trim().toLowerCase();
		if (!query) return result.rows;

		return result.rows.filter((row) => {
			return Object.values(row).some((val) => {
				if (val === null || val === undefined) return false;
				return String(val).toLowerCase().includes(query);
			});
		});
	});

	let sortedRows = $derived.by(() => {
		if (!sortColumn) return filteredRows;

		const col = sortColumn;
		const asc = sortAsc;

		return [...filteredRows].sort((a, b) => {
			const valA = a[col];
			const valB = b[col];

			if (valA === valB) return 0;
			if (valA === null || valA === undefined) return 1;
			if (valB === null || valB === undefined) return -1;

			if (typeof valA === 'number' && typeof valB === 'number') {
				return asc ? valA - valB : valB - valA;
			}

			const strA = String(valA);
			const strB = String(valB);
			return asc ? strA.localeCompare(strB) : strB.localeCompare(strA);
		});
	});

	let totalPages = $derived(Math.max(1, Math.ceil(sortedRows.length / pageSize)));

	let paginatedRows = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		return sortedRows.slice(start, start + pageSize);
	});

	async function copyToClipboard(val: unknown, key: string) {
		const text = val === null || val === undefined ? 'NULL' : String(val);
		try {
			await navigator.clipboard.writeText(text);
			copiedCell = key;
			setTimeout(() => {
				if (copiedCell === key) copiedCell = null;
			}, 1500);
		} catch (e) {
			console.error('Failed to copy', e);
		}
	}

	function exportCurrentView() {
		if (!result || sortedRows.length === 0) return;
		const headers = result.columns.map((c) => c.name);
		const csvLines = [headers.join(',')];

		for (const row of sortedRows) {
			const line = headers.map((h) => {
				const val = row[h];
				if (val === null || val === undefined) return '';
				const str = String(val).replace(/"/g, '""');
				return `"${str}"`;
			});
			csvLines.push(line.join(','));
		}

		const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `query_results_${Date.now()}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function getTypeBadgeClass(type: string): string {
		const t = type.toUpperCase();
		if (t.includes('INT') || t.includes('DOUBLE') || t.includes('FLOAT') || t.includes('DECIMAL')) {
			return 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20';
		}
		if (t.includes('VARCHAR') || t.includes('TEXT') || t.includes('CHAR') || t.includes('STRING')) {
			return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
		}
		if (t.includes('DATE') || t.includes('TIME')) {
			return 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20';
		}
		if (t.includes('BOOL')) {
			return 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20';
		}
		return 'text-muted-foreground bg-muted border-border';
	}
</script>

<div class="flex flex-col h-full min-h-0 bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
	<!-- Top Grid Action Bar -->
	<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
		<div class="flex items-center gap-2 flex-1 max-w-sm">
			<div class="relative w-full">
				<SearchIcon class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
				<input
					type="text"
					placeholder="Search in results..."
					bind:value={searchQuery}
					class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				/>
			</div>
			{#if searchQuery}
				<button
					type="button"
					onclick={() => (searchQuery = '')}
					class="text-xs text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
				>
					Clear
				</button>
			{/if}
		</div>

		<div class="flex items-center gap-3 text-xs text-muted-foreground font-mono">
			{#if result}
				<span>
					{sortedRows.length.toLocaleString()} {sortedRows.length === 1 ? 'row' : 'rows'}
					{#if sortedRows.length !== result.rowCount}
						<span class="text-muted-foreground/75">(filtered from {result.rowCount.toLocaleString()})</span>
					{/if}
				</span>
				<span>•</span>
				<span>{result.columns.length} columns</span>
			{/if}

			{#if onSwitchToChart}
				<button
					type="button"
					onclick={onSwitchToChart}
					disabled={!result || sortedRows.length === 0}
					class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-sans font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
					title="Switch to Charts & Visualizations"
				>
					<ChartColumnIcon class="size-3.5" />
					<span>Visualize</span>
				</button>
			{/if}

			<button
				type="button"
				onclick={exportCurrentView}
				disabled={!result || sortedRows.length === 0}
				class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-sans font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
				title="Export filtered results as CSV"
			>
				<DownloadIcon class="size-3" />
				Export CSV
			</button>
		</div>
	</div>

	<!-- Main Table Area (Dual-Axis Scrolling) -->
	<div class="flex-1 min-h-0 overflow-x-auto overflow-y-auto w-full select-text">
		{#if !result || result.columns.length === 0}
			<div class="flex flex-col items-center justify-center h-64 text-center p-6 space-y-2">
				<div class="flex items-center justify-center size-10 rounded-full bg-muted text-muted-foreground">
					<TableIcon class="size-5" />
				</div>
				<p class="text-sm font-medium text-foreground">No data to display</p>
				<p class="text-xs text-muted-foreground">Run a SQL query above to inspect dataset rows.</p>
			</div>
		{:else if sortedRows.length === 0}
			<div class="flex flex-col items-center justify-center h-64 text-center p-6 space-y-2">
				<p class="text-sm font-medium text-foreground">No matching rows found</p>
				<p class="text-xs text-muted-foreground">Try clearing your search query "{searchQuery}".</p>
			</div>
		{:else}
			<table class="w-max min-w-full text-left border-collapse text-xs">
				<thead class="sticky top-0 z-20 bg-muted/95 backdrop-blur-sm border-b border-border shadow-xs">
					<tr>
						<th class="w-12 px-3 py-2.5 text-center font-mono text-[11px] font-semibold text-muted-foreground/80 border-r border-border/50 sticky left-0 z-30 bg-muted/95">
							#
						</th>
						{#each result.columns as col}
							<th
								class="whitespace-nowrap min-w-[130px] px-3.5 py-2.5 font-medium select-none cursor-pointer hover:bg-muted transition-colors border-r border-border/40 last:border-r-0"
								onclick={() => handleSort(col.name)}
							>
								<div class="flex items-center justify-between gap-2.5">
									<div class="flex items-center gap-1.5">
										<span class="font-semibold text-foreground">{col.name}</span>
										<span class="inline-block px-1.5 py-0.2 rounded text-[9px] font-mono border {getTypeBadgeClass(col.type)}">
											{col.type}
										</span>
									</div>
									<div class="shrink-0 text-muted-foreground">
										{#if sortColumn === col.name}
											{#if sortAsc}
												<ArrowUpIcon class="size-3 text-primary" />
											{:else}
												<ArrowDownIcon class="size-3 text-primary" />
											{/if}
										{:else}
											<ArrowUpDownIcon class="size-3 opacity-40 hover:opacity-100" />
										{/if}
									</div>
								</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody class="divide-y divide-border/40 font-mono">
					{#each paginatedRows as row, rowIndex}
						{@const actualIndex = (currentPage - 1) * pageSize + rowIndex + 1}
						<tr class="hover:bg-muted/30 transition-colors group">
							<td class="w-12 px-3 py-2 text-center text-muted-foreground/60 border-r border-border/40 select-none bg-muted/20 sticky left-0 z-10 backdrop-blur-xs">
								{actualIndex}
							</td>
							{#each result.columns as col}
								{@const cellVal = row[col.name]}
								{@const cellKey = `${actualIndex}-${col.name}`}
								<td
									class="whitespace-nowrap px-3.5 py-2 text-foreground border-r border-border/40 last:border-r-0 relative group/cell hover:bg-primary/5 transition-colors cursor-pointer"
									onclick={() => copyToClipboard(cellVal, cellKey)}
									title="Click to copy value"
								>
									<div class="flex items-center justify-between gap-3">
										{#if cellVal === null || cellVal === undefined}
											<span class="text-muted-foreground/50 italic font-sans text-[11px]">null</span>
										{:else if typeof cellVal === 'boolean'}
											<span class={cellVal ? 'text-emerald-500 font-semibold' : 'text-rose-500 font-semibold'}>
												{String(cellVal)}
											</span>
										{:else}
											<span>{String(cellVal)}</span>
										{/if}
										<div class="opacity-0 group-hover/cell:opacity-100 transition-opacity shrink-0 ml-1 text-muted-foreground">
											{#if copiedCell === cellKey}
												<CheckIcon class="size-3 text-emerald-500" />
											{:else}
												<CopyIcon class="size-3" />
											{/if}
										</div>
									</div>
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Pagination Controls Footer -->
	{#if result && sortedRows.length > 0}
		<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-muted/20 text-xs shrink-0">
			<div class="flex items-center gap-2 text-muted-foreground">
				<span>Rows per page:</span>
				<select
					bind:value={pageSize}
					class="px-2 py-1 rounded-md border border-border bg-background text-foreground font-mono text-xs focus:outline-none"
				>
					<option value={25}>25</option>
					<option value={50}>50</option>
					<option value={100}>100</option>
					<option value={250}>250</option>
					<option value={500}>500</option>
				</select>
			</div>

			<div class="flex items-center gap-3">
				<span class="text-muted-foreground font-mono">
					Page {currentPage} of {totalPages}
				</span>

				<div class="flex items-center gap-1">
					<button
						type="button"
						onclick={() => (currentPage = Math.max(1, currentPage - 1))}
						disabled={currentPage <= 1}
						class="p-1 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
						title="Previous page"
					>
						<ChevronLeftIcon class="size-4" />
					</button>
					<button
						type="button"
						onclick={() => (currentPage = Math.min(totalPages, currentPage + 1))}
						disabled={currentPage >= totalPages}
						class="p-1 rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none transition-colors"
						title="Next page"
					>
						<ChevronRightIcon class="size-4" />
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
