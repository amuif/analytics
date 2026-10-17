import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseDataFile, MAX_FILE_SIZE_MB } from './parser';

const csv = (name: string, text: string) => new File([text], name, { type: 'text/csv' });

const SALES_CSV = [
  'region,product,revenue',
  'North,Widget,100',
  'South,Gadget,250',
  'North,Widget,175',
  'East,Gizmo,90',
  'South,Widget,300',
].join('\n');

describe('parseDataFile', () => {
  it('parses CSV rows and profiles each column', async () => {
    const { summary, rows } = await parseDataFile(csv('sales.csv', SALES_CSV));

    expect(summary.format).toBe('CSV');
    expect(summary.rowCount).toBe(5);
    expect(summary.headers).toEqual(['region', 'product', 'revenue']);
    expect(rows[0]).toEqual({ _rowIndex: 0, region: 'North', product: 'Widget', revenue: 100 });

    const revenue = summary.columns.find(c => c.name === 'revenue')!;
    expect(revenue.type).toBe('numerical');
    expect(revenue.min).toBe(90);
    expect(revenue.max).toBe(300);
    expect(revenue.median).toBe(175);
  });

  it('generates a histogram for numeric data and a bar chart for categories', async () => {
    // A column counts as categorical only when its distinct values are at most 40% of the rows.
    const regions = ['North', 'South', 'East'];
    const lines = ['region,revenue'];
    for (let i = 0; i < 20; i++) lines.push(`${regions[i % 3]},${(i + 1) * 10}`);

    const { charts } = await parseDataFile(csv('sales.csv', lines.join('\n')));
    const types = charts.map(c => c.type);

    expect(types).toContain('histogram');
    expect(types).toContain('bar');

    const histogram = charts.find(c => c.type === 'histogram')!;
    const total = histogram.data.reduce((sum, bin) => sum + (bin.count as number), 0);
    expect(total).toBe(20);
  });

  it('skips blank lines', async () => {
    const { summary } = await parseDataFile(csv('gaps.csv', 'a,b\n1,2\n\n   \n3,4\n'));
    expect(summary.rowCount).toBe(2);
  });

  it('reads the first sheet of an Excel workbook', async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { item: 'Bolt', qty: 10 },
      { item: 'Nut', qty: 25 },
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Stock');
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

    const { summary, rows } = await parseDataFile(new File([bytes], 'stock.xlsx'));

    expect(summary.format).toBe('XLSX');
    expect(summary.sheetNames).toEqual(['Stock']);
    expect(summary.selectedSheet).toBe('Stock');
    expect(rows.map(r => r.qty)).toEqual([10, 25]);
  });

  it('rejects a file with no data rows', async () => {
    await expect(parseDataFile(csv('empty.csv', 'a,b\n'))).rejects.toThrow(/does not contain any valid rows/);
  });

  it('rejects files over the size limit before reading them', async () => {
    const oversized = new File(['x'], 'big.csv');
    Object.defineProperty(oversized, 'size', { value: MAX_FILE_SIZE_MB * 1024 * 1024 + 1 });

    await expect(parseDataFile(oversized)).rejects.toThrow(`maximum supported file size is ${MAX_FILE_SIZE_MB} MB`);
  });
});
