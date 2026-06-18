# Real-Time QA Dashboard (TypeScript)

A TypeScript dashboard that reads **label / value** pairs from a Google Sheet (Column A = label, Column B = value) and updates in real time via WebSocket.

Your sheet: [Google Spreadsheet](https://docs.google.com/spreadsheets/d/1xpNN4gqUL9DnbCmx3ccXbvuYGN5SU5FxcXvsxooWIEs/edit?gid=412714742)

## Is it possible by API?

**Yes.** Google Sheets exposes data through:

| Method | Auth needed | Best for |
|--------|-------------|----------|
| **Public CSV export** | None — sheet must be shared as "Anyone with the link can view" | Quick setup |
| **Google Sheets API v4** | Service account JSON key; share the sheet with the service account email | Private / team sheets |

This project supports **both**. If no credentials file is configured, it uses the public CSV export URL automatically.

## Quick start

```bash
# From repo root
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Copy env (defaults already point to your sheet)
cp server/.env.example server/.env

# Start backend + frontend
npm run dev
```

- Dashboard UI: http://localhost:5173
- API: http://localhost:4000/api/data

## Make your sheet readable

### Option A — Public (easiest)

1. Open your Google Sheet → **Share**
2. Set to **Anyone with the link** → **Viewer**
3. Restart the server — no credentials needed

### Option B — Private (Google Sheets API)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → enable **Google Sheets API**
3. Create a **Service Account** → download JSON key
4. Save it as `server/service-account.json`
5. Share the spreadsheet with the service account email (e.g. `xxx@xxx.iam.gserviceaccount.com`) as **Viewer**
6. In `server/.env`:

```env
GOOGLE_CREDENTIALS_PATH=./service-account.json
```

## Configuration (`server/.env`)

| Variable | Description |
|----------|-------------|
| `SHEET_ID` | Spreadsheet ID from the URL |
| `SHEET_GID` | Tab ID (`gid=` in URL) — default `412714742` |
| `SHEET_RANGE` | Range for API mode — default `Sheet2!A:B` |
| `POLL_MS` | Refresh interval in ms — default `5000` |
| `GOOGLE_CREDENTIALS_PATH` | Optional service account JSON path |

## Architecture

```
Google Sheet (A: label, B: value)
        ↓ poll every N seconds
   Express server  ──Socket.io──►  React dashboard
        ↓
   GET /api/data
```

When the sheet changes, the dashboard updates automatically within `POLL_MS` without a page refresh.

## Sheet layout

```
| A (Label)        | B (Value) |
|------------------|-----------|
| Passed           | 42        |
| Failed           | 3         |
| Blocked          | 1         |
| Not Started      | 5         |
| Not Applicable   | 0         |
```

Any rows in columns A and B are picked up dynamically — no hardcoded labels required.
