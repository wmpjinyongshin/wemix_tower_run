/* eslint-disable */
// @ts-nocheck
/* ============================================================
   RankingManager
   - 온라인 실시간 랭킹. 더미 데이터 없음.
   - clientId별 최고 거리를 서버에 업로드(POST)하고 상위 목록을 조회(GET).
     같은 서버에 접속한 모든 유저의 기록이 실시간 공유·갱신된다.
   - 서버가 없으면(오프라인) 본인 기록만 표시하는 폴백.
   ============================================================ */
export class RankingManager {
  constructor() {
    // 백엔드 주소. 정적 호스팅(GitHub Pages 등)에선 window.WEMIX_API 로 외부
    // 백엔드 URL을 주입할 수 있고, 없으면 같은 오리진의 상대 경로를 사용한다.
    this.api = (typeof window !== 'undefined' && window.WEMIX_API) ? window.WEMIX_API : '/api/scores';
    this.clientId = this._clientId();
    this.playerName = 'PLAYER';
    this.playerDist = 0;
    this.serverBoard = []; // [{clientId,name,dist,ts}]
    this.online = false;
    this.lastRank = null;
    this.bestKey = 'wemix_tower_run_best';
    // 정적 호스팅에서 서버가 없으면 반복 실패 → 일정 횟수 후 네트워크 중단(콘솔 스팸 방지)
    this._netFails = 0;
    this._netDisabled = false;
  }

  _apiUrl(q) { return this.api + (q || ''); }
  _noteFail() { if (++this._netFails >= 2) this._netDisabled = true; this.online = false; }
  _noteOK() { this._netFails = 0; this.online = true; }

  _clientId() {
    let id = localStorage.getItem('wemix_client_id');
    if (!id) {
      id = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('wemix_client_id', id);
    }
    return id;
  }

  setPlayer(name) { this.playerName = (name || 'PLAYER').slice(0, 10); }
  setPlayerDist(d) { this.playerDist = d; }

  getBest() {
    const v = parseInt(localStorage.getItem(this.bestKey) || '0', 10);
    return isNaN(v) ? 0 : v;
  }
  saveBest(d) {
    if (d > this.getBest()) { localStorage.setItem(this.bestKey, String(Math.floor(d))); return true; }
    return false;
  }

  // 서버에서 상위 목록 조회
  async fetchBoard() {
    if (this._netDisabled) { this.online = false; return false; }
    try {
      const r = await fetch(this._apiUrl('?limit=50'), { cache: 'no-store' });
      if (!r.ok) throw new Error('http');
      const j = await r.json();
      this.serverBoard = Array.isArray(j.scores) ? j.scores : [];
      this._noteOK();
    } catch (e) {
      this._noteFail();
    }
    return this.online;
  }

  // 현재 거리를 서버에 업로드(실시간 갱신). 서버는 최고 기록만 유지.
  async submit(dist) {
    if (this._netDisabled) { this.online = false; return false; }
    try {
      const r = await fetch(this._apiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: this.clientId, name: this.playerName, dist: Math.floor(dist) }),
      });
      if (!r.ok) throw new Error('http');
      const j = await r.json();
      if (Array.isArray(j.scores)) this.serverBoard = j.scores;
      this._noteOK();
    } catch (e) {
      this._noteFail();
    }
    return this.online;
  }

  // 현재 플레이어의 실시간 거리를 병합해 정렬된 보드를 동기 반환(렌더용)
  getBoard(limit = 8) {
    const map = new Map();
    this.serverBoard.forEach(e => map.set(e.clientId, { ...e }));

    const liveDist = Math.floor(this.playerDist);
    const mine = map.get(this.clientId) || { clientId: this.clientId, name: this.playerName, dist: 0 };
    mine.dist = Math.max(mine.dist || 0, liveDist);
    mine.name = this.playerName;
    map.set(this.clientId, mine);

    let list = [...map.values()].sort((a, b) => b.dist - a.dist);
    list.forEach((e, i) => { e.rank = i + 1; e.me = e.clientId === this.clientId; });

    const meRow = list.find(e => e.me);
    const myRank = meRow ? meRow.rank : list.length;
    const rankChanged = this.lastRank !== null && myRank < this.lastRank;
    this.lastRank = myRank;

    let shown;
    if (myRank <= limit) shown = list.slice(0, limit);
    else shown = [...list.slice(0, limit - 1), meRow];

    const empty = list.length <= 1 && mine.dist === 0;
    return { board: shown, myRank, total: list.length, rankChanged, online: this.online, empty };
  }

  reset() { this.lastRank = null; this.playerDist = 0; }
}
