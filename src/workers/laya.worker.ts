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
  // --- INVENTORY & SUPPLY CHAIN DECISION HEAD ---
  if (preset.domain === 'inventory' || preset.id.startsWith('inventory-')) {
    const stock = Number(row['Stock_On_Hand'] ?? row['Stock_Units'] ?? row['Current_Stock'] ?? row['stock'] ?? row['inventory'] ?? row['Quantity_On_Hand'] ?? NaN);
    const velocity = Number(row['Monthly_Sales_Velocity'] ?? row['Monthly_Sales'] ?? row['Monthly_Velocity'] ?? row['velocity'] ?? row['daily_sales'] ?? NaN);
    const reorder = Number(row['Reorder_Point'] ?? row['reorder_point'] ?? row['safety_stock'] ?? 45);
    const leadTime = Number(row['Lead_Time_Days'] ?? row['lead_time'] ?? 14);
    const unitCost = Number(row['Unit_Cost'] ?? row['unit_cost'] ?? row['Cost'] ?? 35);
    const dailyRunRate = !isNaN(velocity) && velocity > 0 ? velocity / 30 : Math.max(0.1, (stock || 30) / 45);
    const dos = Number(row['Days_Of_Supply'] ?? (!isNaN(stock) ? Math.round(stock / dailyRunRate) : 45));

    // Preset 1: Restock & Stockout Triage
    if (preset.id === 'inventory-restock-triage' || preset.id.includes('restock')) {
      if ((!isNaN(stock) && stock < reorder) || dos <= leadTime) {
        return {
          rowIndex,
          choice: '🚨 Urgent Expedite (Stockout Risk)',
          confidence: 0.96,
          severity: 'critical',
          reasoningSummary: `Stock (${stock}) breached reorder point (${reorder}); ${dos}d supply left vs ${leadTime}d supplier lead time.`
        };
      } else if ((!isNaN(stock) && stock <= reorder * 1.35) || dos <= leadTime * 1.6) {
        return {
          rowIndex,
          choice: '📦 Standard Reorder Needed',
          confidence: 0.91,
          severity: 'high',
          reasoningSummary: `Approaching reorder threshold (${reorder} units); ${dos}d buffer remaining with ${leadTime}d lead time.`
        };
      } else if (dos > 140) {
        return {
          rowIndex,
          choice: '⚠️ Overstocked Supply',
          confidence: 0.88,
          severity: 'medium',
          reasoningSummary: `Excess safety buffer (${dos} days of supply); on-hand inventory (${stock}) exceeds quarterly demand run-rate.`
        };
      } else {
        return {
          rowIndex,
          choice: '✅ Healthy Stock Velocity',
          confidence: 0.94,
          severity: 'low',
          reasoningSummary: `Balanced stock: ${stock} units on hand matches ${velocity} units/mo demand with safe buffer.`
        };
      }
    }

    // Preset 2: Markdown & Clearance Triage
    if (preset.id === 'inventory-markdown-clearance' || preset.id.includes('markdown')) {
      const holdingCost = row['Holding_Cost_Month'] ? `$${row['Holding_Cost_Month']}/mo` : 'elevated holding cost';
      const daysDormant = Number(row['Days_Dormant'] ?? dos);

      if (dos >= 150 || daysDormant >= 120 || (!isNaN(stock) && stock > 100 && velocity < 8)) {
        return {
          rowIndex,
          choice: '🔥 Dead Stock Liquidation (60% Off)',
          confidence: 0.95,
          severity: 'critical',
          reasoningSummary: `Stagnant inventory (${dos} days of supply) with near-zero run-rate; accumulating ${holdingCost}.`
        };
      } else if (dos >= 85 || daysDormant >= 60) {
        return {
          rowIndex,
          choice: '🏷️ Clearance Markdown (30-40%)',
          confidence: 0.90,
          severity: 'high',
          reasoningSummary: `Sluggish turnover (${dos} days of supply); recommend promotional markdown to release working capital.`
        };
      } else if (dos >= 50) {
        return {
          rowIndex,
          choice: '📦 Promotional Bundle',
          confidence: 0.86,
          severity: 'medium',
          reasoningSummary: `Moderate overstock (${dos}d supply); optimal candidate for multi-pack bundling or catalog promo.`
        };
      } else {
        return {
          rowIndex,
          choice: '💎 Retain Full Margin',
          confidence: 0.92,
          severity: 'low',
          reasoningSummary: `Lean inventory turnover (${dos}d supply); high sell-through rate justifies full margin retention.`
        };
      }
    }

    // Preset 3: ABC Stratification
    if (preset.id === 'inventory-abc-stratification' || preset.id.includes('abc')) {
      const monthlyRunRateValue = (!isNaN(velocity) ? velocity : 25) * unitCost;
      if (monthlyRunRateValue >= 7500 || (velocity >= 80 && unitCost >= 70)) {
        return {
          rowIndex,
          choice: 'Class A - Critical Capital Driver',
          confidence: 0.95,
          severity: 'critical',
          reasoningSummary: `High capital exposure ($${Math.round(monthlyRunRateValue).toLocaleString()}/mo); mandates continuous cycle counts and tight vendor SLAs.`
        };
      } else if (monthlyRunRateValue >= 2000 || velocity >= 35) {
        return {
          rowIndex,
          choice: 'Class B - Core Continuous Demand',
          confidence: 0.89,
          severity: 'medium',
          reasoningSummary: `Consistent mid-tier contributor ($${Math.round(monthlyRunRateValue).toLocaleString()}/mo); standard automated reorder point.`
        };
      } else {
        return {
          rowIndex,
          choice: 'Class C - Low Frequency Tail',
          confidence: 0.88,
          severity: 'low',
          reasoningSummary: `Low capital exposure ($${Math.round(monthlyRunRateValue).toLocaleString()}/mo); manage via bulk minimum order quantities (MOQ).`
        };
      }
    }

    // Preset 4: Supplier Lead Time & Resilience
    if (preset.id === 'inventory-leadtime-resilience' || preset.id.includes('leadtime')) {
      const supplierRel = String(row['Supplier_Reliability'] ?? '').toLowerCase();
      let riskScore = 1;
      let riskSummary = '';

      if (leadTime > 30 || supplierRel.includes('high risk') || supplierRel.includes('tier 3')) {
        riskScore = 5;
        riskSummary = `Extended lead time (${leadTime} days) with elevated supplier risk; highly vulnerable to supply chain disruptions.`;
      } else if (leadTime > 20 || supplierRel.includes('moderate')) {
        riskScore = 4;
        riskSummary = `Lengthy transit (${leadTime} days); requires oversized safety buffer.`;
      } else if (leadTime > 12) {
        riskScore = 3;
        riskSummary = `Moderate supplier transit (${leadTime} days); acceptable resilience.`;
      } else {
        riskScore = 1;
        riskSummary = `Agile supplier turnaround (${leadTime} days); rapid just-in-time replenishment capability.`;
      }

      return {
        rowIndex,
        score: riskScore,
        severity: riskScore >= 4 ? 'high' : riskScore === 3 ? 'medium' : 'low',
        confidence: 0.93,
        reasoningSummary: riskSummary,
      };
    }
  }

  // --- GENERAL STATISTICAL INFERENCE ENGINE (For Any General Dataset) ---
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
