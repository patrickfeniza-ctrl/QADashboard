import { google } from 'googleapis';
import fs from 'fs';
import axios from 'axios';

export type SheetKV = Record<string, string>;

function rowsToKV(rows: string[][]): SheetKV {
  const result: SheetKV = {};
  for (const row of rows) {
    const label = row[0] ? String(row[0]).trim() : '';
    const value = row[1] !== undefined ? String(row[1]).trim() : '';
    if (label) result[label] = value;
  }
  return result;
}

/** Google Sheets API v4 — works for private sheets shared with a service account. */
export async function fetchViaSheetsApi(
  sheetId: string,
  range: string,
  credentialsPath: string
): Promise<SheetKV> {
  const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const client = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const auth = await client.getClient();
  const sheets = google.sheets({ version: 'v4', auth: auth as Parameters<typeof google.sheets>[0]['auth'] });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  return rowsToKV((res.data.values as string[][]) || []);
}

/** Public CSV export — no credentials; sheet must be "Anyone with the link can view". */
export async function fetchViaPublicCsv(sheetId: string, gid: string): Promise<SheetKV> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  const res = await axios.get<string>(url, { responseType: 'text' });
  const rows = parseCsv(res.data);
  return rowsToKV(rows);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export async function fetchSheetValues(
  sheetId: string,
  options: { range?: string; gid?: string; credentialsPath?: string }
): Promise<SheetKV> {
  const { range = 'Sheet2!A:B', gid = '412714742', credentialsPath } = options;

  if (credentialsPath && fs.existsSync(credentialsPath)) {
    return fetchViaSheetsApi(sheetId, range, credentialsPath);
  }

  return fetchViaPublicCsv(sheetId, gid);
}
