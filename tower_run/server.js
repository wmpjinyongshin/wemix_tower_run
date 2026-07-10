/* ============================================================
   WEMIX TOWER RUN — 정적 서버 + 온라인 랭킹 API
   - 외부 의존성 없음(Node 기본 모듈만).
   - 랭킹은 clientId별 "최고 거리"를 실시간 저장(scores.json 영속).
     같은 서버에 접속한 모든 유저의 기록이 실시간 공유된다.
   API:
     GET  /api/scores?limit=50   -> { scores:[{clientId,name,dist,ts}], total }
     POST /api/scores            body {clientId,name,dist} -> 갱신 후 상위 목록 반환
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5599;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'scores.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ---- 랭킹 저장소 (메모리 + 파일) ----
let scores = {}; // { clientId: {clientId, name, dist, ts} }
try {
  if (fs.existsSync(DB_FILE)) scores = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) || {};
} catch (e) { scores = {}; }

let saveTimer = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    fs.writeFile(DB_FILE, JSON.stringify(scores), () => {});
  }, 500);
}

function topScores(limit) {
  const arr = Object.values(scores).sort((a, b) => b.dist - a.dist);
  return { scores: arr.slice(0, limit), total: arr.length };
}

function sanitizeName(n) {
  return String(n || 'PLAYER').replace(/[<>&"]/g, '').slice(0, 10) || 'PLAYER';
}

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);

  // ---- API ----
  if (u.pathname === '/api/scores') {
    if (req.method === 'OPTIONS') { sendJSON(res, 204, {}); return; }

    if (req.method === 'GET') {
      const limit = Math.min(200, parseInt(u.searchParams.get('limit') || '50', 10) || 50);
      sendJSON(res, 200, topScores(limit));
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let data;
        try { data = JSON.parse(body || '{}'); } catch (e) { sendJSON(res, 400, { error: 'bad json' }); return; }
        const clientId = String(data.clientId || '').slice(0, 64);
        const name = sanitizeName(data.name);
        let dist = Math.max(0, Math.min(9999999, Math.floor(Number(data.dist) || 0)));
        if (!clientId) { sendJSON(res, 400, { error: 'no clientId' }); return; }
        const prev = scores[clientId];
        // 최고 거리만 유지(실시간으로 자기 기록을 넘어서면 즉시 순위 상승)
        if (!prev || dist > prev.dist) {
          scores[clientId] = { clientId, name, dist, ts: Date.now() };
          persist();
        } else if (prev.name !== name) {
          prev.name = name; persist();
        }
        sendJSON(res, 200, topScores(50));
      });
      return;
    }

    sendJSON(res, 405, { error: 'method not allowed' });
    return;
  }

  // ---- 정적 파일 ----
  let urlPath = decodeURIComponent(u.pathname);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`WEMIX TOWER RUN: http://localhost:${PORT} (랭킹 API 활성)`));
