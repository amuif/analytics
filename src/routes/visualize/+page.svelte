<script lang="ts">
	import { duckdbService } from '$lib/services/duckdb';
	import ChartView from '$lib/components/workbench/chart-view.svelte';
	import FileDropZone from '$lib/components/home/file-drop.svelte';
	import ModeToggle from '$lib/components/mode-toggle.svelte';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import TableIcon from '@lucide/svelte/icons/table';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import CodeIcon from '@lucide/svelte/icons/code';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import { Spinner } from '$lib/components/ui/spinner';
	import { goto } from '$app/navigation';

	let sampleLoading = $state<string | null>(null);

	async function handleSelectTable(tableName: string) {
		duckdbService.activeTable = tableName;
		await duckdbService.query(`SELECT * FROM "${tableName}" LIMIT 100;`);
	}

	async function handleLoadSample(type: 'iris' | 'sales' | 'stocks') {
		sampleLoading = type;
		try {
			await duckdbService.loadSampleDataset(type);
		} catch (e) {
			console.error('Failed to load sample dataset', e);
		} finally {
			sampleLoading = null;
		}
	}

	async function handleUpload(files: File[]) {
		await duckdbService.registerFiles(files);
	}
</script>

<svelte:head>
	<title>Visualizations Studio • Analytics Workbench</title>
</svelte:head>

<div class="flex flex-col h-screen w-full bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground overflow-hidden">
	<!-- Top Global Navigation Bar -->
	<header class="w-full border-b border-border/70 px-4 py-2.5 flex items-center justify-between bg-card shrink-0 z-20">
		<div class="flex items-center gap-3">
			<a
				href="/"
				class="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
				title="Home dropzone"
			>
				<ArrowLeftIcon class="size-4" />
			</a>

			<div class="flex items-center gap-2 font-bold tracking-tight text-sm">
				<div class="flex items-center justify-center size-7 rounded-lg bg-primary text-primary-foreground shadow-2xs">
					<DatabaseIcon class="size-4" />
				</div>
				<span class="font-bold">Analytics</span>
				<span class="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-500/20">
					Visuals Studio
				</span>
			</div>
		</div>

		<!-- Center View Tabs (SQL Workbench vs Visualizations) -->
		<div class="flex items-center p-1 rounded-lg border border-border bg-muted/40 shadow-2xs">
			<a
				href="/workbench"
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-background/50"
			>
				<CodeIcon class="size-3.5" />
				<span>SQL Workbench</span>
			</a>
			<div
				class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white shadow-2xs"
			>
				<ChartColumnIcon class="size-3.5" />
				<span>Visualizations</span>
			</div>
		</div>

		<!-- Right Controls & Active Table Switcher -->
		<div class="flex items-center gap-3">
			{#if duckdbService.tables.length > 0}
				<div class="flex items-center gap-2">
					<span class="text-xs font-mono text-muted-foreground hidden sm:inline">Dataset:</span>
					<select
						value={duckdbService.activeTable || ''}
						onchange={(e) => handleSelectTable((e.target as HTMLSelectElement).value)}
						class="px-2.5 py-1 text-xs font-mono font-semibold rounded-md border border-border bg-background text-foreground focus:outline-none cursor-pointer"
					>
						{#each duckdbService.tables as table}
							<option value={table.name}>
								{table.name} ({table.rowCount.toLocaleString()} rows)
							</option>
						{/each}
					</select>
				</div>
			{/if}

			<div class="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground">
				<span class="inline-block size-2 rounded-full bg-emerald-500 animate-pulse"></span>
				<span>DuckDB Engine Active</span>
			</div>

			<ModeToggle />
		</div>
	</header>

	<!-- Main Workspace Area -->
	<main class="flex-1 flex flex-col p-4 overflow-y-auto min-h-0 bg-muted/15">
		{#if duckdbService.tables.length === 0}
			<!-- Empty State when visited directly -->
			<div class="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full text-center py-10 space-y-6">
				<div class="flex items-center justify-center size-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm">
					<ChartColumnIcon class="size-8 stroke-[1.75]" />
				</div>

				<div class="space-y-2">
					<h2 class="text-2xl font-bold tracking-tight text-foreground">
						No Datasets Loaded Yet
					</h2>
					<p class="text-sm text-muted-foreground max-w-md mx-auto">
						Load an instant sample dataset or drop your own data file to unlock interactive charts and distributions.
					</p>
				</div>

				<!-- Quick Sample Buttons -->
				<div class="flex flex-wrap items-center justify-center gap-3">
					<button
						type="button"
						onclick={() => handleLoadSample('iris')}
						disabled={!!sampleLoading}
						class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-2xs hover:scale-102 cursor-pointer disabled:opacity-50"
					>
						{#if sampleLoading === 'iris'}
							<Spinner class="size-3.5" />
						{:else}
							<TableIcon class="size-3.5 text-emerald-500" />
						{/if}
						<span>Iris Flowers</span>
					</button>

					<button
						type="button"
						onclick={() => handleLoadSample('sales')}
						disabled={!!sampleLoading}
						class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-2xs hover:scale-102 cursor-pointer disabled:opacity-50"
					>
						{#if sampleLoading === 'sales'}
							<Spinner class="size-3.5" />
						{:else}
							<TableIcon class="size-3.5 text-sky-500" />
						{/if}
						<span>Superstore Sales</span>
					</button>

					<button
						type="button"
						onclick={() => handleLoadSample('stocks')}
						disabled={!!sampleLoading}
						class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-foreground transition-all shadow-2xs hover:scale-102 cursor-pointer disabled:opacity-50"
					>
						{#if sampleLoading === 'stocks'}
							<Spinner class="size-3.5" />
						{:else}
							<TableIcon class="size-3.5 text-amber-500" />
						{/if}
						<span>Tech Stocks</span>
					</button>
				</div>

				<div class="w-full pt-4">
					<FileDropZone onUpload={handleUpload} />
				</div>
			</div>
		{:else}
			<!-- Full-Page Visualization View -->
			<div class="flex-1 flex flex-col min-h-0 gap-3">
				<!-- Subheader with Active Dataset Info -->
				<div class="flex flex-wrap items-center justify-between gap-3 px-1 shrink-0">
					<div class="flex items-center gap-3">
						<div class="flex items-center gap-2">
							<LayersIcon class="size-4 text-indigo-600 dark:text-indigo-400" />
							<span class="text-sm font-bold tracking-tight text-foreground font-mono">
								{duckdbService.activeTable}
							</span>
						</div>
						{#if duckdbService.queryResult}
							<span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-background border border-border text-muted-foreground shadow-2xs">
								{duckdbService.queryResult.rowCount.toLocaleString()} rows • {duckdbService.queryResult.columns.length} columns
							</span>
						{/if}
					</div>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => goto('/workbench')}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-2xs cursor-pointer"
						>
							<CodeIcon class="size-3.5 text-muted-foreground" />
							<span>Open in SQL Workbench</span>
						</button>
					</div>
				</div>

				<!-- Full-Screen Chart Canvas Card -->
				<div class="flex-1 min-h-0 flex flex-col">
					<ChartView
						result={duckdbService.queryResult}
						isFullScreen={true}
						onSwitchToGrid={() => goto('/workbench')}
					/>
				</div>
			</div>
		{/if}
	</main>
</div>
