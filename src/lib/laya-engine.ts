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

      // --- INVENTORY & SUPPLY CHAIN DECISION HEAD ---
      if (safePreset.domain === 'inventory' || safePreset.id.startsWith('inventory-')) {
        const stock = Number(row['Stock_On_Hand'] ?? row['Stock_Units'] ?? row['Current_Stock'] ?? row['stock'] ?? row['inventory'] ?? row['Quantity_On_Hand'] ?? NaN);
        const velocity = Number(row['Monthly_Sales_Velocity'] ?? row['Monthly_Sales'] ?? row['Monthly_Velocity'] ?? row['velocity'] ?? row['daily_sales'] ?? NaN);
        const reorder = Number(row['Reorder_Point'] ?? row['reorder_point'] ?? row['safety_stock'] ?? 45);
        const leadTime = Number(row['Lead_Time_Days'] ?? row['lead_time'] ?? 14);
        const unitCost = Number(row['Unit_Cost'] ?? row['unit_cost'] ?? row['Cost'] ?? 35);
        const dailyRunRate = !isNaN(velocity) && velocity > 0 ? velocity / 30 : Math.max(0.1, (stock || 30) / 45);
        const dos = Number(row['Days_Of_Supply'] ?? (!isNaN(stock) ? Math.round(stock / dailyRunRate) : 45));

        // Preset 1: Restock & Stockout Triage
        if (safePreset.id === 'inventory-restock-triage' || safePreset.id.includes('restock')) {
          if ((!isNaN(stock) && stock < reorder) || dos <= leadTime) {
            decisions.push({
              rowIndex: i,
              choice: 'Urgent Expedite (Stockout Risk)',
              confidence: 0.96,
              severity: 'critical',
              reasoningSummary: `Stock (${stock}) breached reorder point (${reorder}); ${dos}d supply left vs ${leadTime}d supplier lead time.`
            });
            continue;
          } else if ((!isNaN(stock) && stock <= reorder * 1.35) || dos <= leadTime * 1.6) {
            decisions.push({
              rowIndex: i,
              choice: 'Standard Reorder Needed',
              confidence: 0.91,
              severity: 'high',
              reasoningSummary: `Approaching reorder threshold (${reorder} units); ${dos}d buffer remaining with ${leadTime}d lead time.`
            });
            continue;
          } else if (dos > 140) {
            decisions.push({
              rowIndex: i,
              choice: 'Overstocked Supply',
              confidence: 0.88,
              severity: 'medium',
              reasoningSummary: `Excess safety buffer (${dos} days of supply); on-hand inventory (${stock}) exceeds quarterly demand run-rate.`
            });
            continue;
          } else {
            decisions.push({
              rowIndex: i,
              choice: 'Healthy Stock Velocity',
              confidence: 0.94,
              severity: 'low',
              reasoningSummary: `Balanced stock: ${stock} units on hand matches ${velocity} units/mo demand with safe buffer.`
            });
            continue;
          }
        }

        // Preset 2: Markdown & Clearance Triage
        if (safePreset.id === 'inventory-markdown-clearance' || safePreset.id.includes('markdown')) {
          const holdingCost = row['Holding_Cost_Month'] ? `$${row['Holding_Cost_Month']}/mo` : 'elevated holding cost';
          const daysDormant = Number(row['Days_Dormant'] ?? dos);

          if (dos >= 150 || daysDormant >= 120 || (!isNaN(stock) && stock > 100 && velocity < 8)) {
            decisions.push({
              rowIndex: i,
              choice: 'Dead Stock Liquidation (60% Off)',
              confidence: 0.95,
              severity: 'critical',
              reasoningSummary: `Stagnant inventory (${dos} days of supply) with near-zero run-rate; accumulating ${holdingCost}.`
            });
            continue;
          } else if (dos >= 85 || daysDormant >= 60) {
            decisions.push({
              rowIndex: i,
              choice: 'Clearance Markdown (30-40%)',
              confidence: 0.90,
              severity: 'high',
              reasoningSummary: `Sluggish turnover (${dos} days of supply); recommend promotional markdown to release working capital.`
            });
            continue;
          } else if (dos >= 50) {
            decisions.push({
              rowIndex: i,
              choice: 'Promotional Bundle',
              confidence: 0.86,
              severity: 'medium',
              reasoningSummary: `Moderate overstock (${dos}d supply); optimal candidate for multi-pack bundling or catalog promo.`
            });
            continue;
          } else {
            decisions.push({
              rowIndex: i,
              choice: 'Retain Full Margin',
              confidence: 0.92,
              severity: 'low',
              reasoningSummary: `Lean inventory turnover (${dos}d supply); high sell-through rate justifies full margin retention.`
            });
            continue;
          }
        }

        // Preset 3: ABC Stratification
        if (safePreset.id === 'inventory-abc-stratification' || safePreset.id.includes('abc')) {
          const monthlyRunRateValue = (!isNaN(velocity) ? velocity : 25) * unitCost;
          if (monthlyRunRateValue >= 7500 || (velocity >= 80 && unitCost >= 70)) {
            decisions.push({
              rowIndex: i,
              choice: 'Class A - Critical Capital Driver',
              confidence: 0.95,
              severity: 'critical',
              reasoningSummary: `High capital exposure ($${Math.round(monthlyRunRateValue).toLocaleString()}/mo); mandates continuous cycle counts and tight vendor SLAs.`
            });
            continue;
          } else if (monthlyRunRateValue >= 2000 || velocity >= 35) {
            decisions.push({
              rowIndex: i,
              choice: 'Class B - Core Continuous Demand',
              confidence: 0.89,
              severity: 'medium',
              reasoningSummary: `Consistent mid-tier contributor ($${Math.round(monthlyRunRateValue).toLocaleString()}/mo); standard automated reorder point.`
            });
            continue;
          } else {
            decisions.push({
              rowIndex: i,
              choice: 'Class C - Low Frequency Tail',
              confidence: 0.88,
              severity: 'low',
              reasoningSummary: `Low capital exposure ($${Math.round(monthlyRunRateValue).toLocaleString()}/mo); manage via bulk minimum order quantities (MOQ).`
            });
            continue;
          }
        }

        // Preset 4: Supplier Lead Time & Resilience
        if (safePreset.id === 'inventory-leadtime-resilience' || safePreset.id.includes('leadtime')) {
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

          decisions.push({
            rowIndex: i,
            score: riskScore,
            severity: riskScore >= 4 ? 'high' : riskScore === 3 ? 'medium' : 'low',
            confidence: 0.93,
            reasoningSummary: riskSummary,
          });
          continue;
        }
      }

      // --- GENERAL STATISTICAL INFERENCE ENGINE ---
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
