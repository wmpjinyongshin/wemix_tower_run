/* ============================================================
   /api/scores — Cloudflare Pages Function (온라인 실시간 랭킹)
   - KV 바인딩 이름: SCORES
   - 단일 키 'board' 아래 { clientId: {clientId,name,dist,ts} } 저장.
   - KV 바인딩이 없으면 503 → 클라이언트는 오프라인 모드로 폴백.
   ============================================================ */
const KEY = 'board';

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function top(map, limit) {
  const arr = Object.values(map).sort((a, b) => b.dist - a.dist);
  return { scores: arr.slice(0, limit), total: arr.length };
}

function sanitizeName(n) {
  return String(n == null ? 'PLAYER' : n).replace(/[<>&"]/g, '').slice(0, 10) || 'PLAYER';
}

export async function onRequestOptions() {
  return json({}, 204);
}

export async function onRequestGet(context) {
  const kv = context.env.SCORES;
  if (!kv) return json({ error: 'no kv binding' }, 503);
  const url = new URL(context.request.url);
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10) || 50);
  const map = (await kv.get(KEY, 'json')) || {};
  return json(top(map, limit));
}

export async function onRequestPost(context) {
  const kv = context.env.SCORES;
  if (!kv) return json({ error: 'no kv binding' }, 503);

  let data;
  try { data = await context.request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const clientId = String(data.clientId || '').slice(0, 64);
  if (!clientId) return json({ error: 'no clientId' }, 400);
  const name = sanitizeName(data.name);
  const dist = Math.max(0, Math.min(9999999, Math.floor(Number(data.dist) || 0)));

  const map = (await kv.get(KEY, 'json')) || {};
  const prev = map[clientId];
  if (!prev || dist > prev.dist) {
    map[clientId] = { clientId, name, dist, ts: Date.now() };
    await kv.put(KEY, JSON.stringify(map));
  } else if (prev.name !== name) {
    prev.name = name;
    await kv.put(KEY, JSON.stringify(map));
  }
  return json(top(map, 50));
}
