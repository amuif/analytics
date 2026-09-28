<script lang="ts">
	import { onMount } from 'svelte';
	import FileDropZone from '$lib/components/home/file-drop.svelte';
	import ResultCard from '$lib/components/classification/result-card.svelte';
	import DemoRunner from '$lib/components/classification/demo-runner.svelte';
	import ClassifyingLoader from '$lib/components/classification/classifying-loader.svelte';
	import ModeToggle from '$lib/components/mode-toggle.svelte';
	import { fetchHealth, classifyFile, loadZeeDemoAnalytics, type FileClassificationResponse, type HealthResponse } from '$lib/services/api';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import PlayIcon from '@lucide/svelte/icons/play';
	import ClipboardIcon from '@lucide/svelte/icons/clipboard';

	let activeTab = $state<'upload' | 'paste' | 'demo'>('upload');
	let health = $state<HealthResponse | null>(null);
	let isBackendConnected = $state<boolean>(false);
	let currentResult = $state<FileClassificationResponse | null>(null);
	let isClassifying = $state(false);
	let activeFileName = $state('dataset.csv');
	let activeFileSize = $state<number | undefined>(undefined);
	let errorMsg = $state<string | null>(null);
	let pastedText = $state<string>('');

	async function handleLoadZeeDemo() {
		isClassifying = true;
		errorMsg = null;
		activeFileName = 'zee_ecommerce_report_2026.csv';
		activeFileSize = 2840;
		try {
			const res = await loadZeeDemoAnalytics();
			currentResult = res;
		} catch (err: any) {
			errorMsg = err.message || 'Failed to load ZEE e-commerce report analytics';
		} finally {
			isClassifying = false;
		}
	}

	async function handleClassifyPastedText() {
		if (!pastedText.trim()) return;
		isClassifying = true;
		errorMsg = null;
		activeFileName = 'pasted_dataset.csv';
		activeFileSize = new Blob([pastedText]).size;
		try {
			const file = new File([pastedText], 'pasted_dataset.csv', { type: 'text/csv' });
			const res = await classifyFile(file);
			currentResult = res;
		} catch (err: any) {
			errorMsg = err.message || 'Failed to classify pasted text';
		} finally {
			isClassifying = false;
		}
	}

	function loadSampleHardwareSales() {
		pastedText = `Sale ID,Contact,Sex,Age,State,Product ID,Product Type,Sale Price,Profit,Lead,Month,Year
1,Paul Thomas,M,43,OH,M01-F0024,Desktop,479.99,143.39,Website,January,2018
2,Margo Simms,F,37,WV,GT13-0024,Desktop,1249.99,230.89,Flyer 4,January,2018
3,Sam Stine,M,26,PA,I3670,Desktop,649.99,118.64,Website,February,2018
4,Moe Eggert,M,35,PA,I3593,Laptop,399.99,72.09,Website,March,2018
5,Jessica Elk,F,55,PA,15M-ED,Laptop,699.99,98.09,Flyer 4,March,2018
6,Sally Struthers,F,45,PA,GT13-0024,Desktop,1249.99,230.89,Flyer 2,April,2018
7,Michelle Samms,F,46,OH,GA401IV,Laptop,1349.99,180.34,Email,May,2018
8,Mick Roberts,M,23,OH,MY2J2LL,Tablet,999.99,146.69,Website,July,2018
9,Ed Klondike,M,52,OH,81TC00,Laptop,649.99,122.34,Email,July,2018
10,Phil Jones,M,56,WV,M01-F0024,Desktop,479.99,143.39,Flyer 2,August,2018
11,Rick James,M,49,PA,GA401IV,Laptop,1349.99,180.34,Flyer 3,November,2018
12,Sue Etna,F,54,OH,GT13-0024,Desktop,1249.99,230.89,Flyer 2,November,2018
13,Jason Case,M,57,PA,81TC00,Laptop,649.99,122.34,Email,November,2018
14,Doug Johnson,M,51,PA,I3670,Desktop,649.99,118.64,Website,December,2018
15,Andy Sands,M,56,OH,MY2J2LL,Tablet,999.99,146.69,Flyer 1,December,2018
16,Kim Collins,F,49,PA,I3593,Laptop,399.99,72.09,Flyer 2,January,2019
17,Edna Sanders,F,46,OH,15M-ED,Laptop,699.99,98.09,Email,February,2019
18,Michelle Samms,F,46,NY,MY2J2LL,Tablet,999.99,146.69,Website,March,2019
19,Mick Roberts,M,23,PA,I3593,Laptop,399.99,72.09,Flyer 4,March,2019
20,Sally Struthers,F,45,NY,81TC00,Laptop,649.99,122.34,Website,April,2019
21,Jason Case,M,57,PA,M01-F0024,Desktop,479.99,143.39,Flyer 4,May,2019
22,Doug Johnson,M,51,PA,GA401IV,Laptop,1349.99,180.34,Website,August,2019
23,Paul Thomas,M,43,OH,81TC00,Laptop,649.99,122.34,Website,August,2019
24,Margo Simms,F,37,WV,Q526FA,Laptop,1049.99,143.09,Flyer 4,November,2019
25,Michelle Samms,F,46,NY,I3670,Desktop,649.99,118.64,Flyer 2,November,2019
26,Mick Roberts,M,23,PA,Q526FA,Laptop,1049.99,143.09,Email,November,2019
27,Ed Klondike,M,52,OH,Q526FA,Laptop,1049.99,143.09,Website,December,2019
28,Moe Eggert,M,35,PA,15M-ED,Laptop,699.99,98.09,Email,December,2019
29,Jessica Elk,F,55,PA,GA401IV,Laptop,1349.99,180.34,Flyer 2,December,2019
30,Phil Jones,M,56,WV,M01-F0024,Desktop,479.99,143.39,Flyer 2,January,2020
31,Rick James,M,49,PA,GA401IV,Laptop,1349.99,180.34,Flyer 1,January,2020
32,Sue Etna,F,54,OH,GT13-0024,Desktop,1249.99,230.89,Flyer 2,February,2020
33,Kim Collins,F,49,PA,I3593,Laptop,399.99,72.09,Flyer 2,March,2020
34,Edna Sanders,F,46,OH,15M-ED,Laptop,699.99,98.09,Email,March,2020
35,Michelle Samms,F,46,NY,MY2J2LL,Tablet,999.99,146.69,Website,April,2020
36,Sally Struthers,F,45,NY,81TC00,Laptop,649.99,122.34,Website,April,2020
37,Jason Case,M,57,PA,M01-F0024,Desktop,479.99,143.39,Flyer 4,April,2020
38,Doug Johnson,M,51,PA,GA401IV,Laptop,1349.99,180.34,Website,May,2020
39,Moe Eggert,M,35,PA,I3593,Laptop,399.99,72.09,Website,May,2020`;
	}

	async function checkBackend() {
		try {
			health = await fetchHealth();
			isBackendConnected = health.status === 'ok';
		} catch {
			isBackendConnected = false;
		}
	}

	onMount(() => {
		checkBackend();
		const interval = setInterval(checkBackend, 15000);
		return () => clearInterval(interval);
	});

	function handleClassifyingStart(file: File) {
		isClassifying = true;
		activeFileName = file.name;
		activeFileSize = file.size;
		currentResult = null;
	}

	function handleClassified(res: FileClassificationResponse) {
		isClassifying = false;
		currentResult = res;
	}

	function handleClear() {
		currentResult = null;
		isClassifying = false;
	}
</script>

<main class="min-h-screen flex flex-col justify-between bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
	<!-- Top Navigation Header -->
	<header class="w-full border-b border-border/40 px-6 py-4 flex items-center justify-between">
		<div class="flex items-center gap-3 font-bold tracking-tight text-lg">
			<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground shadow-xs">
				<DatabaseIcon class="size-4.5" />
			</div>
			<span>Analytics Classifier</span>
			<span class="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border">
				v1.0
			</span>
		</div>

		<!-- Status Badge & Mode Toggle -->
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2 text-xs font-mono">
				{#if isBackendConnected && health?.model_loaded}
					<span class="inline-block size-2 rounded-full bg-emerald-500 animate-pulse"></span>
					<span class="text-emerald-600 dark:text-emerald-400 font-medium">Laya Engine Ready (FastAPI)</span>
				{:else if isBackendConnected}
					<span class="inline-block size-2 rounded-full bg-amber-500 animate-pulse"></span>
					<span class="text-amber-600 dark:text-amber-400">Loading Weights...</span>
				{:else}
					<span class="inline-block size-2 rounded-full bg-rose-500"></span>
					<span class="text-rose-600 dark:text-rose-400">Backend Offline</span>
				{/if}
			</div>

			<ModeToggle />
		</div>
	</header>

	<!-- Main Workspace Section -->
	<section class="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 py-10 max-w-5xl mx-auto w-full space-y-8">
		<!-- Hero Badge & Title -->
		<div class="text-center space-y-3 max-w-2xl mx-auto">
			<div class="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-secondary/80 text-secondary-foreground border border-border shadow-2xs">
				<SparklesIcon class="size-3.5 text-primary" />
				<span>FastAPI • Laya System 1 Decision Classifier</span>
			</div>
			<h1 class="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
				Classify file datasets at lightspeed
			</h1>
			<p class="text-sm sm:text-base text-muted-foreground leading-relaxed">
				Drop any dataset or document to run instant single-pass categorization across business domain, data structure, confidentiality, and action priority.
			</p>
		</div>

		<!-- Tab Navigation Buttons -->
		<div class="flex items-center p-1 rounded-xl bg-muted/60 border border-border/80 shadow-2xs">
			<button
				type="button"
				onclick={() => { activeTab = 'upload'; currentResult = null; }}
				class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer {activeTab === 'upload'
					? 'bg-card text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<LayersIcon class="size-4" />
				<span>File Upload</span>
			</button>
			<button
				type="button"
				onclick={() => { activeTab = 'paste'; currentResult = null; }}
				class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer {activeTab === 'paste'
					? 'bg-card text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<ClipboardIcon class="size-4" />
				<span>Paste Raw CSV</span>
			</button>
			<button
				type="button"
				onclick={() => { activeTab = 'demo'; currentResult = null; }}
				class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer {activeTab === 'demo'
					? 'bg-card text-foreground shadow-sm'
					: 'text-muted-foreground hover:text-foreground'}"
			>
				<PlayIcon class="size-4 fill-current" />
				<span>Demo Benchmark Suite</span>
			</button>
		</div>

		<!-- Content Panels -->
		<div class="w-full space-y-6">
			{#if activeTab === 'upload'}
				{#if isClassifying}
					<ClassifyingLoader fileName={activeFileName} fileSize={activeFileSize} />
				{:else if currentResult}
					<ResultCard result={currentResult} onClear={handleClear} />
				{:else}
					<!-- 1-Click ZEE E-Commerce Visual Analytics Demo Banner -->
					<div class="w-full p-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
						<div class="flex items-start gap-3">
							<div class="flex items-center justify-center size-9 rounded-xl bg-primary text-primary-foreground shrink-0 shadow-xs">
								<SparklesIcon class="size-4.5" />
							</div>
							<div class="space-y-0.5">
								<div class="flex items-center gap-2">
									<h3 class="text-sm font-bold text-foreground">
										Live E-Commerce Visual Analytics Demo
									</h3>
									<span class="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
										ZEE Report 2026
									</span>
								</div>
								<p class="text-xs text-muted-foreground leading-relaxed">
									Test Laya's automated property study, KPI cards, horizontal bar charts, category donut charts, and revenue histograms.
								</p>
							</div>
						</div>
						<button
							type="button"
							onclick={handleLoadZeeDemo}
							disabled={isClassifying || !isBackendConnected}
							class="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<ZapIcon class="size-3.5 fill-current" />
							<span>Analyze ZEE Report</span>
						</button>
					</div>

					{#if errorMsg}
						<div class="w-full p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center justify-between">
							<span>Error: {errorMsg}</span>
							<button type="button" onclick={() => (errorMsg = null)} class="hover:underline">Dismiss</button>
						</div>
					{/if}

					<FileDropZone onClassifyingStart={handleClassifyingStart} onClassified={handleClassified} />
				{/if}
			{:else if activeTab === 'paste'}
				{#if isClassifying}
					<ClassifyingLoader fileName={activeFileName} fileSize={activeFileSize} />
				{:else if currentResult}
					<ResultCard result={currentResult} onClear={handleClear} />
				{:else}
					<div class="w-full max-w-2xl mx-auto space-y-4">
						<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
							<div>
								<h3 class="text-sm font-bold text-foreground">Direct CSV / Delimited Ingestion</h3>
								<p class="text-xs text-muted-foreground">Paste raw sales records or tabular lines below to classify and generate charts.</p>
							</div>
							<button
								type="button"
								onclick={loadSampleHardwareSales}
								class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium border border-border hover:bg-muted transition-colors cursor-pointer"
							>
								<SparklesIcon class="size-3.5 text-primary" />
								<span>Load Hardware Sales (39 Rows)</span>
							</button>
						</div>

						<textarea
							bind:value={pastedText}
							placeholder="Paste CSV rows here (e.g. Sale ID, Contact, Sex, Age, State, Product ID, Product Type, Sale Price, Profit, Lead, Month, Year)..."
							rows="11"
							class="w-full rounded-2xl border border-border/80 bg-card p-4 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs resize-y"
						></textarea>

						<div class="flex items-center justify-between">
							<span class="text-xs font-mono text-muted-foreground">
								{pastedText.trim() ? `${pastedText.trim().split('\n').length} row(s) entered` : 'No data entered'}
							</span>
							<button
								type="button"
								onclick={handleClassifyPastedText}
								disabled={isClassifying || !pastedText.trim() || !isBackendConnected}
								class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
							>
								<ZapIcon class="size-4 fill-current" />
								<span>Classify & Generate Visual Analytics</span>
							</button>
						</div>

						{#if errorMsg}
							<div class="w-full p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-mono flex items-center justify-between">
								<span>Error: {errorMsg}</span>
								<button type="button" onclick={() => (errorMsg = null)} class="hover:underline">Dismiss</button>
							</div>
						{/if}
					</div>
				{/if}
			{:else if activeTab === 'demo'}
				<DemoRunner />
			{/if}
		</div>

		<!-- Feature Badges -->
		{#if !currentResult && !isClassifying && activeTab === 'upload'}
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl pt-6 border-t border-border/50">
				<div class="flex flex-col items-center sm:items-start text-center sm:text-left p-3.5 rounded-xl bg-card/50 border border-border/40 space-y-1.5">
					<div class="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary mb-1">
						<ZapIcon class="size-4" />
					</div>
					<h2 class="text-xs font-semibold uppercase tracking-wider text-foreground">Non-Autoregressive</h2>
					<p class="text-xs text-muted-foreground leading-relaxed">
						Evaluates schemas in a single parallel pass without token hallucinations.
					</p>
				</div>

				<div class="flex flex-col items-center sm:items-start text-center sm:text-left p-3.5 rounded-xl bg-card/50 border border-border/40 space-y-1.5">
					<div class="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary mb-1">
						<ShieldCheckIcon class="size-4" />
					</div>
					<h2 class="text-xs font-semibold uppercase tracking-wider text-foreground">Calibrated Output</h2>
					<p class="text-xs text-muted-foreground leading-relaxed">
						Outputs true probability distributions across each classification category.
					</p>
				</div>

				<div class="flex flex-col items-center sm:items-start text-center sm:text-left p-3.5 rounded-xl bg-card/50 border border-border/40 space-y-1.5">
					<div class="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary mb-1">
						<CheckCircleIcon class="size-4" />
					</div>
					<h2 class="text-xs font-semibold uppercase tracking-wider text-foreground">Multi-Format Ready</h2>
					<p class="text-xs text-muted-foreground leading-relaxed">
						Native support for CSV, TSV, Parquet, JSON, TXT, and server system logs.
					</p>
				</div>
			</div>
		{/if}
	</section>

	<!-- Footer -->
	<footer class="w-full border-t border-border/30 px-6 py-4 text-center text-xs text-muted-foreground font-mono">
		<p>Powered by FastAPI & LayaClassifier (convaiinnovations/laya) • Local Inference</p>
	</footer>
</main>
