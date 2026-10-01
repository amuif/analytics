export type ColumnDataType = 'numerical' | 'categorical' | 'date' | 'text';

export interface ColumnProfile {
  name: string;
  type: ColumnDataType;
  totalCount: number;
  nullCount: number;
  uniqueCount: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  categories?: { label: string; count: number }[];
}

export type BusinessDomain = 'inventory' | 'ecommerce' | 'hr' | 'sales' | 'support' | 'general';

export interface DecisionPreset {
  id: string;
  name: string;
  domain: BusinessDomain;
  description: string;
  targetQuestion: string;
  outputType: 'choice' | 'score' | 'boolean';
  choices?: string[];
  scoreScale?: { min: number; max: number; lowLabel: string; highLabel: string };
  // Weighting or relevance rules for evaluating columns
  criteria: string;
}

export interface RowDecision {
  rowIndex: number;
  score?: number; // 1-5 or normalized
  choice?: string; // e.g. "Exceeds", "On Track", "Needs Review", "High Risk"
  boolean?: boolean; // true/false
  confidence: number; // 0.0 to 1.0
  severity?: 'low' | 'medium' | 'high' | 'critical';
  reasoningSummary: string;
}

export interface DatasetSummary {
  id: string;
  filename: string;
  fileSizeBytes: number;
  format: string;
  sheetNames?: string[];
  selectedSheet?: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  columns: ColumnProfile[];
  detectedDomain: BusinessDomain;
  domainConfidence: number;
  suggestedPresets: DecisionPreset[];
  activePresetId?: string;
}

export interface StressTelemetry {
  memoryUsedMB: number;
  memoryLimitMB: number;
  heapUsagePercent: number;
  fps: number;
  droppedFrames: number;
  renderLatencyMs: number;
  processedRows: number;
  totalRows: number;
  throughputRowsSec: number;
  stressLevel: 'low' | 'moderate' | 'high';
  hardwareMode: 'WebGPU (Hardware Accelerated)' | 'WASM-SIMD (Multi-threaded)' | 'Native Rust/Tauri';
}

export interface ChartInsight {
  methodology: string;
  keyFindings: string[];
  metricSummary?: { label: string; value: string }[];
}

export interface ChartDefinition {
  id: string;
  title: string;
  type: 'histogram' | 'bar' | 'pie' | 'scatter';
  description: string;
  xKey: string;
  yKey?: string;
  data: any[];
  insights?: ChartInsight;
}
