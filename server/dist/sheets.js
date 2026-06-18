"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchViaSheetsApi = fetchViaSheetsApi;
exports.fetchViaPublicCsv = fetchViaPublicCsv;
exports.fetchSheetValues = fetchSheetValues;
const googleapis_1 = require("googleapis");
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
function rowsToKV(rows) {
    const result = {};
    for (const row of rows) {
        const label = row[0] ? String(row[0]).trim() : '';
        const value = row[1] !== undefined ? String(row[1]).trim() : '';
        if (label)
            result[label] = value;
    }
    return result;
}
/** Google Sheets API v4 — works for private sheets shared with a service account. */
async function fetchViaSheetsApi(sheetId, range, credentialsPath) {
    const creds = JSON.parse(fs_1.default.readFileSync(credentialsPath, 'utf8'));
    const client = new googleapis_1.google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const auth = await client.getClient();
    const sheets = googleapis_1.google.sheets({ version: 'v4', auth: auth });
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    return rowsToKV(res.data.values || []);
}
/** Public CSV export — no credentials; sheet must be "Anyone with the link can view". */
async function fetchViaPublicCsv(sheetId, gid) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const res = await axios_1.default.get(url, { responseType: 'text' });
    const rows = parseCsv(res.data);
    return rowsToKV(rows);
}
function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];
        if (inQuotes) {
            if (ch === '"' && next === '"') {
                field += '"';
                i++;
            }
            else if (ch === '"') {
                inQuotes = false;
            }
            else {
                field += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
        }
        else if (ch === ',') {
            row.push(field);
            field = '';
        }
        else if (ch === '\r' && next === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            i++;
        }
        else if (ch === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
        }
        else {
            field += ch;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}
async function fetchSheetValues(sheetId, options) {
    const { range = 'Sheet2!A:B', gid = '412714742', credentialsPath } = options;
    if (credentialsPath && fs_1.default.existsSync(credentialsPath)) {
        return fetchViaSheetsApi(sheetId, range, credentialsPath);
    }
    return fetchViaPublicCsv(sheetId, gid);
}
