<script lang="ts">
	import FileDropZone from '$lib/components/home/file-drop.svelte';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import ZapIcon from '@lucide/svelte/icons/zap';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import DatabaseIcon from '@lucide/svelte/icons/database';
    import ModeToggle from '$lib/components/mode-toggle.svelte';
</script>

<main class="min-h-screen flex flex-col justify-between bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground">
	<!-- Top Navigation / Header -->
	<header class="w-full border-b border-border/40 px-6 py-4 flex items-center justify-between">
		<div class="flex items-center gap-2.5 font-bold tracking-tight text-lg">
			<div class="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground shadow-2xs">
				<DatabaseIcon class="size-4.5" />
			</div>
			<span>Analytics</span>
		</div>
		<div class="flex items-center gap-2 text-xs font-mono text-muted-foreground">
			<span class="inline-block size-2 rounded-full bg-emerald-500 animate-pulse"></span>
			<span>DuckDB Engine Ready</span>

<ModeToggle/>
		</div>
	</header>

	<!-- Centered Main Content -->
	<section class="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 sm:py-16 max-w-4xl mx-auto w-full">
		<!-- Hero Pill Badge -->
		<div class="inline-flex items-center gap-2 px-3 py-1 text-xs font-medium rounded-full bg-secondary/80 text-secondary-foreground border border-border mb-6 shadow-2xs">
			<SparklesIcon class="size-3.5 text-primary" />
			<span>In-Browser SQL Analytics</span>
		</div>

		<!-- Main Hero Headline & Subtitle -->
		<div class="text-center space-y-3 mb-8 max-w-xl mx-auto">
			<h1 class="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground">
				Analyze data at lightspeed
			</h1>
			<p class="text-sm sm:text-base text-muted-foreground leading-relaxed">
				Drop your datasets below to run instant SQL queries, analyze distributions, and visualize results in real time.
			</p>
		</div>

		<!-- File Drop Zone Component -->
		<FileDropZone />

		<!-- Value Proposition Cards / Feature Highlights -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-12 pt-8 border-t border-border/50">
			<div class="flex flex-col items-center sm:items-start text-center sm:text-left p-3.5 rounded-xl bg-card/50 border border-border/40 space-y-1.5">
				<div class="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary mb-1">
					<ZapIcon class="size-4" />
				</div>
				<h2 class="text-xs font-semibold uppercase tracking-wider text-foreground">Blazing Fast</h2>
				<p class="text-xs text-muted-foreground leading-relaxed">
					Vectorized columnar execution running directly on your machine.
				</p>
			</div>

			<div class="flex flex-col items-center sm:items-start text-center sm:text-left p-3.5 rounded-xl bg-card/50 border border-border/40 space-y-1.5">
				<div class="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary mb-1">
					<ShieldCheckIcon class="size-4" />
				</div>
				<h2 class="text-xs font-semibold uppercase tracking-wider text-foreground">100% Private</h2>
				<p class="text-xs text-muted-foreground leading-relaxed">
					Zero telemetry or server uploads. Your data stays strictly on your device.
				</p>
			</div>

			<div class="flex flex-col items-center sm:items-start text-center sm:text-left p-3.5 rounded-xl bg-card/50 border border-border/40 space-y-1.5">
				<div class="flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary mb-1">
					<DatabaseIcon class="size-4" />
				</div>
				<h2 class="text-xs font-semibold uppercase tracking-wider text-foreground">Full SQL Power</h2>
				<p class="text-xs text-muted-foreground leading-relaxed">
					Standard SQL with joins, window functions, aggregations, and fast filters.
				</p>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="w-full border-t border-border/30 px-6 py-4 text-center text-xs text-muted-foreground font-mono">
		<p>Powered by DuckDB & Apache Arrow • Client-Side Analytics</p>
	</footer>
</main>

