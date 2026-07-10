/* ============================================================
   /api/scores — 온라인 실시간 랭킹 API (Next.js Route Handler)
   - clientId별 "최고 거리"를 저장. 같은 서버 인스턴스의 모든 유저가 공유.
   - 메모리 저장 + best-effort 파일 영속(scores.json).
   ============================================================ */
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Score = { clientId: string; name: string; dist: number; ts: number };

// 서버 인스턴스 수명 동안 유지되는 메모리 저장소
const g = globalThis as unknown as { __wemixScores?: Map<string, Score> };
if (!g.__wemixScores) g.__wemixScores = new Map<string, Score>();
const store = g.__wemixScores;

const DB_FILE = path.join(process.cwd(), 'scores.json');
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    if (fs.existsSync(DB_FILE)) {
      const obj = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as Record<string, Score>;
      for (const k of Object.keys(obj)) store.set(k, obj[k]);
    }
  } catch {}
}

function persist() {
  try {
    const obj: Record<string, Score> = {};
    store.forEach((v, k) => { obj[k] = v; });
    fs.writeFile(DB_FILE, JSON.stringify(obj), () => {});
  } catch {}
}

function top(limit: number) {
  const arr = [...store.values()].sort((a, b) => b.dist - a.dist);
  return { scores: arr.slice(0, limit), total: arr.length };
}

function sanitizeName(n: unknown) {
  return String(n ?? 'PLAYER').replace(/[<>&"]/g, '').slice(0, 10) || 'PLAYER';
}

export async function GET(req: Request) {
  load();
  const url = new URL(req.url);
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10) || 50);
  return NextResponse.json(top(limit));
}

export async function POST(req: Request) {
  load();
  let data: { clientId?: string; name?: string; dist?: number };
  try { data = await req.json(); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }

  const clientId = String(data.clientId || '').slice(0, 64);
  if (!clientId) return NextResponse.json({ error: 'no clientId' }, { status: 400 });
  const name = sanitizeName(data.name);
  const dist = Math.max(0, Math.min(9_999_999, Math.floor(Number(data.dist) || 0)));

  const prev = store.get(clientId);
  if (!prev || dist > prev.dist) {
    store.set(clientId, { clientId, name, dist, ts: Date.now() });
    persist();
  } else if (prev.name !== name) {
    prev.name = name; store.set(clientId, prev); persist();
  }
  return NextResponse.json(top(50));
}
