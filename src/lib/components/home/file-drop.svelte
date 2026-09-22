<script lang="ts">
	import * as FileDropZone from '$lib/components/ui/file-drop-zone';
	import type { FileRejectedReason } from '$lib/components/ui/file-drop-zone/types';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import FileSpreadsheetIcon from '@lucide/svelte/icons/file-spreadsheet';
	import DatabaseIcon from '@lucide/svelte/icons/database';
	import FileCodeIcon from '@lucide/svelte/icons/file-code';
	import CheckCircleIcon from '@lucide/svelte/icons/circle-check';
	import AlertCircleIcon from '@lucide/svelte/icons/circle-alert';
	import XIcon from '@lucide/svelte/icons/x';
	import { displaySize } from '$lib/components/ui/file-drop-zone';
	import { Spinner } from '$lib/components/ui/spinner';

	import { classifyFile, type FileClassificationResponse } from '$lib/services/api';

	interface Props {
		onUpload?: (files: File[]) => Promise<void> | void;
		onClassifyingStart?: (file: File) => void;
		onClassified?: (result: FileClassificationResponse) => void;
		accept?: string;
		maxFileSize?: number;
		maxFiles?: number;
	}

	let {
		onUpload,
		accept = '.csv,.parquet,.json,.arrow,.sqlite,.tsv,.txt,xlsx,xls',
		maxFileSize = 500 * 1024 * 1024, // 500MB
		maxFiles = 10
	}: Props = $props();

	let uploadedFiles = $state<File[]>([]);
	let errorMessage = $state<string | null>(null);
	let isUploading = $state(false);

	async function handleUpload(files: File[]) {
		errorMessage = null;
		isUploading = true;
		try {
			uploadedFiles = [...uploadedFiles, ...files];
			if (onUpload) {
				await onUpload(files);
			}
			// Automatically classify the newly uploaded file(s)
			if (files.length > 0) {
				const targetFile = files[files.length - 1];
				if (onClassifyingStart) {
					onClassifyingStart(targetFile);
				}
				if (onClassified) {
					const res = await classifyFile(targetFile);
					onClassified(res);
				}
			}
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to process uploaded file(s).';
		} finally {
			isUploading = false;
		}
	}

	function handleFileRejected({ reason, file }: { reason: FileRejectedReason; file: File }) {
		errorMessage = `${file.name}: ${reason}`;
	}

	function removeFile(index: number, e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
		uploadedFiles = uploadedFiles.filter((_, i) => i !== index);
	}

	const supportedFormats = [
		{ ext: 'CSV', label: '.csv', icon: FileSpreadsheetIcon },
		{ ext: 'Excel', label: '.xlsx', icon: FileSpreadsheetIcon },
		{ ext: 'Parquet', label: '.parquet', icon: DatabaseIcon },
		{ ext: 'JSON', label: '.json', icon: FileCodeIcon },
		{ ext: 'Arrow', label: '.arrow', icon: FileTextIcon },
		{ ext: 'SQLite', label: '.sqlite', icon: DatabaseIcon }
	];
</script>

<div class="w-full max-w-2xl mx-auto">
	<FileDropZone.Root
		{accept}
		{maxFileSize}
		{maxFiles}
		fileCount={uploadedFiles.length}
		onUpload={handleUpload}
		onFileRejected={handleFileRejected}
		capturePaste={true}
	>
		<FileDropZone.Trigger
			class="relative flex flex-col items-center justify-center w-full min-h-64 p-8 sm:p-10 border-2 border-dashed border-border hover:border-primary/60 bg-card hover:bg-accent/40 transition-all duration-200 rounded-2xl cursor-pointer group shadow-sm hover:shadow-md"
		>
			<!-- Upload icon with decorative ring -->
			<div
				class="flex items-center justify-center size-16 sm:size-20 rounded-2xl bg-secondary/80 text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 shadow-xs mb-5 group-hover:scale-105"
			>
				{#if isUploading}
					<Spinner class="size-8 sm:size-9" />
				{:else}
					<UploadIcon class="size-8 sm:size-9 stroke-[1.75]" />
				{/if}
			</div>

			<!-- Main instructions -->
			<div class="flex flex-col items-center text-center space-y-1.5 max-w-md">
				{#if isUploading}
					<p class="text-base sm:text-lg font-semibold text-primary tracking-tight animate-pulse">
						Registering dataset with DuckDB-Wasm...
					</p>
					<p class="text-xs sm:text-sm text-muted-foreground">
						Parsing schema and creating in-memory table
					</p>
				{:else}
					<p class="text-base sm:text-lg font-semibold text-foreground tracking-tight">
						<span class="text-primary underline underline-offset-4 decoration-primary/40 group-hover:decoration-primary">Click to browse</span> or drag & drop files here
					</p>
					<p class="text-xs sm:text-sm text-muted-foreground">
						Paste anywhere or drop datasets directly from your filesystem
					</p>
				{/if}
			</div>

			<!-- Formats badges -->
			<div class="flex flex-wrap items-center justify-center gap-1.5 mt-6">
				{#each supportedFormats as format}
					<span
						class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-muted/80 text-muted-foreground border border-border/50 transition-colors group-hover:border-border"
					>
						{format.label}
					</span>
				{/each}
			</div>

			<!-- File size limit hint -->
			<p class="text-[11px] font-mono text-muted-foreground/75 mt-4">
				Max file size {displaySize(maxFileSize)} • Up to {maxFiles} files simultaneously
			</p>
		</FileDropZone.Trigger>

		<FileDropZone.DragOverlay class="bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary">
			<div class="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-card border shadow-xl animate-in zoom-in-95 duration-150">
				<div class="flex items-center justify-center size-16 rounded-full bg-primary text-primary-foreground animate-bounce">
					<UploadIcon class="size-8" />
				</div>
				<div class="text-center">
					<h3 class="text-lg font-bold text-foreground">Drop files to import</h3>
					<p class="text-sm text-muted-foreground mt-0.5">Release to start instant query processing</p>
				</div>
			</div>
		</FileDropZone.DragOverlay>
	</FileDropZone.Root>

	<!-- Error Alert -->
	{#if errorMessage}
		<div
			class="mt-4 flex items-center gap-3 p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm"
		>
			<AlertCircleIcon class="size-5 shrink-0" />
			<span class="flex-1 font-medium">{errorMessage}</span>
			<button
				type="button"
				onclick={() => (errorMessage = null)}
				class="p-1 rounded-lg hover:bg-destructive/20 text-destructive transition-colors"
			>
				<XIcon class="size-4" />
			</button>
		</div>
	{/if}

	<!-- Uploaded Files List -->
	{#if uploadedFiles.length > 0}
		<div class="mt-6 space-y-2">
			<div class="flex items-center justify-between text-xs text-muted-foreground px-1 font-mono uppercase tracking-wider">
				<span>Loaded Datasets ({uploadedFiles.length})</span>
				<span>Total: {displaySize(uploadedFiles.reduce((acc, f) => acc + f.size, 0))}</span>
			</div>
			<div class="divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden shadow-2xs">
				{#each uploadedFiles as file, index}
					<div class="flex items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors">
						<div class="flex items-center gap-3 min-w-0">
							<div class="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary shrink-0">
								<FileTextIcon class="size-4.5" />
							</div>
							<div class="min-w-0">
								<p class="text-sm font-medium text-foreground truncate">{file.name}</p>
								<p class="text-xs text-muted-foreground font-mono">
									{displaySize(file.size)} • {file.name.split('.').pop()?.toUpperCase() || 'DATA'}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2 shrink-0">
							<span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
								<CheckCircleIcon class="size-3" /> Ready
							</span>
							<button
								type="button"
								onclick={(e) => removeFile(index, e)}
								class="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
								title="Remove file"
							>
								<XIcon class="size-4" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

