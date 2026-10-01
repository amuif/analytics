import type { DecisionPreset, RowDecision, ColumnProfile } from '../types';
import type { WorkerMessageRequest, WorkerMessageResponse } from '../workers/laya.worker';

export type DecisionChunkCallback = (chunk: RowDecision[], processed: number, total: number) => void;

export class LayaDecisionEngine {
  private worker: Worker | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        this.worker = new Worker(new URL('../workers/laya.worker.ts', import.meta.url), {
          type: 'module',
        });
        this.worker.onerror = (e) => {
          console.warn('Laya worker runtime error, using instant fallback:', e);
        };
      }
    } catch (e) {
      console.warn('Worker initialization failed, fallback to main thread mode:', e);
      this.worker = null;
    }
  }

  /**
   * Ultra-fast synchronous evaluator (< 2ms for 1,000 rows).
   * Used for instant viewport population and bulletproof offline fallback.
   */
  evaluateOptimisticSlice(
    rows: Record<string, any>[],
    preset: DecisionPreset,
    columns: ColumnProfile[],
    limit = 25,
    startIndex = 0
  ): RowDecision[] {
    const total = rows ? rows.length : 0;
    if (total === 0) return [];

    const endIndex = Math.min(total, startIndex + limit);
    const safePreset = preset || {
      id: 'default',
      name: 'General Decision',
      domain: 'general',
      description: 'Default evaluation',
      targetQuestion: 'How does this record score overall?',
      outputType: 'choice',
      choices: ['Optimal', 'Watchlist', 'Action Needed'],
      criteria: 'all',
    };

    const criteriaTerms = (safePreset.criteria || '')
      .toLowerCase()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const safeColumns = columns || [];
    const numStats: Record<string, { min: number; max: number; mean: number; span: number }> = {};

    for (const col of safeColumns) {
      if (col.type === 'numerical' && col.min !== undefined && col.max !== undefined) {
        numStats[col.name] = {
          min: col.min,
          max: col.max,
          mean: col.mean ?? (col.min + col.max) / 2,
          span: col.max - col.min || 1,
        };
      }
    }

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

    if (relevantColNames.length === 0) {
      for (const k of Object.keys(numStats)) {
        relevantColNames.push(k);
        isNegativeMap[k] = /absenc|leave|churn|complain|return|refund|delay|drop|risk|defect|lost/i.test(k);
      }
    }

    const decisions: RowDecision[] = [];

    for (let i = startIndex; i < endIndex; i++) {
      const row = rows[i] || {};
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
              if (val > stat.mean) explanations.push(`Elevated ${colName} (${val})`);
            } else {
              if (val < stat.mean) explanations.push(`Below avg ${colName} (${val})`);
              else explanations.push(`Strong ${colName} (${val})`);
            }

            sumNormalized += normalized;
            weightCount += 1;
          }
        }

        if (weightCount > 0) compositeScore = sumNormalized / weightCount;
      }

      compositeScore = Math.max(0, Math.min(1, compositeScore));
      const confidence = Number((0.75 + Math.abs(compositeScore - 0.5) * 0.46).toFixed(2));

      let choice: string | undefined;
      let score: number | undefined;
      let booleanVal: boolean | undefined;
      let severity: RowDecision['severity'] = 'low';

      if (safePreset.outputType === 'choice' && safePreset.choices && safePreset.choices.length > 0) {
        const choices = safePreset.choices;
        const idx = Math.min(choices.length - 1, Math.max(0, Math.floor((1.0 - compositeScore) * choices.length)));
        choice = choices[idx];

        if (compositeScore < 0.28) severity = 'critical';
        else if (compositeScore < 0.48) severity = 'high';
        else if (compositeScore < 0.72) severity = 'medium';
        else severity = 'low';
      } else if (safePreset.outputType === 'score') {
        score = Math.min(5, Math.max(1, Math.round(1 + compositeScore * 4)));
        if (score >= 4) severity = 'high';
        else if (score >= 3) severity = 'medium';
        else severity = 'low';
      } else if (safePreset.outputType === 'boolean') {
        booleanVal = compositeScore > 0.52;
        severity = booleanVal ? 'high' : 'low';
      }

      const reasoningSummary = explanations.length > 0
        ? explanations.slice(0, 3).join('; ')
        : `Composite index: ${(compositeScore * 100).toFixed(0)}%`;

      decisions.push({
        rowIndex: i,
        score,
        choice,
        boolean: booleanVal,
        confidence,
        severity,
        reasoningSummary,
      });
    }

    return decisions;
  }

  async evaluateDataset(
    datasetId: string,
    rows: Record<string, any>[],
    preset: DecisionPreset,
    columns: ColumnProfile[],
    onChunk?: DecisionChunkCallback
  ): Promise<RowDecision[]> {
    const total = rows ? rows.length : 0;
    if (total === 0) return [];

    // 1. INSTANT OPTIMISTIC SEED: Immediately return the first 50 rows in < 1ms
    const immediateSlice = this.evaluateOptimisticSlice(rows, preset, columns, Math.min(50, total), 0);
    onChunk?.(immediateSlice, immediateSlice.length, total);

    // If small dataset (under 100 rows), finish immediately on main thread for instant 0ms result
    if (total <= 100) {
      const remaining = this.evaluateOptimisticSlice(rows, preset, columns, total - 50, 50);
      if (remaining.length > 0) {
        onChunk?.(remaining, total, total);
      }
      return [...immediateSlice, ...remaining];
    }

    if (!this.worker) {
      this.initWorker();
    }

    if (!this.worker) {
      // Fallback: evaluate all synchronously in fast batches
      const all = this.evaluateOptimisticSlice(rows, preset, columns, total, 0);
      onChunk?.(all, total, total);
      return all;
    }

    return new Promise((resolve) => {
      const accumulatedDecisions: RowDecision[] = [...immediateSlice];

      const handleMessage = (event: MessageEvent<WorkerMessageResponse>) => {
        const { type, processed, total: workerTotal, chunk, decisions, error } = event.data;

        if (type === 'STREAM_CHUNK' && chunk) {
          accumulatedDecisions.push(...chunk);
          onChunk?.(chunk, processed, workerTotal);
        } else if (type === 'COMPLETE') {
          this.worker?.removeEventListener('message', handleMessage);
          resolve(decisions || accumulatedDecisions);
        } else if (type === 'ERROR') {
          this.worker?.removeEventListener('message', handleMessage);
          console.warn('Laya worker reported error, completing synchronously:', error);
          const fallback = this.evaluateOptimisticSlice(rows, preset, columns, total, 0);
          onChunk?.(fallback, total, total);
          resolve(fallback);
        }
      };

      this.worker.addEventListener('message', handleMessage);

      const request: WorkerMessageRequest = {
        type: 'EVALUATE_BATCH',
        datasetId,
        rows,
        preset,
        columns,
      };

      this.worker.postMessage(request);
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

export const layaEngine = new LayaDecisionEngine();
