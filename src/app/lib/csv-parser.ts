/**
 * Parse Zillow CSV data from their public CDN.
 * Handles quoted fields (metro names with commas).
 */

export interface ZillowRow {
  regionId: string;
  sizeRank: number;
  regionName: string;
  regionType: string;
  stateName: string;
  // Extra columns vary by geographic level
  extras: Record<string, string>;
  // Date → heat_index value
  values: Record<string, number>;
}

export interface ParsedCSV {
  rows: ZillowRow[];
  dateColumns: string[];
}

/**
 * Parse a CSV string handling quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

/**
 * Fetch and parse a Zillow CSV from their CDN.
 * Returns parsed rows with date-indexed values.
 */
export async function fetchAndParseCSV(url: string): Promise<ParsedCSV> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RealEstateHeatmap/1.0)',
    },
    next: { revalidate: 3600 }, // Cache for 1 hour
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSV: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);

  // Find date columns (YYYY-MM-DD format)
  const dateColumns = headers.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));
  const firstDateIdx = headers.indexOf(dateColumns[0]);

  const rows: ZillowRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 5) continue;

    // Build extras from non-standard columns (between StateName and first date)
    const extras: Record<string, string> = {};
    for (let j = 5; j < firstDateIdx; j++) {
      extras[headers[j]] = values[j] || '';
    }

    // Build date→value map
    const dateValues: Record<string, number> = {};
    for (const dateCol of dateColumns) {
      const idx = headers.indexOf(dateCol);
      const val = parseFloat(values[idx]);
      if (!isNaN(val)) {
        dateValues[dateCol] = val;
      }
    }

    rows.push({
      regionId: values[0],
      sizeRank: parseInt(values[1]) || 999,
      regionName: values[2],
      regionType: values[3],
      stateName: values[4],
      extras,
      values: dateValues,
    });
  }

  return { rows, dateColumns };
}

/**
 * Get a target date by offset from the end of available dates.
 */
export function getDateByOffset(dateColumns: string[], offset: number): string {
  const targetIndex = Math.max(0, dateColumns.length - 1 - offset);
  return dateColumns[targetIndex];
}
