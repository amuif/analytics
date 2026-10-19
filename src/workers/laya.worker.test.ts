import { beforeAll, describe, expect, it, vi } from 'vitest';
import { LayaDecisionEngine } from '../lib/laya-engine';
import { BUILTIN_PRESETS } from '../lib/domain-detector';
import { parseDataFile } from '../lib/parser';
import { SAMPLE_DATASETS } from '../lib/sample-datasets';
import type { WorkerMessageRequest, WorkerMessageResponse } from './laya.worker';
import type { ColumnProfile, DecisionPreset } from '../types';

// The worker installs `self.onmessage` when it loads, so give it a stand-in
// `self` that records what it posts back.
const posted: WorkerMessageResponse[] = [];
const workerSelf: { onmessage?: (event: { data: WorkerMessageRequest }) => void; postMessage: (msg: WorkerMessageResponse) => void } = {
  postMessage: msg => posted.push(msg),
};

beforeAll(async () => {
  vi.stubGlobal('self', workerSelf);
  await import('./laya.worker');
});

const run = (rows: Record<string, any>[], preset: DecisionPreset, columns: ColumnProfile[] = []) => {
  posted.length = 0;
  workerSelf.onmessage!({ data: { type: 'EVALUATE_BATCH', datasetId: 'ds', rows, preset, columns } });
  return [...posted];
};

const leadtime = BUILTIN_PRESETS.inventory.find(p => p.id === 'inventory-leadtime-resilience')!;

describe('laya worker', () => {
  it('streams decisions in chunks of 25 and then completes', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ Lead_Time_Days: i }));
    const messages = run(rows, leadtime);

    expect(messages.map(m => [m.type, m.processed])).toEqual([
      ['STREAM_CHUNK', 25],
      ['STREAM_CHUNK', 50],
      ['STREAM_CHUNK', 60],
      ['COMPLETE', 60],
    ]);
    expect(messages.slice(0, 3).map(m => m.chunk!.length)).toEqual([25, 25, 10]);

    const complete = messages[3];
    expect(complete.datasetId).toBe('ds');
    expect(complete.decisions!.map(d => d.rowIndex)).toEqual(rows.map((_, i) => i));
  });

  it('completes immediately for an empty dataset', () => {
    expect(run([], leadtime)).toEqual([{ type: 'COMPLETE', datasetId: 'ds', processed: 0, total: 0, decisions: [] }]);
  });

  it('reports an error instead of throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const messages = run([{}], { ...leadtime, id: undefined as unknown as string });

    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe('ERROR');
    expect(messages[0].error).toBeTruthy();
  });
});

// The worker and LayaDecisionEngine.evaluateOptimisticSlice carry separate
// copies of the decision rules. The UI shows the engine's answer first and then
// replaces it with the worker's, so the two must agree row for row.
describe('worker and main-thread engine agree', () => {
  const engine = new LayaDecisionEngine();
  const presets = Object.values(BUILTIN_PRESETS).flat();

  const toCsv = (rows: Record<string, any>[]) => {
    const headers = Object.keys(rows[0]);
    const lines = rows.map(r => headers.map(h => {
      const v = r[h];
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
    }).join(','));
    return [headers.join(','), ...lines].join('\n');
  };

  const expectAgreement = async (filename: string, rawRows: Record<string, any>[]) => {
    const file = new File([toCsv(rawRows)], filename, { type: 'text/csv' });
    const { rows, summary } = await parseDataFile(file);

    for (const preset of presets) {
      const fromWorker = run(rows, preset, summary.columns).at(-1)!.decisions;
      const fromEngine = engine.evaluateOptimisticSlice(rows, preset, summary.columns, rows.length);
      expect(fromWorker, preset.id).toEqual(fromEngine);
    }
  };

  for (const sample of SAMPLE_DATASETS) {
    it(`on every preset for "${sample.name}"`, () => expectAgreement(sample.filename, sample.generateRows()));
  }

  it('on rows sitting at every inventory threshold', () => {
    // Values on and either side of each cut-off in the inventory rules.
    const grid: Record<string, any>[] = [];
    for (const dos of [10, 14, 22, 23, 49, 50, 59, 60, 84, 85, 119, 120, 140, 141, 149, 150])
      for (const stock of [5, 45, 60, 61, 100, 101])
        for (const lead of [12, 13, 20, 21, 30, 31])
          for (const velocity of [5, 8, 34, 35, 80])
            for (const cost of [10, 70, 100])
              grid.push({ Stock_On_Hand: stock, Monthly_Sales_Velocity: velocity, Lead_Time_Days: lead, Days_Of_Supply: dos, Days_Dormant: dos, Unit_Cost: cost });
    return expectAgreement('grid.csv', grid);
  });
});
