import { TimePeriod } from '../types';

interface MetroData {
  regionName: string;
  sizeRank: number;
  stateName: string;
  values: Record<string, number>;
}

export interface StateHeatData {
  state_code: string;
  state_name: string;
  heat_index: number;
  metro_count: number;
  metros: { name: string; heat_index: number; sizeRank: number }[];
}

const stateCodeToName: Record<string, string> = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas',
  'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
  'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho',
  'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa', 'KS': 'Kansas',
  'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi',
  'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada',
  'NH': 'New Hampshire', 'NJ': 'New Jersey', 'NM': 'New Mexico', 'NY': 'New York',
  'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma',
  'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah',
  'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia',
  'WI': 'Wisconsin', 'WY': 'Wyoming', 'DC': 'District of Columbia',
};

let cachedMetros: MetroData[] = [];
let cachedDateColumns: string[] = [];

function parseCSV(text: string): { metros: MetroData[]; dateColumns: string[] } {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',');

  // Find date columns (format: "2018-01-31")
  const dateColumns = headers.filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h));

  const metros: MetroData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    // Parse CSV line handling quoted values
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);

    const regionType = values[3];
    if (regionType !== 'msa') continue; // Skip non-metro entries

    const stateName = values[4];
    if (!stateName || !stateCodeToName[stateName]) continue;

    const valueMap: Record<string, number> = {};
    dateColumns.forEach((dateCol) => {
      const idx = headers.indexOf(dateCol);
      const val = parseFloat(values[idx]);
      if (!isNaN(val)) {
        valueMap[dateCol] = val;
      }
    });

    metros.push({
      regionName: values[2],
      sizeRank: parseInt(values[1]) || 999,
      stateName,
      values: valueMap,
    });
  }

  return { metros, dateColumns };
}

export async function loadZillowData(): Promise<{ metros: MetroData[]; dateColumns: string[] }> {
  if (cachedMetros.length > 0) {
    return { metros: cachedMetros, dateColumns: cachedDateColumns };
  }

  const response = await fetch('/data/Metro_market_temp_index_uc_sfrcondo_month.csv');
  const text = await response.text();

  const { metros, dateColumns } = parseCSV(text);
  cachedMetros = metros;
  cachedDateColumns = dateColumns;

  return { metros, dateColumns };
}

function getDateForPeriod(dateColumns: string[], period: TimePeriod): string {
  if (dateColumns.length === 0) return '';

  const latestDate = dateColumns[dateColumns.length - 1];

  switch (period) {
    case '30d':
      return latestDate;
    case '90d':
      return dateColumns[Math.max(0, dateColumns.length - 3)] || latestDate;
    case '6m':
      return dateColumns[Math.max(0, dateColumns.length - 6)] || latestDate;
    case '1y':
      return dateColumns[Math.max(0, dateColumns.length - 12)] || latestDate;
    case '3y':
      return dateColumns[Math.max(0, dateColumns.length - 36)] || latestDate;
    case '5y':
      return dateColumns[Math.max(0, dateColumns.length - 60)] || latestDate;
    default:
      return latestDate;
  }
}

interface MetroInfo {
  name: string;
  heat_index: number;
  sizeRank: number;
}

export function aggregateToStates(
  metros: MetroData[],
  dateColumns: string[],
  period: TimePeriod
): StateHeatData[] {
  const dateCol = getDateForPeriod(dateColumns, period);

  const stateAggregates: Record<string, {
    weightedTotal: number;
    totalWeight: number;
    count: number;
    metros: MetroInfo[];
  }> = {};

  metros.forEach((metro) => {
    const stateCode = metro.stateName;
    const value = metro.values[dateCol];

    if (value === undefined || isNaN(value)) return;

    // Weight by inverse of size rank (bigger metros count more)
    const weight = 1 / Math.sqrt(metro.sizeRank || 1);

    if (!stateAggregates[stateCode]) {
      stateAggregates[stateCode] = { weightedTotal: 0, totalWeight: 0, count: 0, metros: [] };
    }

    stateAggregates[stateCode].weightedTotal += value * weight;
    stateAggregates[stateCode].totalWeight += weight;
    stateAggregates[stateCode].count += 1;
    stateAggregates[stateCode].metros.push({
      name: metro.regionName,
      heat_index: Math.round(value),
      sizeRank: metro.sizeRank,
    });
  });

  return Object.entries(stateAggregates).map(([stateCode, data]) => ({
    state_code: stateCode,
    state_name: stateCodeToName[stateCode] || stateCode,
    heat_index: Math.round(data.weightedTotal / data.totalWeight),
    metro_count: data.count,
    metros: data.metros.sort((a, b) => a.sizeRank - b.sizeRank), // Sort by size (biggest first)
  }));
}
