import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { fetchSheetValues } from './sheets';

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const SHEET_ID = process.env.SHEET_ID || '1xpNN4gqUL9DnbCmx3ccXbvuYGN5SU5FxcXvsxooWIEs';
const SHEET_RANGE = process.env.SHEET_RANGE || 'Sheet2!A:B';
const SHEET_GID = process.env.SHEET_GID || '412714742';
const POLL_MS = process.env.POLL_MS ? Number(process.env.POLL_MS) : 5000;
const CRED_PATH = process.env.GOOGLE_CREDENTIALS_PATH || '';

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let latestData: Record<string, string> = {};
let lastError: string | null = null;
let lastUpdated: string | null = null;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: !lastError,
    lastUpdated,
    lastError,
    sheetId: SHEET_ID,
    pollMs: POLL_MS,
  });
});

app.get('/api/data', (_req, res) => {
  res.json({ data: latestData, lastUpdated, lastError });
});

io.on('connection', socket => {
  socket.emit('sheetData', { data: latestData, lastUpdated, lastError });
});

async function pollLoop() {
  try {
    const data = await fetchSheetValues(SHEET_ID, {
      range: SHEET_RANGE,
      gid: SHEET_GID,
      credentialsPath: CRED_PATH || undefined,
    });
    latestData = data;
    lastError = null;
    lastUpdated = new Date().toISOString();
    io.emit('sheetData', { data: latestData, lastUpdated, lastError });
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
    console.error('Error fetching sheet:', lastError);
    io.emit('sheetData', { data: latestData, lastUpdated, lastError });
  }
  setTimeout(pollLoop, POLL_MS);
}

pollLoop();

server.listen(PORT, () => {
  console.log(`Dashboard server listening on http://localhost:${PORT}`);
  console.log(`Polling sheet ${SHEET_ID} every ${POLL_MS}ms`);
});
