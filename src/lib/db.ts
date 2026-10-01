import Dexie, { type Table } from 'dexie';
import type { DatasetSummary, RowDecision, ChartDefinition } from '../types';

export interface DBDatasetRecord {
  id: string;
  summary: DatasetSummary;
  charts: ChartDefinition[];
  createdAt: number;
}

export interface DBRowRecord {
  id?: number;
  datasetId: string;
  rowIndex: number;
  data: Record<string, any>;
}

export interface DBDecisionRecord {
  id?: number;
  datasetId: string;
  rowIndex: number;
  decision: RowDecision;
}

export class LayaAnalyticsDatabase extends Dexie {
  datasets!: Table<DBDatasetRecord, string>;
  rows!: Table<DBRowRecord, number>;
  decisions!: Table<DBDecisionRecord, number>;

  constructor() {
    super('LayaAnalyticsDB');
    this.version(1).stores({
      datasets: 'id, createdAt',
      rows: '++id, datasetId, rowIndex, [datasetId+rowIndex]',
      decisions: '++id, datasetId, rowIndex, [datasetId+rowIndex]',
    });
  }

  async saveDataset(summary: DatasetSummary, rows: Record<string, any>[], charts: ChartDefinition[]): Promise<void> {
    await this.transaction('rw', [this.datasets, this.rows, this.decisions], async () => {
      // Clear old rows/decisions for this dataset if re-uploading
      await this.rows.where('datasetId').equals(summary.id).delete();
      await this.decisions.where('datasetId').equals(summary.id).delete();

      await this.datasets.put({
        id: summary.id,
        summary,
        charts,
        createdAt: Date.now(),
      });

      // Bulk add rows in chunks for high throughput without memory spikes
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const slice = rows.slice(i, i + CHUNK_SIZE);
        const records: DBRowRecord[] = slice.map((data, idx) => ({
          datasetId: summary.id,
          rowIndex: i + idx,
          data,
        }));
        await this.rows.bulkAdd(records);
      }
    });
  }

  async getLatestDataset(): Promise<{ summary: DatasetSummary; charts: ChartDefinition[]; rows: Record<string, any>[] } | null> {
    const latest = await this.datasets.orderBy('createdAt').reverse().first();
    if (!latest) return null;

    const rowRecords = await this.rows.where('datasetId').equals(latest.id).toArray();
    rowRecords.sort((a, b) => a.rowIndex - b.rowIndex);
    const rows = rowRecords.map(r => r.data);

    return {
      summary: latest.summary,
      charts: latest.charts,
      rows,
    };
  }

  async saveDecisions(datasetId: string, decisions: RowDecision[]): Promise<void> {
    await this.transaction('rw', this.decisions, async () => {
      await this.decisions.where('datasetId').equals(datasetId).delete();
      const records: DBDecisionRecord[] = decisions.map(d => ({
        datasetId,
        rowIndex: d.rowIndex,
        decision: d,
      }));
      await this.decisions.bulkAdd(records);
    });
  }

  async getDecisions(datasetId: string): Promise<RowDecision[]> {
    const records = await this.decisions.where('datasetId').equals(datasetId).toArray();
    records.sort((a, b) => a.rowIndex - b.rowIndex);
    return records.map(r => r.decision);
  }
}

export const db = new LayaAnalyticsDatabase();
