import { describe, expect, it } from 'vitest';
import { SAMPLE_DATASETS } from './sample-datasets';
import { detectBusinessDomain } from './domain-detector';

describe('SAMPLE_DATASETS', () => {
  for (const sample of SAMPLE_DATASETS) {
    describe(sample.name, () => {
      const rows = sample.generateRows();

      it('generates rows that all share the same columns', () => {
        expect(rows.length).toBeGreaterThan(0);
        const headers = Object.keys(rows[0]);
        for (const row of rows) expect(Object.keys(row)).toEqual(headers);
      });

      it('has no missing values', () => {
        for (const row of rows) {
          for (const value of Object.values(row)) {
            expect(value).not.toBeNull();
            expect(value).not.toBeUndefined();
            if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
          }
        }
      });

      it('is detected as the domain it advertises', () => {
        const { domain } = detectBusinessDomain(Object.keys(rows[0]));
        expect(domain).toBe(sample.domain.toLowerCase());
      });

      it('uses a .csv filename', () => {
        expect(sample.filename).toMatch(/\.csv$/);
      });
    });
  }
});
