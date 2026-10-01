<script lang="ts">
	import PlayIcon from '@lucide/svelte/icons/play';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import HistoryIcon from '@lucide/svelte/icons/history';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { Spinner } from '$lib/components/ui/spinner';
	import type { QueryResult } from '$lib/services/duckdb';

	interface Props {
		activeTable: string | null;
		isQuerying: boolean;
		queryResult: QueryResult | null;
		error: string | null;
		history: string[];
		onExecute: (sql: string) => Promise<void> | void;
	}

	let {
		activeTable,
		isQuerying,
		queryResult,
		error,
		history,
		onExecute
	}: Props = $props();

	let sqlQuery = $state('');
	let showHistory = $state(false);
	let showSnippets = $state(false);

	// Synchronize default query when activeTable changes and query is empty
	$effect(() => {
		if (activeTable && (!sqlQuery || sqlQuery.startsWith('SELECT * FROM '))) {
			sqlQuery = `SELECT * FROM "${activeTable}" LIMIT 100;`;
		}
	});

	function handleKeyDown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			runQuery();
		}
	}

	async function runQuery() {
		if (!sqlQuery.trim() || isQuerying) return;
		showHistory = false;
		showSnippets = false;
		await onExecute(sqlQuery);
	}

	function applySnippet(template: string) {
		if (!activeTable) return;
		sqlQuery = template.replace(/\{table\}/g, activeTable);
		showSnippets = false;
		runQuery();
	}

	function applyHistory(query: string) {
		sqlQuery = query;
		showHistory = false;
		runQuery();
	}

	const snippets = [
		{
			label: 'Preview Top 100 Rows',
			desc: 'Fast glance at dataset columns and sample values',
			sql: 'SELECT * FROM "{table}" LIMIT 100;'
		},
		{
			label: 'Statistical Summary (SUMMARIZE)',
			desc: 'DuckDB built-in summary of min, max, avg, nulls, and quantiles',
			sql: 'SUMMARIZE "{table}";'
		},
		{
			label: 'Count Total Rows',
			desc: 'Exact total number of rows in the table',
			sql: 'SELECT COUNT(*) AS total_rows FROM "{table}";'
		},
		{
			label: 'Column Value Counts',
			desc: 'Group by a column and count occurrences',
			sql: 'SELECT * FROM (\n  SELECT *, COUNT(*) OVER() as total_count \n  FROM "{table}"\n) LIMIT 50;'
		}
	];
</script>

<div class="flex flex-col bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
	<!-- Editor Header / Action Bar -->
	<div class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-muted/20">
		<div class="flex items-center gap-2">
			<span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
				SQL Editor
			</span>
			{#if activeTable}
				<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-primary/10 text-primary border border-primary/20 font-medium">
					"{activeTable}"
				</span>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			<!-- Snippets Menu Dropdown -->
			<div class="relative">
				<button
					type="button"
					onclick={() => (showSnippets = !showSnippets)}
					class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
				>
					<SparklesIcon class="size-3.5 text-amber-500" />
					<span>Snippets</span>
					<ChevronDownIcon class="size-3 opacity-60" />
				</button>

				{#if showSnippets}
					<div
						class="absolute right-0 top-full mt-1.5 w-72 rounded-xl border border-border bg-popover text-popover-foreground shadow-lg z-30 p-1.5 space-y-1 animate-in fade-in-50 zoom-in-95 duration-100"
					>
						{#each snippets as snippet}
							<button
								type="button"
								onclick={() => applySnippet(snippet.sql)}
								class="w-full text-left p-2 rounded-lg hover:bg-muted transition-colors group"
							>
								<div class="text-xs font-semibold text-foreground group-hover:text-primary">
									{snippet.label}
								</div>
								<div class="text-[11px] text-muted-foreground mt-0.5 leading-snug">
									{snippet.desc}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- History Menu Dropdown -->
			<div class="relative">
				<button
					type="button"
					onclick={() => (showHistory = !showHistory)}
					disabled={history.length === 0}
					class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
				>
					<HistoryIcon class="size-3.5" />
					<span>History ({history.length})</span>
					<ChevronDownIcon class="size-3 opacity-60" />
				</button>

				{#if showHistory}
					<div
						class="absolute right-0 top-full mt-1.5 w-80 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg z-30 p-1.5 space-y-1 divide-y divide-border/40 animate-in fade-in-50 zoom-in-95 duration-100"
					>
						{#each history as q}
							<button
								type="button"
								onclick={() => applyHistory(q)}
								class="w-full text-left p-2 rounded-lg hover:bg-muted font-mono text-[11px] text-foreground truncate transition-colors"
								title={q}
							>
								{q}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Run Query Button -->
			<button
				type="button"
				onclick={runQuery}
				disabled={isQuerying || !sqlQuery.trim()}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
			>
				{#if isQuerying}
					<Spinner class="size-3.5" />
					<span>Running...</span>
				{:else}
					<PlayIcon class="size-3.5 fill-current" />
					<span>Run Query</span>
				{/if}
			</button>
		</div>
	</div>

	<!-- SQL Input Box -->
	<div class="relative bg-background">
		<textarea
			bind:value={sqlQuery}
			onkeydown={handleKeyDown}
			rows={4}
			spellcheck="false"
			placeholder="Write SQL query (e.g. SELECT * FROM table LIMIT 100;)..."
			class="w-full p-3 font-mono text-xs sm:text-sm bg-transparent text-foreground placeholder:text-muted-foreground/60 resize-y focus:outline-none leading-relaxed border-0"
		></textarea>
		<div class="absolute right-3 bottom-2.5 text-[10px] font-mono text-muted-foreground/60 select-none pointer-events-none">
			Press <kbd class="px-1 py-0.5 rounded border border-border bg-muted">Ctrl</kbd> + <kbd class="px-1 py-0.5 rounded border border-border bg-muted">Enter</kbd> to run
		</div>
	</div>

	<!-- Query Execution Info & Error Bar -->
	{#if error}
		<div class="flex items-start gap-2.5 px-4 py-2.5 border-t border-destructive/30 bg-destructive/10 text-destructive text-xs">
			<AlertCircleIcon class="size-4 shrink-0 mt-0.5" />
			<div class="font-mono whitespace-pre-wrap leading-relaxed">{error}</div>
		</div>
	{:else if queryResult}
		<div class="flex items-center justify-between gap-4 px-4 py-2 border-t border-border/60 bg-muted/15 text-[11px] font-mono text-muted-foreground">
			<div class="flex items-center gap-3">
				<span class="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
					<CheckCircleIcon class="size-3.5" />
					Success
				</span>
				<span>•</span>
				<span>{queryResult.rowCount.toLocaleString()} rows returned</span>
			</div>
			<div class="flex items-center gap-1.5">
				<ClockIcon class="size-3" />
				<span>{queryResult.executionTimeMs} ms</span>
			</div>
		</div>
	{/if}
</div>
