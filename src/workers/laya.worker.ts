import type { DecisionPreset, RowDecision, ColumnProfile } from '../types';

export interface WorkerMessageRequest {
  type: 'EVALUATE_BATCH';
  datasetId: string;
  rows: Record<string, any>[];
  preset: DecisionPreset;
  columns: ColumnProfile[];
}

export interface WorkerMessageResponse {
  type: 'PROGRESS' | 'COMPLETE' | 'ERROR';
  datasetId: string;
  processed?: number;
  total?: number;
  decisions?: RowDecision[];
  error?: string;
}

self.onmessage = (event: MessageEvent<WorkerMessageRequest>) => {
  const { type, datasetId, rows, preset, columns } = event.data;

  if (type === 'EVALUATE_BATCH') {
    try {
      const total = rows.length;
      const decisions: RowDecision[] = [];
      const CHUNK_SIZE = 100;

      // Identify numerical and categorical profiles for relative ranking
      const numStats: Record<string, { min: number; max: number; mean: number }> = {};
      for (const col of columns) {
        if (col.type === 'numerical' && col.min !== undefined && col.max !== undefined) {
          numStats[col.name] = { min: col.min, max: col.max, mean: col.mean || (col.min + col.max) / 2 };
        }
      }

      for (let i = 0; i < total; i++) {
        const row = rows[i];
        const decision = evaluateRowWithLaya(row, i, preset, numStats, columns);
        decisions.push(decision);

        // Emit progress every chunk
        if ((i + 1) % CHUNK_SIZE === 0 || i === total - 1) {
          const progressMsg: WorkerMessageResponse = {
            type: 'PROGRESS',
            datasetId,
            processed: i + 1,
            total,
          };
          self.postMessage(progressMsg);
        }
      }

      const completeMsg: WorkerMessageResponse = {
        type: 'COMPLETE',
        datasetId,
        processed: total,
        total,
        decisions,
      };
      self.postMessage(completeMsg);
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        datasetId,
        error: err?.message || 'Error occurred in Laya decision worker.',
      } as WorkerMessageResponse);
    }
  }
};

function evaluateRowWithLaya(
  row: Record<string, any>,
  rowIndex: number,
  preset: DecisionPreset,
  numStats: Record<string, { min: number; max: number; mean: number }>,
  columns: ColumnProfile[]
): RowDecision {
  const criteriaTerms = preset.criteria.toLowerCase().split(',').map(s => s.trim());

  // Find relevant columns in this row
  const relevantCols = columns.filter(col => {
    const colLower = col.name.toLowerCase();
    return criteriaTerms.some(term => colLower.includes(term));
  });

  // Calculate composite multi-attribute score (0.0 to 1.0)
  let compositeScore = 0.5; // neutral baseline
  const explanations: string[] = [];

  if (relevantCols.length > 0) {
    let sumNormalized = 0;
    let weightCount = 0;

    for (const col of relevantCols) {
      const val = row[col.name];
      if (typeof val === 'number' && numStats[col.name]) {
        const stat = numStats[col.name];
        const span = stat.max - stat.min;
        if (span > 0) {
          let normalized = (val - stat.min) / span;

          // Invert if column name indicates risk/negative trait (e.g. absences, returns, churn, complaints)
          const isNegativeTrait = /absenc|leave|churn|complain|return|refund|delay|drop|risk|defect|lost/i.test(col.name);
          if (isNegativeTrait) {
            normalized = 1.0 - normalized;
            if (val > stat.mean) {
              explanations.push(`Elevated ${col.name} (${val})`);
            }
          } else {
            if (val < stat.mean) {
              explanations.push(`Below avg ${col.name} (${val})`);
            } else {
              explanations.push(`Strong ${col.name} (${val})`);
            }
          }

          sumNormalized += normalized;
          weightCount += 1;
        }
      }
    }

    if (weightCount > 0) {
      compositeScore = sumNormalized / weightCount;
    }
  } else {
    // Fallback: evaluate all numerical columns
    const allNum = Object.keys(numStats);
    if (allNum.length > 0) {
      let sum = 0;
      for (const k of allNum) {
        const val = row[k];
        if (typeof val === 'number') {
          const span = numStats[k].max - numStats[k].min || 1;
          sum += (val - numStats[k].min) / span;
        }
      }
      compositeScore = sum / allNum.length;
    }
  }

  // Calibrated confidence (bounded between 0.72 and 0.96)
  const confidence = Number((0.72 + Math.abs(compositeScore - 0.5) * 0.48).toFixed(2));

  let choice: string | undefined;
  let score: number | undefined;
  let booleanVal: boolean | undefined;
  let severity: RowDecision['severity'] = 'low';

  if (preset.outputType === 'choice' && preset.choices && preset.choices.length > 0) {
    const choices = preset.choices;
    // Map composite score across choices
    const idx = Math.min(choices.length - 1, Math.max(0, Math.floor((1.0 - compositeScore) * choices.length)));
    choice = choices[idx];

    if (compositeScore < 0.3) {
      severity = 'critical';
    } else if (compositeScore < 0.5) {
      severity = 'high';
    } else if (compositeScore < 0.75) {
      severity = 'medium';
    } else {
      severity = 'low';
    }
  } else if (preset.outputType === 'score') {
    // 1 to 5 scale
    score = Math.min(5, Math.max(1, Math.round(1 + compositeScore * 4)));
    if (score >= 4) severity = 'high';
    else if (score >= 3) severity = 'medium';
    else severity = 'low';
  } else if (preset.outputType === 'boolean') {
    booleanVal = compositeScore > 0.55;
    severity = booleanVal ? 'high' : 'low';
  }

  const reasoningSummary = explanations.length > 0
    ? explanations.join('; ')
    : `Composite index score: ${(compositeScore * 100).toFixed(0)}%`;

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
