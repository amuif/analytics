import type { StressTelemetry } from '../types';

export class StressMonitor {
  private lastTime = performance.now();
  private frames = 0;
  private currentFps = 60;
  private droppedFrames = 0;
  private animFrameId: number | null = null;
  private hasWebGpu = false;

  constructor() {
    this.detectEnvironment();
    this.startFpsLoop();
  }

  private async detectEnvironment() {
    // Check WebGPU support
    if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
      try {
        const adapter = await (navigator as any).gpu.requestAdapter();
        this.hasWebGpu = !!adapter;
      } catch {
        this.hasWebGpu = false;
      }
    }
  }

  private startFpsLoop = () => {
    const loop = (now: number) => {
      this.frames++;
      const delta = now - this.lastTime;

      if (delta >= 1000) {
        this.currentFps = Math.min(60, Math.round((this.frames * 1000) / delta));
        if (this.currentFps < 55) {
          this.droppedFrames += 60 - this.currentFps;
        }
        this.frames = 0;
        this.lastTime = now;
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  };

  getTelemetry(processedRows = 0, totalRows = 0, renderLatencyMs = 0, processingDurationSec = 1): StressTelemetry {
    let memoryUsedMB = 45;
    let memoryLimitMB = 2048;
    let heapPercent = 5;

    // Check performance.memory (Chrome / Edge / Tauri WebView2)
    const perf = window.performance as any;
    if (perf && perf.memory) {
      memoryUsedMB = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
      memoryLimitMB = Math.round(perf.memory.jsHeapSizeLimit / (1024 * 1024));
      heapPercent = Math.min(100, Math.round((memoryUsedMB / memoryLimitMB) * 100));
    }

    const throughputRowsSec = processingDurationSec > 0
      ? Math.round(processedRows / Math.max(0.1, processingDurationSec))
      : 0;

    let stressLevel: StressTelemetry['stressLevel'] = 'low';
    if (heapPercent > 80 || this.currentFps < 30 || renderLatencyMs > 350) {
      stressLevel = 'high';
    } else if (heapPercent > 60 || this.currentFps < 48 || renderLatencyMs > 150) {
      stressLevel = 'moderate';
    }

    const hardwareMode: StressTelemetry['hardwareMode'] = this.hasWebGpu
      ? 'WebGPU (Hardware Accelerated)'
      : 'WASM-SIMD (Multi-threaded)';

    return {
      memoryUsedMB,
      memoryLimitMB,
      heapUsagePercent: heapPercent,
      fps: this.currentFps,
      droppedFrames: this.droppedFrames,
      renderLatencyMs,
      processedRows,
      totalRows,
      throughputRowsSec,
      stressLevel,
      hardwareMode,
    };
  }

  destroy() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}

export const stressMonitor = new StressMonitor();
