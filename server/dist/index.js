"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const sheets_1 = require("./sheets");
dotenv_1.default.config();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const SHEET_ID = process.env.SHEET_ID || '10jo5ziZkj2ebcZsmdbgMxNkkN0pjt-rYivPXVTGiN7w';
const SHEET_RANGE = process.env.SHEET_RANGE || 'Sheet2!A:B';
const SHEET_GID = process.env.SHEET_GID || '412714742';
const POLL_MS = process.env.POLL_MS ? Number(process.env.POLL_MS) : 5000;
const CRED_PATH = process.env.GOOGLE_CREDENTIALS_PATH || '';
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, { cors: { origin: '*' } });
let latestData = {};
let lastError = null;
let lastUpdated = null;
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
        const data = await (0, sheets_1.fetchSheetValues)(SHEET_ID, {
            range: SHEET_RANGE,
            gid: SHEET_GID,
            credentialsPath: CRED_PATH || undefined,
        });
        latestData = data;
        lastError = null;
        lastUpdated = new Date().toISOString();
        io.emit('sheetData', { data: latestData, lastUpdated, lastError });
    }
    catch (err) {
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
