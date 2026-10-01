import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ColumnProfile, DatasetSummary, ChartDefinition } from '../types';
import { detectBusinessDomain, BUILTIN_PRESETS } from './domain-detector';

export interface ParseResult {
  summary: DatasetSummary;
  rows: Record<string, any>[];
  charts: ChartDefinition[];
}

export async function parseDataFile(file: File): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  let rawRows: Record<string, any>[] = [];
  let sheetNames: string[] = [];
  let selectedSheet: string | undefined;

  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
    const text = await file.text();
    const parsed = Papa.parse(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
    });
    rawRows = parsed.data as Record<string, any>[];
  } else if (['xlsx', 'xls', 'xlsm', 'xlsb', 'ods'].includes(extension)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    sheetNames = workbook.SheetNames;
    selectedSheet = sheetNames[0];
    const worksheet = workbook.Sheets[selectedSheet];
    rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Record<string, any>[];
  } else {
    // Attempt CSV fallback
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true, skipEmptyLines: 'greedy' });
    rawRows = parsed.data as Record<string, any>[];
  }

  if (rawRows.length === 0) {
    throw new Error('The uploaded file does not contain any valid rows or records.');
  }

  // Extract clean headers
  const sample = rawRows[0] || {};
  const headers = Object.keys(sample).filter(h => h && !h.startsWith('__EMPTY'));

  // Clean and normalize rows
  const cleanRows = rawRows.map((row, idx) => {
    const cleanRow: Record<string, any> = { _rowIndex: idx };
    for (const h of headers) {
      cleanRow[h] = row[h];
    }
    return cleanRow;
  });

  // Profile Columns
  const columns: ColumnProfile[] = profileColumns(headers, cleanRows);

  // Detect domain
  const { domain, confidence } = detectBusinessDomain(headers);
  const suggestedPresets = BUILTIN_PRESETS[domain] || BUILTIN_PRESETS.general;

  // Auto-generate smart charts
  const charts = generateSmartCharts(columns, cleanRows);

  const summary: DatasetSummary = {
    id: `ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    filename: file.name,
    fileSizeBytes: file.size,
    format: extension.toUpperCase(),
    sheetNames,
    selectedSheet,
    rowCount: cleanRows.length,
    columnCount: headers.length,
    headers,
    columns,
    detectedDomain: domain,
    domainConfidence: confidence,
    suggestedPresets,
    activePresetId: suggestedPresets[0]?.id,
  };

  return { summary, rows: cleanRows, charts };
}

function profileColumns(headers: string[], rows: Record<string, any>[]): ColumnProfile[] {
  return headers.map(header => {
    let nullCount = 0;
    const valueMap: Record<string, number> = {};
    const numericValues: number[] = [];

    for (const row of rows) {
      const val = row[header];
      if (val === null || val === undefined || val === '') {
        nullCount += 1;
        continue;
      }

      if (typeof val === 'number' && !isNaN(val)) {
        numericValues.push(val);
      } else {
        const strVal = String(val).trim();
        valueMap[strVal] = (valueMap[strVal] || 0) + 1;
      }
    }

    const isNumeric = numericValues.length > rows.length * 0.5;
    const totalCount = rows.length;
    const uniqueCount = isNumeric ? new Set(numericValues).size : Object.keys(valueMap).length;

    let type: ColumnProfile['type'] = 'text';
    if (isNumeric) {
      type = 'numerical';
    } else if (uniqueCount <= Math.min(25, totalCount * 0.4)) {
      type = 'categorical';
    }

    let min: number | undefined;
    let max: number | undefined;
    let mean: number | undefined;
    let median: number | undefined;

    if (isNumeric && numericValues.length > 0) {
      numericValues.sort((a, b) => a - b);
      min = numericValues[0];
      max = numericValues[numericValues.length - 1];
      const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
      mean = Number((sum / numericValues.length).toFixed(2));
      const mid = Math.floor(numericValues.length / 2);
      median = numericValues.length % 2 !== 0 ? numericValues[mid] : Number(((numericValues[mid - 1] + numericValues[mid]) / 2).toFixed(2));
    }

    let categories: { label: string; count: number }[] | undefined;
    if (type === 'categorical') {
      categories = Object.entries(valueMap)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
    }

    return {
      name: header,
      type,
      totalCount,
      nullCount,
      uniqueCount,
      min,
      max,
      mean,
      median,
      categories,
    };
  });
}

function generateSmartCharts(columns: ColumnProfile[], rows: Record<string, any>[]): ChartDefinition[] {
  const charts: ChartDefinition[] = [];

  // 1. Histogram for primary numeric column
  const numericCols = columns.filter(c => c.type === 'numerical' && c.min !== undefined && c.max !== undefined && c.min !== c.max);
  if (numericCols.length > 0) {
    const primaryNum = numericCols[0];
    const bins = 10;
    const min = primaryNum.min!;
    const max = primaryNum.max!;
    const binSize = (max - min) / bins;

    const binCounts = new Array(bins).fill(0);
    const binLabels: string[] = [];

    for (let i = 0; i < bins; i++) {
      const start = min + i * binSize;
      const end = start + binSize;
      binLabels.push(`${Math.round(start)} - ${Math.round(end)}`);
    }

    for (const row of rows) {
      const val = row[primaryNum.name];
      if (typeof val === 'number') {
        const binIdx = Math.min(bins - 1, Math.max(0, Math.floor((val - min) / binSize)));
        binCounts[binIdx] += 1;
      }
    }

    charts.push({
      id: `hist_${primaryNum.name}`,
      title: `${primaryNum.name} Distribution Histogram`,
      type: 'histogram',
      description: `Binned distribution for ${primaryNum.name} across ${rows.length} records.`,
      xKey: 'Range',
      yKey: 'Frequency',
      data: binLabels.map((label, idx) => ({ range: label, count: binCounts[idx] })),
    });
  }

  // 2. Bar Chart for primary categorical column
  const catCols = columns.filter(c => c.type === 'categorical' && c.categories && c.categories.length >= 2);
  if (catCols.length > 0) {
    const primaryCat = catCols[0];
    charts.push({
      id: `bar_${primaryCat.name}`,
      title: `${primaryCat.name} Breakdown (Bar Chart)`,
      type: 'bar',
      description: `Ranked volume of top categories in ${primaryCat.name}.`,
      xKey: 'Category',
      yKey: 'Count',
      data: primaryCat.categories!.map(c => ({ category: c.label, count: c.count })),
    });
  }

  // 3. Pie/Donut Chart for secondary categorical or binary column
  if (catCols.length > 1) {
    const secondaryCat = catCols[1];
    charts.push({
      id: `pie_${secondaryCat.name}`,
      title: `${secondaryCat.name} Proportion (Donut Chart)`,
      type: 'pie',
      description: `Proportional market share of categories in ${secondaryCat.name}.`,
      xKey: 'Category',
      yKey: 'Value',
      data: secondaryCat.categories!.slice(0, 8).map(c => ({ name: c.label, value: c.count })),
    });
  } else if (catCols.length === 1 && numericCols.length > 1) {
    // If only 1 categorical, make a second histogram or scatter
    const secNum = numericCols[1];
    charts.push({
      id: `hist_${secNum.name}`,
      title: `${secNum.name} Distribution`,
      type: 'histogram',
      description: `Binned spread for ${secNum.name}.`,
      xKey: 'Range',
      yKey: 'Frequency',
      data: computeBins(secNum, rows),
    });
  }

  return charts;
}

function computeBins(col: ColumnProfile, rows: Record<string, any>[]) {
  const bins = 8;
  const min = col.min!;
  const max = col.max!;
  const binSize = (max - min) / bins || 1;
  const binCounts = new Array(bins).fill(0);
  const binLabels: string[] = [];

  for (let i = 0; i < bins; i++) {
    const start = min + i * binSize;
    binLabels.push(`${Math.round(start)}-${Math.round(start + binSize)}`);
  }

  for (const row of rows) {
    const val = row[col.name];
    if (typeof val === 'number') {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((val - min) / binSize)));
      binCounts[idx] += 1;
    }
  }

  return binLabels.map((label, idx) => ({ range: label, count: binCounts[idx] }));
}
