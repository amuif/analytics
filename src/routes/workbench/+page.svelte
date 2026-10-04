<script lang="ts">
	import Workbench from '$lib/components/workbench/workbench.svelte';
	import { duckdbService } from '$lib/services/duckdb';
	import FileDropZone from '$lib/components/home/file-drop.svelte';
	import ModeToggle from '$lib/components/mode-toggle.svelte';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import TableIcon from '@lucide/svelte/icons/table';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CodeIcon from '@lucide/svelte/icons/code';
	import { Spinner } from '$lib/components/ui/spinner';
	import { goto } from '$app/navigation';

	let sampleLoading = $state<string | null>(null);

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
	<title>SQL Workbench • Analytics</title>
</svelte:head>

{#if duckdbService.tables.length > 0}
	<Workbench onBackToHome={() => goto('/')} />
{:else}
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
					<span class="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
						Workbench
					</span>
				</div>
			</div>

			<!-- Center View Tabs (SQL Workbench vs Visualizations) -->
			<div class="flex items-center p-1 rounded-lg border border-border bg-muted/40 shadow-2xs">
				<div class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground shadow-2xs">
					<CodeIcon class="size-3.5" />
					<span>SQL Workbench</span>
				</div>
				<a
					href="/visualize"
					class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all text-muted-foreground hover:text-foreground hover:bg-background/50"
				>
					<ChartColumnIcon class="size-3.5" />
					<span>Visualizations</span>
				</a>
			</div>

			<ModeToggle />
		</header>

		<!-- Empty State -->
		<main class="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto min-h-0 bg-muted/15">
			<div class="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full text-center py-10 space-y-6">
				<div class="flex items-center justify-center size-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-sm">
					<CodeIcon class="size-8 stroke-[1.75]" />
				</div>

				<div class="space-y-2">
					<h2 class="text-2xl font-bold tracking-tight text-foreground">
						No Datasets Loaded Yet
					</h2>
					<p class="text-sm text-muted-foreground max-w-md mx-auto">
						Import a file or select a sample dataset to open the SQL editor, run queries, and inspect schema.
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
		</main>
	</div>
{/if}
