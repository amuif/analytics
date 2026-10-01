import type { DecisionPreset, RowDecision, ColumnProfile } from '../types';
import type { WorkerMessageRequest, WorkerMessageResponse } from '../workers/laya.worker';

export type DecisionProgressCallback = (processed: number, total: number) => void;

export class LayaDecisionEngine {
  private worker: Worker | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      this.worker = new Worker(new URL('../workers/laya.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (e) {
      console.warn('Worker initialization failed, fallback to main thread mode:', e);
      this.worker = null;
    }
  }

  async evaluateDataset(
    datasetId: string,
    rows: Record<string, any>[],
    preset: DecisionPreset,
    columns: ColumnProfile[],
    onProgress?: DecisionProgressCallback
  ): Promise<RowDecision[]> {
    if (!this.worker) {
      this.initWorker();
    }

    if (!this.worker) {
      throw new Error('Web Worker is unavailable in this environment.');
    }

    return new Promise((resolve, reject) => {
      const handleMessage = (event: MessageEvent<WorkerMessageResponse>) => {
        const { type, processed, total, decisions, error } = event.data;

        if (type === 'PROGRESS' && processed !== undefined && total !== undefined) {
          onProgress?.(processed, total);
        } else if (type === 'COMPLETE' && decisions) {
          this.worker?.removeEventListener('message', handleMessage);
          resolve(decisions);
        } else if (type === 'ERROR') {
          this.worker?.removeEventListener('message', handleMessage);
          reject(new Error(error || 'Laya worker encountered an unexpected evaluation failure.'));
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
