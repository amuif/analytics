import type { DecisionPreset, RowDecision, ColumnProfile } from '../types';

export interface WorkerMessageRequest {
  type: 'EVALUATE_BATCH';
  datasetId: string;
  rows: Record<string, any>[];
  preset: DecisionPreset;
  columns: ColumnProfile[];
}

export interface WorkerMessageResponse {
  type: 'STREAM_CHUNK' | 'COMPLETE' | 'ERROR';
  datasetId: string;
  processed: number;
  total: number;
  chunk?: RowDecision[];
  decisions?: RowDecision[];
  error?: string;
}

self.onmessage = (event: MessageEvent<WorkerMessageRequest>) => {
  const { type, datasetId, rows, preset, columns } = event.data;

  if (type === 'EVALUATE_BATCH') {
    try {
      const total = rows ? rows.length : 0;
      if (total === 0) {
        self.postMessage({
          type: 'COMPLETE',
          datasetId,
          processed: 0,
          total: 0,
          decisions: [],
        } as WorkerMessageResponse);
        return;
      }

      // Safe defaults
      const safePreset: DecisionPreset = preset || {
        id: 'default',
        name: 'General Decision',
        domain: 'general',
        description: 'Default evaluation',
        targetQuestion: 'How does this record score overall?',
        outputType: 'choice',
        choices: ['Optimal', 'Watchlist', 'Action Needed'],
        criteria: 'all',
      };

      const safeColumns: ColumnProfile[] = columns || [];

      // 1. PRECOMPUTE ONCE BEFORE LOOP (Ultra-Fast)
      const criteriaTerms = (safePreset.criteria || '')
        .toLowerCase()
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const numStats: Record<string, { min: number; max: number; mean: number; span: number }> = {};
      for (const col of safeColumns) {
        if (col.type === 'numerical' && col.min !== undefined && col.max !== undefined) {
          const span = col.max - col.min || 1;
          numStats[col.name] = {
            min: col.min,
            max: col.max,
            mean: col.mean ?? (col.min + col.max) / 2,
            span,
          };
        }
      }

      // Pre-filter matching columns once
      const relevantColNames: string[] = [];
      const isNegativeMap: Record<string, boolean> = {};

      for (const col of safeColumns) {
        const colLower = col.name.toLowerCase();
        const matches = criteriaTerms.some(term => term === 'all' || colLower.includes(term));
        if (matches) {
          relevantColNames.push(col.name);
          isNegativeMap[col.name] = /absenc|leave|churn|complain|return|refund|delay|drop|risk|defect|lost/i.test(col.name);
        }
      }

      // Fallback to all numerical columns if no keyword matched
      if (relevantColNames.length === 0) {
        for (const k of Object.keys(numStats)) {
          relevantColNames.push(k);
          isNegativeMap[k] = /absenc|leave|churn|complain|return|refund|delay|drop|risk|defect|lost/i.test(k);
        }
      }

      const allDecisions: RowDecision[] = [];
      const CHUNK_SIZE = 25; // Stream in small 25-row bursts for instant UI feedback
      let currentChunk: RowDecision[] = [];

      for (let i = 0; i < total; i++) {
        const row = rows[i] || {};
        const decision = evaluateRowFast(
          row,
          i,
          safePreset,
          relevantColNames,
          isNegativeMap,
          numStats
        );

        allDecisions.push(decision);
        currentChunk.push(decision);

        // Stream chunk to UI as each batch finishes
        if (currentChunk.length >= CHUNK_SIZE || i === total - 1) {
          self.postMessage({
            type: 'STREAM_CHUNK',
            datasetId,
            processed: i + 1,
            total,
            chunk: currentChunk,
          } as WorkerMessageResponse);
          currentChunk = [];
        }
      }

      // Final complete signal
      self.postMessage({
        type: 'COMPLETE',
        datasetId,
        processed: total,
        total,
        decisions: allDecisions,
      } as WorkerMessageResponse);
    } catch (err: any) {
      console.error('Laya worker internal error:', err);
      self.postMessage({
        type: 'ERROR',
        datasetId,
        processed: 0,
        total: 0,
        error: err?.message || 'Error occurred in Laya decision worker.',
      } as WorkerMessageResponse);
    }
  }
};

function evaluateRowFast(
  row: Record<string, any>,
  rowIndex: number,
  preset: DecisionPreset,
  relevantColNames: string[],
  isNegativeMap: Record<string, boolean>,
  numStats: Record<string, { min: number; max: number; mean: number; span: number }>
): RowDecision {
  let compositeScore = 0.5;
  const explanations: string[] = [];

  if (relevantColNames.length > 0) {
    let sumNormalized = 0;
    let weightCount = 0;

    for (const colName of relevantColNames) {
      const val = row[colName];
      if (typeof val === 'number' && numStats[colName]) {
        const stat = numStats[colName];
        let normalized = (val - stat.min) / stat.span;

        if (isNegativeMap[colName]) {
          normalized = 1.0 - normalized;
          if (val > stat.mean) {
            explanations.push(`Elevated ${colName} (${val})`);
          }
        } else {
          if (val < stat.mean) {
            explanations.push(`Below avg ${colName} (${val})`);
          } else {
            explanations.push(`Strong ${colName} (${val})`);
          }
        }

        sumNormalized += normalized;
        weightCount += 1;
      }
    }

    if (weightCount > 0) {
      compositeScore = sumNormalized / weightCount;
    }
  }

  // Bound score
  compositeScore = Math.max(0, Math.min(1, compositeScore));

  // Calibrated confidence (bounded between 0.75 and 0.98)
  const confidence = Number((0.75 + Math.abs(compositeScore - 0.5) * 0.46).toFixed(2));

  let choice: string | undefined;
  let score: number | undefined;
  let booleanVal: boolean | undefined;
  let severity: RowDecision['severity'] = 'low';

  if (preset.outputType === 'choice' && preset.choices && preset.choices.length > 0) {
    const choices = preset.choices;
    const idx = Math.min(choices.length - 1, Math.max(0, Math.floor((1.0 - compositeScore) * choices.length)));
    choice = choices[idx];

    if (compositeScore < 0.28) {
      severity = 'critical';
    } else if (compositeScore < 0.48) {
      severity = 'high';
    } else if (compositeScore < 0.72) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
  } else if (preset.outputType === 'score') {
    score = Math.min(5, Math.max(1, Math.round(1 + compositeScore * 4)));
    if (score >= 4) severity = 'high';
    else if (score >= 3) severity = 'medium';
    else severity = 'low';
  } else if (preset.outputType === 'boolean') {
    booleanVal = compositeScore > 0.52;
    severity = booleanVal ? 'high' : 'low';
  }

  const reasoningSummary = explanations.length > 0
    ? explanations.slice(0, 3).join('; ')
    : `Composite index: ${(compositeScore * 100).toFixed(0)}%`;

  return {
    rowIndex,
    score,
    choice,
    boolean: booleanVal,
    confidence,
    severity,
    reasoningSummary,
  };
}
