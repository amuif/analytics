<script lang="ts">
	import { streamDemoSuite, type BatchDemoResult } from '$lib/services/api';
	import PlayIcon from '@lucide/svelte/icons/play';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import XCircleIcon from '@lucide/svelte/icons/circle-x';
	import RefreshCwIcon from '@lucide/svelte/icons/rotate-cw';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import CpuIcon from '@lucide/svelte/icons/cpu';
	import ZapIcon from '@lucide/svelte/icons/zap';

	interface FileItemState {
		filename: string;
		state: 'idle' | 'classifying' | 'completed' | 'error';
		result?: BatchDemoResult;
	}

	let isStreaming = $state(false);
	let activeFilename = $state<string | null>(null);
	let error = $state<string | null>(null);

	let items = $state<FileItemState[]>([
		{ filename: 'financial_statement_2026.csv', state: 'idle' },
		{ filename: 'customer_dispute_ticket.json', state: 'idle' },
		{ filename: 'server_syslog_auth_failure.log', state: 'idle' },
		{ filename: 'employee_review_notes.txt', state: 'idle' },
		{ filename: 'sales_order_summary.csv', state: 'idle' }
	]);

	let completedCount = $derived(items.filter((i) => i.state === 'completed').length);
	let passedCount = $derived(items.filter((i) => i.result?.all_matched).length);
	let progressPercent = $derived(items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0);

	let finalAccuracy = $state<number | null>(null);

	function startStream() {
		isStreaming = true;
		error = null;
		finalAccuracy = null;
		activeFilename = null;

		// Reset items
		items = items.map((i) => ({ ...i, state: 'idle', result: undefined }));

		streamDemoSuite({
			onSuiteStart: (_total, filenames) => {
				items = filenames.map((fn) => ({ filename: fn, state: 'idle' }));
			},
			onFileStart: (filename) => {
				activeFilename = filename;
				items = items.map((it) =>
					it.filename === filename ? { ...it, state: 'classifying' } : it
				);
			},
			onFileComplete: (filename, _idx, _total, data) => {
				items = items.map((it) =>
					it.filename === filename ? { ...it, state: 'completed', result: data } : it
				);
			},
			onSuiteComplete: (summary) => {
				isStreaming = false;
				activeFilename = null;
				finalAccuracy = summary.accuracy;
			},
			onError: (err) => {
				isStreaming = false;
				activeFilename = null;
				error = err;
			}
		});
	}
</script>

<div class="w-full max-w-4xl mx-auto space-y-6">
	<!-- Actions Bar -->
	<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl border border-border bg-card shadow-sm">
		<div>
			<h3 class="text-lg font-bold text-foreground flex items-center gap-2">
				<SparklesIcon class="size-5 text-primary" />
				Live Demo Dataset Benchmark Suite
			</h3>
			<p class="text-xs sm:text-sm text-muted-foreground mt-1">
				Watch Laya classify each curated dataset in real time through streamed server-sent evaluation events.
			</p>
		</div>

		<button
			type="button"
			onclick={startStream}
			disabled={isStreaming}
			class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 cursor-pointer shrink-0"
		>
			{#if isStreaming}
				<RefreshCwIcon class="size-4 animate-spin" />
				<span>Classifying Live...</span>
			{:else}
				<PlayIcon class="size-4 fill-current" />
				<span>Run Live Demo Benchmark</span>
			{/if}
		</button>
	</div>

	<!-- Error Alert -->
	{#if error}
		<div class="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-medium">
			{error}
		</div>
	{/if}

	<!-- Live Progress Bar Header -->
	{#if isStreaming || completedCount > 0}
		<div class="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-3">
			<div class="flex items-center justify-between text-xs font-mono">
				<span class="text-muted-foreground">
					{isStreaming ? `Currently evaluating: ${activeFilename ?? '...'}` : 'Benchmark Complete'}
				</span>
				<span class="font-bold text-foreground">
					{completedCount} / {items.length} Files Evaluated ({progressPercent}%)
				</span>
			</div>
			<!-- Progress Bar -->
			<div class="w-full bg-muted rounded-full h-2 overflow-hidden">
				<div
					class="bg-primary h-2 rounded-full transition-all duration-300"
					style="width: {progressPercent}%"
				></div>
			</div>
			{#if finalAccuracy !== null}
				<div class="pt-2 flex items-center justify-between text-sm font-semibold">
					<span class="text-muted-foreground">Overall Accuracy:</span>
					<span class="text-emerald-600 dark:text-emerald-400 font-mono text-base font-bold">
						{finalAccuracy}% ({passedCount}/{items.length} Passed)
					</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Interactive File List -->
	<div class="space-y-3">
		<h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
			Datasets Under Evaluation
		</h4>

		<div class="space-y-3">
			{#each items as item}
				<div
					class="p-5 rounded-xl border transition-all duration-300 {item.state === 'classifying'
						? 'border-primary bg-primary/5 shadow-md scale-[1.01]'
						: item.state === 'completed'
							? 'border-border/80 bg-card shadow-xs'
							: 'border-border/40 bg-card/40 opacity-70'}"
				>
					<!-- Top Row: File Name & State Badge -->
					<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
						<div class="flex items-center gap-3">
							{#if item.state === 'classifying'}
								<div class="flex items-center justify-center size-9 rounded-xl bg-primary/20 text-primary">
									<CpuIcon class="size-5 animate-pulse text-primary" />
								</div>
							{:else if item.state === 'completed'}
								<div class="flex items-center justify-center size-9 rounded-xl bg-emerald-500/10 text-emerald-500">
									<CheckCircleIcon class="size-5 text-emerald-500" />
								</div>
							{:else}
								<div class="flex items-center justify-center size-9 rounded-xl bg-muted text-muted-foreground">
									<ZapIcon class="size-4" />
								</div>
							{/if}

							<div>
								<span class="text-sm font-semibold font-mono text-foreground">{item.filename}</span>
								{#if item.state === 'classifying'}
									<p class="text-xs font-medium text-primary flex items-center gap-1.5 mt-0.5">
										<RefreshCwIcon class="size-3 animate-spin" />
										<span>Evaluating with Laya System 1 model...</span>
									</p>
								{:else if item.state === 'idle'}
									<p class="text-xs text-muted-foreground/80 mt-0.5">Queued for benchmark</p>
								{/if}
							</div>
						</div>

						<div>
							{#if item.state === 'classifying'}
								<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/30 animate-pulse">
									<RefreshCwIcon class="size-3 animate-spin" /> CLASSIFYING
								</span>
							{:else if item.state === 'completed' && item.result}
								<span
									class="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-semibold {item.result.all_matched
										? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
										: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'}"
								>
									{item.result.all_matched ? '100% MATCH' : 'MISMATCH'}
								</span>
							{/if}
						</div>
					</div>

					<!-- Completed Dimension Matrix -->
					{#if item.state === 'completed' && item.result}
						<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-border/50 text-xs font-mono animate-in fade-in slide-in-from-top-1 duration-200">
							{#each Object.entries(item.result.expected) as [dim, expVal]}
								{@const predVal = item.result.predicted[dim]}
								{@const matched = item.result.matches[dim]}
								{@const conf = item.result.confidences[dim]}
								<div class="p-2.5 rounded-lg border {matched ? 'border-border/60 bg-muted/20' : 'border-rose-500/30 bg-rose-500/5'}">
									<p class="text-[10px] uppercase text-muted-foreground font-sans font-semibold">{dim.replace('_', ' ')}</p>
									<p class="font-bold {matched ? 'text-foreground' : 'text-rose-600 dark:text-rose-400'} truncate mt-1">
										{predVal ? predVal.toUpperCase() : 'UNKNOWN'}
									</p>
									<div class="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
										<span>Conf:</span>
										<span class="font-semibold text-foreground">{conf ? `${Math.round(conf * 100)}%` : 'N/A'}</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</div>
