import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { ColumnProfile, DatasetSummary, ChartDefinition } from '../types';
import { detectBusinessDomain, BUILTIN_PRESETS } from './domain-detector';

export interface ParseResult {
  summary: DatasetSummary;
  rows: Record<string, any>[];
  charts: ChartDefinition[];
}

// Files are parsed in memory and copied into IndexedDB, so cap the input size
// to keep the tab responsive and within browser storage quotas.
export const MAX_FILE_SIZE_MB = 50;

export async function parseDataFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`${file.name} is ${sizeMB} MB. The maximum supported file size is ${MAX_FILE_SIZE_MB} MB.`);
  }

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

function formatCompactNumber(num: number): string {
  const abs = Math.abs(num);
  if (abs >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (abs >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
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
    const span = max - min || 1;
    const binSize = span / bins;

    const binCounts = new Array(bins).fill(0);
    const binLabels: string[] = [];

    for (let i = 0; i < bins; i++) {
      const start = min + i * binSize;
      const end = start + binSize;
      binLabels.push(`${formatCompactNumber(start)} – ${formatCompactNumber(end)}`);
    }

    for (const row of rows) {
      const val = row[primaryNum.name];
      if (typeof val === 'number') {
        const binIdx = Math.min(bins - 1, Math.max(0, Math.floor((val - min) / binSize)));
        binCounts[binIdx] += 1;
      }
    }

    let peakIdx = 0;
    let peakCount = 0;
    binCounts.forEach((c, idx) => {
      if (c > peakCount) {
        peakCount = c;
        peakIdx = idx;
      }
    });

    const peakShare = Math.round((peakCount / Math.max(1, rows.length)) * 100);
    const meanVal = primaryNum.mean !== undefined ? primaryNum.mean : (min + max) / 2;
    const medianVal = primaryNum.median !== undefined ? primaryNum.median : meanVal;
    const skew = meanVal > medianVal
      ? 'Right-skewed (positive tail towards high values)'
      : meanVal < medianVal
        ? 'Left-skewed (tail towards lower values)'
        : 'Symmetric normal distribution';

    charts.push({
      id: `hist_${primaryNum.name}`,
      title: `${primaryNum.name} Distribution`,
      type: 'histogram',
      description: `Binned spread for ${primaryNum.name} across ${rows.length.toLocaleString()} records.`,
      xKey: 'Range',
      yKey: 'Frequency',
      data: binLabels.map((label, idx) => ({ range: label, count: binCounts[idx] })),
      insights: {
        methodology: `Divided into ${bins} uniform buckets across the range [${Math.round(min).toLocaleString()} to ${Math.round(max).toLocaleString()}], with a bucket width of ${Math.round(binSize).toLocaleString()} units.`,
        keyFindings: [
          `Peak concentration: The mode bucket "${binLabels[peakIdx]}" contains ${peakCount.toLocaleString()} records (${peakShare}% of total dataset volume).`,
          `Central tendency: Mean is ${meanVal.toLocaleString()} vs median of ${medianVal.toLocaleString()} (${skew}).`,
          `Boundary range: Spread is ${Math.round(span).toLocaleString()} units from minimum of ${Math.round(min).toLocaleString()} to maximum of ${Math.round(max).toLocaleString()}.`
        ],
        metricSummary: [
          { label: 'Bucket Step Size', value: Math.round(binSize).toLocaleString() },
          { label: 'Peak Volume', value: `${peakShare}%` },
          { label: 'Median Value', value: Math.round(medianVal).toLocaleString() },
          { label: 'Total Spread', value: Math.round(span).toLocaleString() }
        ]
      }
    });
  }

  // 2. Categorical columns sorted to prefer high-level categories (3-10 distinct values)
  const catCols = columns
    .filter(c => c.type === 'categorical' && c.categories && c.categories.length >= 2)
    .sort((a, b) => {
      const scoreA = a.uniqueCount >= 3 && a.uniqueCount <= 8 ? 0 : a.uniqueCount;
      const scoreB = b.uniqueCount >= 3 && b.uniqueCount <= 8 ? 0 : b.uniqueCount;
      return scoreA - scoreB;
    });

  if (catCols.length > 0) {
    const primaryCat = catCols[0];
    const topCat = primaryCat.categories![0];
    const topShare = Math.round((topCat.count / Math.max(1, rows.length)) * 100);
    const top3Count = primaryCat.categories!.slice(0, 3).reduce((acc, c) => acc + c.count, 0);
    const top3Share = Math.round((top3Count / Math.max(1, rows.length)) * 100);

    // Limit to Top 7 categories + consolidated 'Other' bucket to prevent X-axis overcrowding
    const maxBarItems = 7;
    const topItems = primaryCat.categories!.slice(0, maxBarItems);
    const barChartData = topItems.map(c => ({ category: c.label, count: c.count }));

    if (primaryCat.categories!.length > maxBarItems) {
      const remainingCount = primaryCat.categories!.slice(maxBarItems).reduce((acc, c) => acc + c.count, 0);
      barChartData.push({
        category: `Other (${primaryCat.categories!.length - maxBarItems} more)`,
        count: remainingCount,
      });
    }

    charts.push({
      id: `bar_${primaryCat.name}`,
      title: `${primaryCat.name} Breakdown`,
      type: 'bar',
      description: `Ranked volume of top groups in ${primaryCat.name}.`,
      xKey: 'Category',
      yKey: 'Count',
      data: barChartData,
      insights: {
        methodology: `Ranked frequency for "${primaryCat.name}", displaying top ${Math.min(maxBarItems, primaryCat.uniqueCount)} of ${primaryCat.uniqueCount} distinct groups.`,
        keyFindings: [
          `Leading segment: "${topCat.label}" accounts for ${topCat.count.toLocaleString()} entries (${topShare}% volume).`,
          `Top 3 concentration: The top 3 categories represent ${top3Share}% of total records.`,
          `Catalog breadth: ${primaryCat.uniqueCount} total unique groups detected across ${rows.length.toLocaleString()} records.`
        ],
        metricSummary: [
          { label: 'Unique Groups', value: String(primaryCat.uniqueCount) },
          { label: 'Top Group', value: topCat.label },
          { label: 'Leader Share', value: `${topShare}%` },
          { label: 'Top 3 Share', value: `${top3Share}%` }
        ]
      }
    });
  }

  // 3. Pie/Donut Chart for secondary categorical or binary column
  if (catCols.length > 1) {
    const secondaryCat = catCols[1];
    const topSlice = secondaryCat.categories![0];
    const topSliceShare = Math.round((topSlice.count / Math.max(1, rows.length)) * 100);

    // Limit pie chart to Top 5 slices + Other to keep legends and segments pristine
    const maxPieItems = 5;
    const topPieItems = secondaryCat.categories!.slice(0, maxPieItems);
    const pieChartData = topPieItems.map(c => ({ name: c.label, value: c.count }));

    if (secondaryCat.categories!.length > maxPieItems) {
      const remainingPie = secondaryCat.categories!.slice(maxPieItems).reduce((acc, c) => acc + c.count, 0);
      pieChartData.push({
        name: `Other (${secondaryCat.categories!.length - maxPieItems} more)`,
        value: remainingPie,
      });
    }

    charts.push({
      id: `pie_${secondaryCat.name}`,
      title: `${secondaryCat.name} Proportion`,
      type: 'pie',
      description: `Market share distribution across ${secondaryCat.name}.`,
      xKey: 'Category',
      yKey: 'Value',
      data: pieChartData,
      insights: {
        methodology: `Proportional partition across values in "${secondaryCat.name}".`,
        keyFindings: [
          `Primary segment: "${topSlice.label}" constitutes ${topSliceShare}% of the segmented population.`,
          `Segmentation depth: Top ${Math.min(maxPieItems, secondaryCat.categories!.length)} key segments visualized.`
        ],
        metricSummary: [
          { label: 'Primary Segment', value: topSlice.label },
          { label: 'Segment Share', value: `${topSliceShare}%` },
          { label: 'Slices Rendered', value: String(pieChartData.length) }
        ]
      }
    });
  }

  return charts;
}
