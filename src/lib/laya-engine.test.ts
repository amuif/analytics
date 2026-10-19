import { describe, expect, it, vi } from 'vitest';
import { LayaDecisionEngine } from './laya-engine';
import { BUILTIN_PRESETS } from './domain-detector';
import type { ColumnProfile, DecisionPreset } from '../types';

// There is no `window` under Node, so the engine never starts a worker and
// always evaluates on the main thread.
const engine = new LayaDecisionEngine();

const preset = (id: string) => Object.values(BUILTIN_PRESETS).flat().find(p => p.id === id)!;

const numeric = (name: string, min: number, max: number): ColumnProfile => ({
  name,
  type: 'numerical',
  totalCount: 10,
  nullCount: 0,
  uniqueCount: 10,
  min,
  max,
  mean: (min + max) / 2,
});

const evaluateOne = (row: Record<string, any>, p: DecisionPreset, columns: ColumnProfile[] = []) =>
  engine.evaluateOptimisticSlice([row], p, columns)[0];

describe('inventory restock triage', () => {
  const restock = preset('inventory-restock-triage');

  it.each([
    ['stock below the reorder point', { Stock_On_Hand: 10, Reorder_Point: 45, Days_Of_Supply: 60 }, 'Urgent Expedite (Stockout Risk)', 'critical'],
    ['supply that runs out within the lead time', { Stock_On_Hand: 200, Days_Of_Supply: 10, Lead_Time_Days: 14 }, 'Urgent Expedite (Stockout Risk)', 'critical'],
    ['stock just above the reorder point', { Stock_On_Hand: 55, Reorder_Point: 45, Days_Of_Supply: 60 }, 'Standard Reorder Needed', 'high'],
    ['more than 140 days of supply', { Stock_On_Hand: 500, Days_Of_Supply: 200 }, 'Overstocked Supply', 'medium'],
    ['a comfortable buffer', { Stock_On_Hand: 100, Days_Of_Supply: 60 }, 'Healthy Stock Velocity', 'low'],
  ])('flags %s', (_, row, choice, severity) => {
    expect(evaluateOne(row, restock)).toMatchObject({ choice, severity });
  });

  it('derives days of supply from stock and monthly velocity when the column is missing', () => {
    // 30 units/month is 1 unit/day, so 10 units last 10 days: inside the 14-day lead time.
    const decision = evaluateOne({ Stock_On_Hand: 10, Monthly_Sales_Velocity: 30, Reorder_Point: 5 }, restock);
    expect(decision.choice).toBe('Urgent Expedite (Stockout Risk)');
    expect(decision.reasoningSummary).toContain('10d supply left');
  });
});

describe('inventory markdown clearance', () => {
  const markdown = preset('inventory-markdown-clearance');
  const base = { Stock_Units: 50, Monthly_Sales: 20, Days_Dormant: 10 };

  it.each([
    [200, 'Dead Stock Liquidation (60% Off)'],
    [100, 'Clearance Markdown (30-40%)'],
    [60, 'Promotional Bundle'],
    [20, 'Retain Full Margin'],
  ])('maps %i days of supply to %s', (dos, choice) => {
    expect(evaluateOne({ ...base, Days_Of_Supply: dos }, markdown).choice).toBe(choice);
  });

  it('liquidates large stock that barely sells, whatever the days of supply', () => {
    const row = { Stock_Units: 150, Monthly_Sales: 5, Days_Of_Supply: 30, Days_Dormant: 10 };
    expect(evaluateOne(row, markdown).choice).toBe('Dead Stock Liquidation (60% Off)');
  });

  it('liquidates items dormant for 120 days or more', () => {
    expect(evaluateOne({ ...base, Days_Of_Supply: 20, Days_Dormant: 130 }, markdown).choice).toBe('Dead Stock Liquidation (60% Off)');
  });
});

describe('inventory ABC stratification', () => {
  const abc = preset('inventory-abc-stratification');

  it.each([
    [100, 100, 'Class A - Critical Capital Driver'],
    [40, 10, 'Class B - Core Continuous Demand'],
    [10, 10, 'Class C - Low Frequency Tail'],
  ])('classifies %i units/month at $%i as %s', (velocity, cost, choice) => {
    expect(evaluateOne({ Monthly_Sales_Velocity: velocity, Unit_Cost: cost }, abc).choice).toBe(choice);
  });
});

describe('inventory lead-time resilience', () => {
  const leadtime = preset('inventory-leadtime-resilience');

  it.each([
    [10, 1, 'low'],
    [15, 3, 'medium'],
    [25, 4, 'high'],
    [45, 5, 'high'],
  ])('scores a %i-day lead time as %i', (days, score, severity) => {
    expect(evaluateOne({ Lead_Time_Days: days }, leadtime)).toMatchObject({ score, severity });
  });

  it('scores a high-risk supplier as 5 even with a short lead time', () => {
    expect(evaluateOne({ Lead_Time_Days: 5, Supplier_Reliability: 'High Risk' }, leadtime).score).toBe(5);
  });
});

describe('general statistical scoring', () => {
  const custom = (overrides: Partial<DecisionPreset>): DecisionPreset => ({
    id: 'test',
    name: 'Test',
    domain: 'general',
    description: '',
    targetQuestion: '',
    outputType: 'choice',
    criteria: 'rating',
    ...overrides,
  });

  it('picks the first choice for the best record and the last for the worst', () => {
    const performance = preset('hr-performance-triage');
    const columns = [numeric('rating', 1, 5)];

    expect(evaluateOne({ rating: 5 }, performance, columns)).toMatchObject({
      choice: 'Top Performer',
      severity: 'low',
      confidence: 0.98,
      reasoningSummary: 'Strong rating (5)',
    });
    expect(evaluateOne({ rating: 1 }, performance, columns)).toMatchObject({
      choice: 'Immediate PIP Needed',
      severity: 'critical',
      reasoningSummary: 'Below avg rating (1)',
    });
  });

  it('treats risk-like columns such as refunds as worse when higher', () => {
    const p = custom({ choices: ['Good', 'Bad'], criteria: 'refund_rate' });
    const columns = [numeric('refund_rate', 0, 10)];

    expect(evaluateOne({ refund_rate: 10 }, p, columns)).toMatchObject({
      choice: 'Bad',
      reasoningSummary: 'Elevated refund_rate (10)',
    });
    expect(evaluateOne({ refund_rate: 0 }, p, columns).choice).toBe('Good');
  });

  it('maps the composite score onto a 1-5 scale', () => {
    const p = custom({ outputType: 'score' });
    const columns = [numeric('rating', 0, 100)];

    expect(evaluateOne({ rating: 0 }, p, columns).score).toBe(1);
    expect(evaluateOne({ rating: 50 }, p, columns).score).toBe(3);
    expect(evaluateOne({ rating: 100 }, p, columns)).toMatchObject({ score: 5, severity: 'high' });
  });

  it('answers boolean presets with a 0.52 threshold', () => {
    const p = custom({ outputType: 'boolean' });
    const columns = [numeric('rating', 0, 100)];

    expect(evaluateOne({ rating: 90 }, p, columns)).toMatchObject({ boolean: true, severity: 'high' });
    expect(evaluateOne({ rating: 50 }, p, columns)).toMatchObject({ boolean: false, severity: 'low' });
  });

  it('falls back to every numeric column when no column matches the criteria', () => {
    const p = custom({ choices: ['High', 'Low'], criteria: 'nothing_matches_this' });
    const columns = [numeric('units', 0, 10)];

    expect(evaluateOne({ units: 10 }, p, columns).choice).toBe('High');
    expect(evaluateOne({ units: 0 }, p, columns).choice).toBe('Low');
  });

  it('scores a record with no usable values as neutral', () => {
    const p = custom({ choices: ['A', 'B', 'C'] });
    const decision = evaluateOne({ rating: 'n/a' }, p, [numeric('rating', 0, 10)]);

    expect(decision).toMatchObject({ choice: 'B', confidence: 0.75, reasoningSummary: 'Composite index: 50%' });
  });
});

describe('evaluateOptimisticSlice', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ Lead_Time_Days: i }));
  const leadtime = preset('inventory-leadtime-resilience');

  it('evaluates only the requested window of rows', () => {
    const decisions = engine.evaluateOptimisticSlice(rows, leadtime, [], 3, 4);
    expect(decisions.map(d => d.rowIndex)).toEqual([4, 5, 6]);
  });

  it('stops at the end of the dataset', () => {
    const decisions = engine.evaluateOptimisticSlice(rows, leadtime, [], 25, 8);
    expect(decisions.map(d => d.rowIndex)).toEqual([8, 9]);
  });

  it('returns nothing for an empty dataset', () => {
    expect(engine.evaluateOptimisticSlice([], leadtime, [])).toEqual([]);
  });
});

describe('evaluateDataset', () => {
  const leadtime = preset('inventory-leadtime-resilience');
  const makeRows = (n: number) => Array.from({ length: n }, (_, i) => ({ Lead_Time_Days: i % 40 }));

  it('seeds the first 50 rows, then streams the rest of a small dataset', async () => {
    const onChunk = vi.fn();
    const decisions = await engine.evaluateDataset('ds', makeRows(80), leadtime, [], onChunk);

    expect(decisions.map(d => d.rowIndex)).toEqual(Array.from({ length: 80 }, (_, i) => i));
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk.mock.calls[0][0]).toHaveLength(50);
    expect(onChunk.mock.calls[0].slice(1)).toEqual([50, 80]);
    expect(onChunk.mock.calls[1][0]).toHaveLength(30);
    expect(onChunk.mock.calls[1].slice(1)).toEqual([80, 80]);
  });

  it('sends a single chunk when the dataset fits in the seed', async () => {
    const onChunk = vi.fn();
    const decisions = await engine.evaluateDataset('ds', makeRows(20), leadtime, [], onChunk);

    expect(decisions).toHaveLength(20);
    expect(onChunk).toHaveBeenCalledTimes(1);
  });

  it('evaluates large datasets on the main thread when no worker is available', async () => {
    const onChunk = vi.fn();
    const decisions = await engine.evaluateDataset('ds', makeRows(250), leadtime, [], onChunk);

    expect(decisions).toHaveLength(250);
    expect(onChunk).toHaveBeenLastCalledWith(decisions, 250, 250);
  });

  it('returns nothing for an empty dataset', async () => {
    expect(await engine.evaluateDataset('ds', [], leadtime, [])).toEqual([]);
  });
});
