<script lang="ts">
	import type { FileClassificationResponse } from '$lib/services/api';
	import AnalyticsDashboard from '$lib/components/charts/analytics-dashboard.svelte';
	import ShieldAlertIcon from '@lucide/svelte/icons/shield-alert';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import AlertTriangleIcon from '@lucide/svelte/icons/triangle-alert';
	import InfoIcon from '@lucide/svelte/icons/info';

	interface Props {
		result: FileClassificationResponse;
		onClear?: () => void;
	}

	let { result, onClear }: Props = $props();

	let showProbabilities = $state(false);

	let domain = $derived(result.classifications.domain);
	let sensitivity = $derived(result.classifications.sensitivity);
	let structure = $derived(result.classifications.data_structure);
	let priority = $derived(result.classifications.action_priority);

	function formatPercent(val?: number): string {
		if (val === undefined || isNaN(val)) return '0%';
		return `${Math.round(val * 100)}%`;
	}

	function getDomainColor(dec?: string): string {
		switch (dec) {
			case 'financial':
				return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
			case 'customer_support':
				return 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';
			case 'technical_logs':
				return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30';
			case 'hr_operations':
				return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
			default:
				return 'bg-secondary text-secondary-foreground border-border';
		}
	}

	function getSensitivityColor(sens?: string): string {
		switch (sens) {
			case 'restricted_financial':
			case 'confidential_pii':
				return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
			case 'internal':
				return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
			case 'public':
				return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
			default:
				return 'bg-secondary text-secondary-foreground border-border';
		}
	}

	function getPriorityColor(prio?: string): string {
		switch (prio) {
			case 'urgent':
				return 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40 animate-pulse';
			case 'needs_review':
				return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
			case 'routine':
				return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
			default:
				return 'bg-secondary text-secondary-foreground border-border';
		}
	}
</script>

<div class="w-full max-w-5xl mx-auto rounded-2xl border border-border bg-card shadow-lg p-6 space-y-6">
	<!-- Header Bar: File Name and Inference Latency -->
	<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
		<div class="flex items-center gap-3">
			<div class="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary">
				<FileTextIcon class="size-5" />
			</div>
			<div>
				<h3 class="text-base font-semibold text-foreground flex items-center gap-2">
					{result.filename}
					<span class="text-xs font-mono font-normal px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
						{result.format_type}
					</span>
				</h3>
				<p class="text-xs text-muted-foreground font-mono mt-0.5">
					{(result.size_bytes / 1024).toFixed(1)} KB • {result.file_summary.row_count ?? 'N/A'} rows
				</p>
			</div>
		</div>

		<div class="flex items-center gap-3 self-end sm:self-auto">
			<div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-mono font-medium">
				<ZapIcon class="size-3.5" />
				<span>{result.inference_time_ms} ms</span>
			</div>
			{#if onClear}
				<button
					type="button"
					onclick={onClear}
					class="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors cursor-pointer"
				>
					Classify another
				</button>
			{/if}
		</div>
	</div>

	<!-- 4 Classification Dimensions Grid -->
	<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
		<!-- 1. Domain -->
		<div class="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<DatabaseIcon class="size-3.5 text-primary" /> Domain
				</span>
				<span class="text-xs font-mono font-semibold text-foreground">
					{formatPercent(domain?.confidence)}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="px-2.5 py-1 rounded-lg text-sm font-semibold border {getDomainColor(domain?.decision)}">
					{domain?.decision ? domain.decision.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
				</span>
			</div>
			<div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
				<div
					class="bg-primary h-1.5 rounded-full transition-all duration-500"
					style="width: {(domain?.confidence ?? 0) * 100}%"
				></div>
			</div>
		</div>

		<!-- 2. Sensitivity -->
		<div class="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<ShieldAlertIcon class="size-3.5 text-primary" /> Sensitivity
				</span>
				<span class="text-xs font-mono font-semibold text-foreground">
					{formatPercent(sensitivity?.confidence)}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="px-2.5 py-1 rounded-lg text-sm font-semibold border {getSensitivityColor(sensitivity?.decision)}">
					{sensitivity?.decision ? sensitivity.decision.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
				</span>
			</div>
			<div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
				<div
					class="bg-primary h-1.5 rounded-full transition-all duration-500"
					style="width: {(sensitivity?.confidence ?? 0) * 100}%"
				></div>
			</div>
		</div>

		<!-- 3. Data Structure -->
		<div class="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<FileTextIcon class="size-3.5 text-primary" /> Data Structure
				</span>
				<span class="text-xs font-mono font-semibold text-foreground">
					{formatPercent(structure?.confidence)}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="px-2.5 py-1 rounded-lg text-sm font-semibold border bg-secondary text-secondary-foreground border-border">
					{structure?.decision ? structure.decision.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
				</span>
			</div>
			<div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
				<div
					class="bg-primary h-1.5 rounded-full transition-all duration-500"
					style="width: {(structure?.confidence ?? 0) * 100}%"
				></div>
			</div>
		</div>

		<!-- 4. Action Priority -->
		<div class="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
			<div class="flex items-center justify-between">
				<span class="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<AlertTriangleIcon class="size-3.5 text-primary" /> Action Priority
				</span>
				<span class="text-xs font-mono font-semibold text-foreground">
					{formatPercent(priority?.confidence)}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="px-2.5 py-1 rounded-lg text-sm font-semibold border {getPriorityColor(priority?.decision)}">
					{priority?.decision ? priority.decision.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
				</span>
			</div>
			<div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
				<div
					class="bg-primary h-1.5 rounded-full transition-all duration-500"
					style="width: {(priority?.confidence ?? 0) * 100}%"
				></div>
			</div>
		</div>
	</div>

	<!-- Toggle Probability Distribution Details -->
	<div class="pt-2">
		<button
			type="button"
			onclick={() => (showProbabilities = !showProbabilities)}
			class="text-xs font-medium text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
		>
			<InfoIcon class="size-3.5" />
			<span>{showProbabilities ? 'Hide detailed probability breakdown' : 'Show full probability distributions'}</span>
		</button>

		{#if showProbabilities}
			<div class="mt-4 p-4 rounded-xl bg-muted/40 border border-border/60 space-y-4 text-xs font-mono">
				{#each Object.entries(result.classifications) as [dimName, dec]}
					<div class="space-y-1.5">
						<div class="font-semibold text-foreground uppercase tracking-wider">{dimName}</div>
						<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
							{#if dec.probabilities}
								{#each Object.entries(dec.probabilities) as [option, prob]}
									<div class="p-2 rounded-lg bg-card border border-border/50 flex flex-col justify-between">
										<span class="truncate text-muted-foreground" title={option}>{option}</span>
										<span class="font-bold text-foreground">{(prob * 100).toFixed(1)}%</span>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Visual Analytics Dashboard (KPIs, Bar, Pie, Histogram) -->
	{#if result.analytics}
		<div class="border-t border-border/80 pt-6">
			<AnalyticsDashboard analytics={result.analytics} />
		</div>
	{/if}
</div>
