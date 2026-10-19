import { describe, expect, it } from 'vitest';
import { BUILTIN_PRESETS, detectBusinessDomain } from './domain-detector';
import type { BusinessDomain } from '../types';

describe('detectBusinessDomain', () => {
  it('recognises an inventory dataset with high confidence', () => {
    const result = detectBusinessDomain(['SKU', 'Stock_On_Hand', 'Reorder_Point', 'Lead_Time_Days']);

    expect(result.domain).toBe('inventory');
    expect(result.confidence).toBe(0.99);
    expect(result.matchedKeywords).toEqual(['sku', 'stock_on_hand', 'reorder_point', 'lead_time_days']);
  });

  it('recognises an HR dataset', () => {
    expect(detectBusinessDomain(['Employee_ID', 'Salary', 'Department', 'Hire_Date']).domain).toBe('hr');
  });

  it('normalises spaces and punctuation in headers before matching', () => {
    const result = detectBusinessDomain(['Stock On-Hand', 'Unit Cost']);

    expect(result.domain).toBe('inventory');
    expect(result.matchedKeywords).toEqual(['stock_on_hand', 'unit_cost']);
  });

  it('falls back to general with 0.5 confidence when no business keyword matches', () => {
    const result = detectBusinessDomain(['id', 'name']);

    expect(result).toEqual({ domain: 'general', confidence: 0.5, matchedKeywords: ['id', 'name'] });
  });

  it('breaks ties in favour of inventory', () => {
    // One inventory keyword (sku) and one sales keyword (revenue).
    expect(detectBusinessDomain(['sku', 'revenue']).domain).toBe('inventory');
  });

  it('never reports a matched domain below 0.70 confidence', () => {
    const headers = ['ticket', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
    const result = detectBusinessDomain(headers);

    expect(result.domain).toBe('support');
    expect(result.confidence).toBe(0.7);
  });
});

describe('BUILTIN_PRESETS', () => {
  const all = Object.values(BUILTIN_PRESETS).flat();

  it('offers at least one preset for every domain', () => {
    for (const [domain, presets] of Object.entries(BUILTIN_PRESETS)) {
      expect(presets.length, domain).toBeGreaterThan(0);
    }
  });

  it('files every preset under its own domain', () => {
    for (const [domain, presets] of Object.entries(BUILTIN_PRESETS)) {
      for (const preset of presets) expect(preset.domain, preset.id).toBe(domain as BusinessDomain);
    }
  });

  it('uses unique preset ids', () => {
    const ids = all.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives choice presets choices and score presets a scale', () => {
    for (const preset of all) {
      if (preset.outputType === 'choice') expect(preset.choices?.length, preset.id).toBeGreaterThan(1);
      if (preset.outputType === 'score') {
        expect(preset.scoreScale, preset.id).toBeDefined();
        expect(preset.scoreScale!.min).toBeLessThan(preset.scoreScale!.max);
      }
    }
  });
});
