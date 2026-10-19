import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LayaAnalyticsDatabase } from './db';
import type { DatasetSummary, RowDecision } from '../types';

const summary = (id: string): DatasetSummary => ({
  id,
  filename: `${id}.csv`,
  fileSizeBytes: 100,
  format: 'CSV',
  rowCount: 0,
  columnCount: 1,
  headers: ['value'],
  columns: [],
  detectedDomain: 'general',
  domainConfidence: 0.5,
  suggestedPresets: [],
});

const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ _rowIndex: i, value: i * 2 }));

const decision = (rowIndex: number): RowDecision => ({ rowIndex, confidence: 0.9, reasoningSummary: `row ${rowIndex}` });

let db: LayaAnalyticsDatabase;

beforeEach(async () => {
  db = new LayaAnalyticsDatabase();
  await db.delete();
  await db.open();
});

describe('LayaAnalyticsDatabase', () => {
  it('returns null before anything is saved', async () => {
    expect(await db.getLatestDataset()).toBeNull();
  });

  it('round-trips a dataset, keeping row order across insert chunks', async () => {
    // More than one 1,000-row insert chunk.
    const rows = rowsOf(2500);
    await db.saveDataset(summary('a'), rows, []);

    const saved = await db.getLatestDataset();
    expect(saved!.summary.id).toBe('a');
    expect(saved!.rows).toEqual(rows);
  });

  it('restores the most recently saved dataset', async () => {
    await db.saveDataset(summary('old'), rowsOf(3), []);
    await new Promise(r => setTimeout(r, 5));
    await db.saveDataset(summary('new'), rowsOf(2), []);

    const saved = await db.getLatestDataset();
    expect(saved!.summary.id).toBe('new');
    expect(saved!.rows).toHaveLength(2);
  });

  it('replaces the rows and drops the decisions when a dataset is saved again', async () => {
    await db.saveDataset(summary('a'), rowsOf(10), []);
    await db.saveDecisions('a', [decision(0), decision(1)]);

    await db.saveDataset(summary('a'), rowsOf(4), []);

    expect((await db.getLatestDataset())!.rows).toHaveLength(4);
    expect(await db.getDecisions('a')).toEqual([]);
  });

  it('stores decisions per dataset, sorted by row', async () => {
    await db.saveDecisions('a', [decision(2), decision(0), decision(1)]);
    await db.saveDecisions('b', [decision(0)]);

    expect((await db.getDecisions('a')).map(d => d.rowIndex)).toEqual([0, 1, 2]);
    expect(await db.getDecisions('b')).toEqual([decision(0)]);
  });

  it('overwrites earlier decisions for the same dataset', async () => {
    await db.saveDecisions('a', [decision(0), decision(1), decision(2)]);
    await db.saveDecisions('a', [decision(5)]);

    expect(await db.getDecisions('a')).toEqual([decision(5)]);
  });
});
