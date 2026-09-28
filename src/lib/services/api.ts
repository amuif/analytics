/**
 * API client communicating with the FastAPI LayaClassifier backend.
 * Uses Vite proxy and multi-target fallback (proxy -> 127.0.0.1:8000 -> localhost:8000).
 */

export let activeBaseUrl = '';

export function getBaseUrl(): string {
	if (typeof window !== 'undefined') {
		return activeBaseUrl;
	}
	return 'http://127.0.0.1:8000';
}

export const API_BASE_URL = 'http://localhost:8000';

export interface ClassificationDecision {
	decision: string;
	confidence: number;
	probabilities?: Record<string, number>;
}

export interface FileSummaryResponse {
	filename: string;
	extension: string;
	size_bytes: number;
	format_type: string;
	row_count?: number;
	column_count?: number;
	column_names?: string[];
	text_sample_preview: string;
	metadata: Record<string, unknown>;
}

export interface KPICard {
	label: string;
	value: string;
	numeric_value?: number;
	description?: string;
	category: string;
}

export interface ChartDataPoint {
	label: string;
	value: number;
	percentage?: number;
	count?: number;
}

export interface BarChartData {
	title: string;
	metric_label: string;
	dimension_label: string;
	points: ChartDataPoint[];
}

export interface PieChartData {
	title: string;
	dimension_label: string;
	slices: ChartDataPoint[];
}

export interface HistogramBin {
	bin_start: number;
	bin_end: number;
	bin_label: string;
	frequency: number;
}

export interface HistogramData {
	title: string;
	metric_label: string;
	total_samples: number;
	bins: HistogramBin[];
}

export interface AnalyticsDashboardData {
	headline: string;
	laya_recommendation: string;
	kpis: KPICard[];
	bar_chart?: BarChartData;
	pie_chart?: PieChartData;
	histogram?: HistogramData;
	detected_metrics: string[];
	detected_dimensions: string[];
}

export interface FileClassificationResponse {
	filename: string;
	size_bytes: number;
	format_type: string;
	classifications: Record<string, ClassificationDecision>;
	inference_time_ms: number;
	file_summary: FileSummaryResponse;
	analytics?: AnalyticsDashboardData;
}

export interface BatchDemoResult {
	filename: string;
	status: string;
	expected: Record<string, string>;
	predicted: Record<string, string>;
	confidences: Record<string, number>;
	matches: Record<string, boolean>;
	all_matched: boolean;
}

export interface DemoEvaluationResponse {
	total_files: number;
	passed_files: number;
	failed_files: number;
	accuracy_percentage: number;
	results: BatchDemoResult[];
}

export interface HealthResponse {
	status: string;
	service: string;
	version: string;
	model_loaded: boolean;
	timestamp: string;
}

export interface DemoStreamCallbacks {
	onSuiteStart?: (total: number, filenames: string[]) => void;
	onFileStart?: (filename: string, index: number, total: number) => void;
	onFileComplete?: (filename: string, index: number, total: number, data: BatchDemoResult) => void;
	onSuiteComplete?: (summary: { total: number; passed: number; failed: number; accuracy: number }) => void;
	onError?: (error: string) => void;
}

export async function fetchHealth(): Promise<HealthResponse> {
	const candidates = ['', 'http://127.0.0.1:8000', 'http://localhost:8000'];
	let lastErr: any = null;

	for (const candidate of candidates) {
		try {
			const resp = await fetch(`${candidate}/health`, { signal: AbortSignal.timeout(3000) });
			if (resp.ok) {
				activeBaseUrl = candidate;
				return resp.json();
			}
		} catch (e) {
			lastErr = e;
		}
	}
	throw lastErr || new Error('Health check failed across all targets');
}

export async function classifyFile(file: File): Promise<FileClassificationResponse> {
	const formData = new FormData();
	formData.append('file', file);

	const resp = await fetch(`${getBaseUrl()}/api/v1/classify/file`, {
		method: 'POST',
		body: formData
	});

	if (!resp.ok) {
		const errData = await resp.json().catch(() => ({}));
		throw new Error(errData.detail || `Classification failed with status ${resp.status}`);
	}

	return resp.json();
}

export async function loadZeeDemoAnalytics(): Promise<FileClassificationResponse> {
	const resp = await fetch(`${getBaseUrl()}/api/v1/analytics/demo/zee`);
	if (!resp.ok) {
		const errData = await resp.json().catch(() => ({}));
		throw new Error(errData.detail || `Failed to load ZEE demo analytics: ${resp.status}`);
	}
	return resp.json();
}

export async function runDemoSuite(): Promise<DemoEvaluationResponse> {
	const resp = await fetch(`${getBaseUrl()}/api/v1/classify/demo`);
	if (!resp.ok) {
		const errData = await resp.json().catch(() => ({}));
		throw new Error(errData.detail || `Demo suite evaluation failed: ${resp.status}`);
	}
	return resp.json();
}

export function streamDemoSuite(callbacks: DemoStreamCallbacks): () => void {
	const eventSource = new EventSource(`${getBaseUrl()}/api/v1/classify/demo/stream`);

	eventSource.onmessage = (event) => {
		try {
			const payload = JSON.parse(event.data);
			if (payload.type === 'suite_start') {
				callbacks.onSuiteStart?.(payload.total, payload.filenames);
			} else if (payload.type === 'file_start') {
				callbacks.onFileStart?.(payload.filename, payload.index, payload.total);
			} else if (payload.type === 'file_complete') {
				callbacks.onFileComplete?.(payload.filename, payload.index, payload.total, payload.data);
			} else if (payload.type === 'suite_complete') {
				callbacks.onSuiteComplete?.(payload);
				eventSource.close();
			}
		} catch (e) {
			console.error('Error parsing SSE event:', e);
		}
	};

	eventSource.onerror = () => {
		callbacks.onError?.('Lost stream connection to classification server');
		eventSource.close();
	};

	return () => {
		eventSource.close();
	};
}
