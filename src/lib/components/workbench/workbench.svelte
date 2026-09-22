<script lang="ts">
	import { duckdbService } from '$lib/services/duckdb';
	import SchemaSidebar from './schema-sidebar.svelte';
	import SqlEditor from './sql-editor.svelte';
	import DataGrid from './data-grid.svelte';
	import ChartView from './chart-view.svelte';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import TableIcon from '@lucide/svelte/icons/table';
	import ChartColumnIcon from '@lucide/svelte/icons/chart-column';
	import ModeToggle from '$lib/components/mode-toggle.svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PanelLeftIcon from '@lucide/svelte/icons/panel-left';

	interface Props {
		onBackToHome?: () => void;
	}

	let { onBackToHome }: Props = $props();

	type TabType = 'grid' | 'chart';
	let activeTab = $state<TabType>('grid');
	let isSidebarOpen = $state(true);

	async function handleExecuteQuery(sql: string) {
		try {
			await duckdbService.query(sql);
		} catch (e) {
			console.error('SQL Execution error', e);
		}
	}

	async function handleSelectTable(tableName: string) {
		duckdbService.activeTable = tableName;
		await duckdbService.query(`SELECT * FROM "${tableName}" LIMIT 100;`);
	}

	async function handleDropTable(tableName: string) {
		await duckdbService.dropTable(tableName);
		if (duckdbService.tables.length === 0 && onBackToHome) {
			onBackToHome();
		}
	}

	async function handleUploadFiles(files: File[]) {
		await duckdbService.registerFiles(files);
	}
</script>

<div class="flex flex-col h-screen w-full bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground overflow-hidden">
	<!-- Global Workbench Top Navbar -->
	<header class="w-full border-b border-border/70 px-4 py-2.5 flex items-center justify-between bg-card shrink-0 z-20">
		<div class="flex items-center gap-3">
			{#if onBackToHome}
				<button
					type="button"
					onclick={onBackToHome}
					class="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
					title="Return to Home dropzone"
				>
					<ArrowLeftIcon class="size-4" />
				</button>
			{/if}

			<button
				type="button"
				onclick={() => (isSidebarOpen = !isSidebarOpen)}
				class="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
				title="Toggle sidebar"
			>
				<PanelLeftIcon class="size-4" />
			</button>

			<div class="flex items-center gap-2 font-bold tracking-tight text-sm">
				<div class="flex items-center justify-center size-7 rounded-lg bg-primary text-primary-foreground shadow-2xs">
					<DatabaseIcon class="size-4" />
				</div>
				<span class="font-bold">Analytics Workbench</span>
			</div>
		</div>

		<!-- Center View Tabs (Data Grid vs Visualizations) -->
		<div class="flex items-center p-1 rounded-lg border border-border bg-muted/40">
			<button
				type="button"
				onclick={() => (activeTab = 'grid')}
				class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer {activeTab === 'grid' ? 'bg-background text-foreground shadow-2xs border border-border/80' : 'text-muted-foreground hover:text-foreground'}"
			>
				<TableIcon class="size-3.5" />
				<span>Data Grid</span>
			</button>
			<button
				type="button"
				onclick={() => (activeTab = 'chart')}
				class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer {activeTab === 'chart' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
			>
				<ChartColumnIcon class="size-3.5" />
				<span>Visualizations</span>
			</button>
		</div>

		<!-- Right Controls -->
		<div class="flex items-center gap-3">
			<div class="hidden sm:flex items-center gap-2 text-xs font-mono text-muted-foreground">
				<span class="inline-block size-2 rounded-full bg-emerald-500 animate-pulse"></span>
				<span>DuckDB Engine Active</span>
			</div>
			<ModeToggle />
		</div>
	</header>

	<!-- Main Workspace Body -->
	<div class="flex-1 flex min-h-0 overflow-hidden">
		<!-- Left Sidebar -->
		{#if isSidebarOpen}
			<SchemaSidebar
				tables={duckdbService.tables}
				activeTable={duckdbService.activeTable}
				onSelectTable={handleSelectTable}
				onDropTable={handleDropTable}
				onQuickQuery={handleExecuteQuery}
				onUploadFiles={handleUploadFiles}
			/>
		{/if}

		<!-- Center Main Working Surface -->
		<main class="flex-1 flex flex-col p-4 gap-4 overflow-y-auto min-h-0 min-w-0 bg-muted/15">
			<!-- SQL Editor Panel -->
			<div class="shrink-0">
				<SqlEditor
					activeTable={duckdbService.activeTable}
					isQuerying={duckdbService.isQuerying}
					queryResult={duckdbService.queryResult}
					error={duckdbService.error}
					history={duckdbService.history}
					onExecute={handleExecuteQuery}
				/>
			</div>

			<!-- Result Display Section with prominent view switcher -->
			<div class="flex flex-col gap-3 flex-1 min-h-0">
				<!-- Section Switcher Bar -->
				<div class="flex flex-wrap items-center justify-between gap-2 px-1 shrink-0">
					<div class="flex items-center gap-2">
						<span class="text-xs font-bold uppercase tracking-wider text-muted-foreground">Results</span>
						{#if duckdbService.queryResult}
							<span class="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-background border border-border text-foreground shadow-2xs">
								{duckdbService.queryResult.rowCount.toLocaleString()} rows • {duckdbService.queryResult.columns.length} columns
							</span>
						{/if}
					</div>

					<!-- Segmented Control Tabs -->
					<div class="flex items-center p-1 rounded-lg border border-border bg-card shadow-2xs">
						<button
							type="button"
							onclick={() => (activeTab = 'grid')}
							class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer {activeTab === 'grid' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
						>
							<TableIcon class="size-3.5" />
							<span>Data Grid</span>
						</button>
						<button
							type="button"
							onclick={() => (activeTab = 'chart')}
							class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer {activeTab === 'chart' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-muted-foreground hover:text-foreground'}"
						>
							<ChartColumnIcon class="size-3.5" />
							<span>Charts & Visualizations</span>
							<span class="px-1.5 py-0.2 rounded text-[10px] font-bold {activeTab === 'chart' ? 'bg-white/20 text-white' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'}">
								5 Types
							</span>
						</button>
					</div>
				</div>

				<!-- Content Box -->
				<div class="flex-1 min-h-[350px] min-h-0 flex flex-col">
					{#if activeTab === 'grid'}
						<DataGrid
							result={duckdbService.queryResult}
							onSwitchToChart={() => (activeTab = 'chart')}
						/>
					{:else}
						<ChartView
							result={duckdbService.queryResult}
							onSwitchToGrid={() => (activeTab = 'grid')}
						/>
					{/if}
				</div>
			</div>
		</main>
	</div>
</div>
