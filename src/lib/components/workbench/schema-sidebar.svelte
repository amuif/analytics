<script lang="ts">
	import type { TableMetadata } from '$lib/services/duckdb';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import TableIcon from '@lucide/svelte/icons/table';

	interface Props {
		tables: TableMetadata[];
		activeTable: string | null;
		onSelectTable: (name: string) => void;
		onDropTable: (name: string) => void;
		onQuickQuery: (sql: string) => void;
		onUploadFiles: (files: File[]) => Promise<void> | void;
	}

	let {
		tables,
		activeTable,
		onSelectTable,
		onDropTable,
		onQuickQuery,
		onUploadFiles
	}: Props = $props();

	let expandedTables = $state<Record<string, boolean>>({});
	let fileInputRef: HTMLInputElement | null = null;

	function toggleExpand(name: string, e: MouseEvent) {
		e.stopPropagation();
		expandedTables[name] = !expandedTables[name];
	}

	function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			onUploadFiles(Array.from(target.files));
			target.value = '';
		}
	}
</script>

<aside class="flex flex-col h-full bg-card border-r border-border w-64 lg:w-72 shrink-0 select-none overflow-hidden">
	<!-- Sidebar Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
		<div class="flex items-center gap-2">
			<DatabaseIcon class="size-4 text-primary" />
			<span class="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
				Datasets ({tables.length})
			</span>
		</div>
		<button
			type="button"
			onclick={() => fileInputRef?.click()}
			class="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
			title="Import additional dataset"
		>
			<PlusIcon class="size-3.5" />
		</button>
		<input
			type="file"
			bind:this={fileInputRef}
			onchange={handleFileSelect}
			multiple
			accept=".csv,.parquet,.json,.arrow,.sqlite,.tsv,.txt"
			class="hidden"
		/>
	</div>

	<!-- Tables List -->
	<div class="flex-1 overflow-y-auto p-2 space-y-1">
		{#if tables.length === 0}
			<div class="flex flex-col items-center justify-center p-6 text-center space-y-2">
				<TableIcon class="size-8 text-muted-foreground/50" />
				<p class="text-xs font-medium text-foreground">No tables loaded</p>
				<p class="text-[11px] text-muted-foreground">Drop a file or click Add to import data.</p>
			</div>
		{:else}
			{#each tables as table}
				{@const isExpanded = !!expandedTables[table.name]}
				{@const isActive = activeTable === table.name}
				<div class="rounded-xl border {isActive ? 'border-primary/40 bg-primary/5' : 'border-border/60 bg-card/60'} overflow-hidden transition-all shadow-2xs">
					<!-- Table Header Item -->
					<div
						role="button"
						tabindex="0"
						class="flex items-center justify-between p-2.5 cursor-pointer hover:bg-muted/40 transition-colors group"
						onclick={() => onSelectTable(table.name)}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								onSelectTable(table.name);
							}
						}}
					>
						<div class="flex items-center gap-2 min-w-0">
							<button
								type="button"
								onclick={(e) => toggleExpand(table.name, e)}
								class="p-0.5 rounded text-muted-foreground hover:text-foreground"
							>
								{#if isExpanded}
									<ChevronDownIcon class="size-3.5" />
								{:else}
									<ChevronRightIcon class="size-3.5" />
								{/if}
							</button>
							<div class="min-w-0">
								<p class="text-xs font-semibold font-mono text-foreground truncate">
									{table.name}
								</p>
								<p class="text-[10px] text-muted-foreground font-mono">
									{table.rowCount.toLocaleString()} rows • {table.columns.length} cols
								</p>
							</div>
						</div>

						<!-- Action Icons -->
						<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									onQuickQuery(`SUMMARIZE "${table.name}";`);
								}}
								class="p-1 rounded hover:bg-muted text-amber-500"
								title="Summarize table statistics"
							>
								<SparklesIcon class="size-3" />
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									onDropTable(table.name);
								}}
								class="p-1 rounded hover:bg-destructive/20 text-destructive"
								title="Delete table"
							>
								<Trash2Icon class="size-3" />
							</button>
						</div>
					</div>

					<!-- Expanded Columns List -->
					{#if isExpanded}
						<div class="px-3 pb-2.5 pt-1 space-y-1 border-t border-border/40 bg-muted/10">
							{#each table.columns as col}
								<div class="flex items-center justify-between text-[11px] font-mono py-0.5">
									<span class="text-foreground truncate mr-2">{col.name}</span>
									<span class="text-[9px] text-muted-foreground font-semibold px-1 py-0.2 rounded bg-muted border border-border/50 shrink-0">
										{col.type}
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Compact Drag and Drop Bottom Footer -->
	<div class="p-3 border-t border-border bg-muted/10">
		<button
			type="button"
			onclick={() => fileInputRef?.click()}
			class="flex flex-col items-center justify-center w-full p-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-center group cursor-pointer"
		>
			<UploadIcon class="size-4 text-muted-foreground group-hover:text-primary transition-colors mb-1" />
			<span class="text-xs font-medium text-foreground">Add Dataset</span>
			<span class="text-[10px] text-muted-foreground">Drop files or click here</span>
		</button>
	</div>
</aside>
