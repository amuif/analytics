<script lang="ts">
	import { onMount } from 'svelte';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import CpuIcon from '@lucide/svelte/icons/cpu';
	import RefreshCwIcon from '@lucide/svelte/icons/rotate-cw';

	interface Props {
		fileName: string;
		fileSize?: number;
	}

	let { fileName, fileSize }: Props = $props();

	let elapsedSeconds = $state(0);
	let currentStageIndex = $state(1);

	const stages = [
		{ label: 'Inspecting bytes & extracting preview schema', completedAfter: 0.1 },
		{ label: 'Injecting state into Laya System 1 decision engine', completedAfter: 0.3 },
		{ label: 'Resolving domain, sensitivity, format & priority', completedAfter: 0.6 },
		{ label: 'Calibrating confidence scores & probabilities', completedAfter: 0.9 }
	];

	onMount(() => {
		const start = performance.now();
		const timer = setInterval(() => {
			elapsedSeconds = (performance.now() - start) / 1000;
			if (elapsedSeconds > 0.9) currentStageIndex = 3;
			else if (elapsedSeconds > 0.5) currentStageIndex = 2;
			else if (elapsedSeconds > 0.2) currentStageIndex = 1;
		}, 50);

		return () => clearInterval(timer);
	});
</script>

<div class="w-full max-w-2xl mx-auto p-8 rounded-2xl border border-primary/40 bg-card/90 backdrop-blur-md shadow-xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
	<!-- Top Bar -->
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div class="relative flex items-center justify-center size-12 rounded-2xl bg-primary/10 text-primary">
				<CpuIcon class="size-6 animate-pulse text-primary" />
				<span class="absolute -top-1 -right-1 flex size-3">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
					<span class="relative inline-flex rounded-full size-3 bg-primary"></span>
				</span>
			</div>
			<div>
				<h3 class="text-base font-bold text-foreground">Laya Classifier in Action</h3>
				<p class="text-xs font-mono text-muted-foreground truncate max-w-sm mt-0.5">
					{fileName} {#if fileSize}• {(fileSize / 1024).toFixed(1)} KB{/if}
				</p>
			</div>
		</div>

		<div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-mono font-medium text-foreground">
			<ZapIcon class="size-3.5 text-primary" />
			<span>{elapsedSeconds.toFixed(2)}s</span>
		</div>
	</div>

	<!-- Simulated Scanning Radar Visualizer -->
	<div class="relative w-full h-24 rounded-xl bg-muted/30 border border-border/70 overflow-hidden flex items-center justify-center p-4">
		<!-- Animated scanning beam -->
		<div class="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse"></div>
		
		<div class="z-10 flex items-center gap-4 text-xs font-mono text-muted-foreground">
			<RefreshCwIcon class="size-5 animate-spin text-primary shrink-0" />
			<span>Single-pass non-autoregressive decision inference in progress...</span>
		</div>
	</div>

	<!-- Real-time Pipeline Stages -->
	<div class="space-y-3 pt-2">
		{#each stages as stage, idx}
			<div class="flex items-center gap-3 text-xs font-medium transition-all duration-300">
				{#if idx < currentStageIndex}
					<CheckCircleIcon class="size-4.5 text-emerald-500 shrink-0" />
					<span class="text-foreground">{stage.label}</span>
				{:else if idx === currentStageIndex}
					<div class="size-4.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0"></div>
					<span class="text-primary font-semibold">{stage.label}...</span>
				{:else}
					<div class="size-4.5 rounded-full border border-border/80 bg-muted/40 shrink-0"></div>
					<span class="text-muted-foreground/60">{stage.label}</span>
				{/if}
			</div>
		{/each}
	</div>
</div>
