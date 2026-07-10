/* ============================================================
   UIManager
   - DOM(HUD/스크린) 갱신과 화면 전환을 담당.
   - 캐릭터 선택 카드/타이틀 프리뷰의 미니 캔버스 렌더링 포함.
   ============================================================ */
class UIManager {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);
    this.screens = {
      nickname: this.$('screen-nickname'),
      title: this.$('screen-title'),
      select: this.$('screen-select'),
      gameover: this.$('screen-gameover'),
    };
    this.hud = this.$('hud');
    this._lastZone = '';
  }

  showScreen(name) {
    Object.values(this.screens).forEach(s => s.classList.add('hidden'));
    if (this.screens[name]) this.screens[name].classList.remove('hidden');
    this.hud.classList.toggle('hidden', name !== null && name !== 'game');
    if (name === 'game') this.hud.classList.remove('hidden');
  }

  showHUD(show) { this.hud.classList.toggle('hidden', !show); }

  showStartHint(show) { this.$('start-hint').classList.toggle('hidden', !show); }

  // ---- HUD 갱신 ----
  // 생존 시간 카운트업 (시간 제한 없음)
  updateTimer(sec) {
    this.$('timer-value').textContent = sec.toFixed(1);
  }

  updateDistance(m) { this.$('distance-value').textContent = Math.floor(m).toLocaleString(); }

  updateSpeed(mps) { this.$('speed-value').innerHTML = mps.toFixed(1) + '<span>m/s</span>'; }

  updateZone(name) {
    if (name !== this._lastZone) {
      this._lastZone = name;
      const el = this.$('zone-box');
      el.textContent = name;
      el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'fadeIn 0.5s ease';
    }
  }

  updateCombo(combo) {
    const box = this.$('combo-box');
    if (combo > 0) { box.classList.remove('hidden'); this.$('combo-value').textContent = combo; }
    else box.classList.add('hidden');
  }

  updateRanking(result) {
    // 온라인/오프라인 상태 표시
    const titleEl = this.$('ranking-title');
    if (titleEl) {
      const dot = result.online ? '🟢' : '⚪';
      titleEl.innerHTML = `🏆 실시간 랭킹 <span class="rk-live">${dot} ${result.online ? 'LIVE' : 'OFFLINE'}</span>`;
    }
    const ul = this.$('ranking-list');
    ul.innerHTML = '';
    if (result.empty) {
      const li = document.createElement('li');
      li.className = 'rk-empty';
      li.textContent = '아직 기록이 없어요. 첫 기록에 도전!';
      ul.appendChild(li);
      return;
    }
    result.board.forEach(e => {
      const li = document.createElement('li');
      if (e.me) li.classList.add('me');
      if (e.me && result.rankChanged) li.classList.add('rank-up');
      li.innerHTML = `<span class="rk-num">${e.rank}</span>` +
        `<span class="rk-name">${this._esc(e.name)}</span>` +
        `<span class="rk-dist">${(e.dist || 0).toLocaleString()}m</span>`;
      ul.appendChild(li);
    });
  }

  updateGameOverRank(rank, online) {
    const el = this.$('result-rank');
    if (el) el.textContent = online ? `🌐 온라인 랭킹 ${rank}위` : '오프라인 (기록 저장됨)';
  }

  _esc(s) { return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

  // ---- 게임오버 화면 ----
  showGameOver(distance, best, isRecord, rank, reason) {
    this.$('result-distance').textContent = Math.floor(distance).toLocaleString() + 'm';
    this.$('result-best').textContent = Math.floor(best).toLocaleString() + 'm';
    this.$('result-rank').textContent = `실시간 랭킹 ${rank}위`;
    this.$('gameover-title').textContent = reason === 'time' ? 'TIME UP!' : 'GAME OVER';
    this.$('result-newrecord').classList.toggle('hidden', !isRecord);
    this.showScreen('gameover');
  }

  // ---- 타이틀/선택 프리뷰 ----
  renderCharGrid(characters, selectedId, charMgr, onSelect) {
    const grid = this.$('char-grid');
    grid.innerHTML = '';
    characters.forEach(def => {
      const card = document.createElement('div');
      card.className = 'char-card' + (def.id === selectedId ? ' selected' : '');
      const cv = document.createElement('canvas');
      cv.width = 140; cv.height = 150;
      card.appendChild(cv);
      const nm = document.createElement('div'); nm.className = 'char-name'; nm.textContent = def.name;
      const ds = document.createElement('div'); ds.className = 'char-desc'; ds.textContent = def.desc;
      card.appendChild(nm); card.appendChild(ds);
      grid.appendChild(card);
      const cx = cv.getContext('2d');
      charMgr.draw(cx, def, 70, 138, 130, { moving: false, balance: 0 });
      card.addEventListener('click', () => onSelect(def.id));
    });
  }

  renderTitlePreview(def, charMgr) {
    const host = this.$('title-char-preview');
    host.innerHTML = '';
    const cv = document.createElement('canvas');
    cv.width = 120; cv.height = 130;
    cv.style.height = '100%'; cv.style.width = 'auto';
    host.appendChild(cv);
    const cx = cv.getContext('2d');
    // 살짝 흔들리는 프리뷰 애니메이션
    let t = 0;
    const anim = () => {
      if (host.firstChild !== cv) return; // 화면 바뀌면 중단
      cx.clearRect(0, 0, cv.width, cv.height);
      charMgr.walkPhase = t;
      charMgr.draw(cx, def, 60, 122, 118, { moving: true, balance: Math.sin(t * 0.7) * 0.15 });
      t += 0.06;
      requestAnimationFrame(anim);
    };
    anim();
  }
}
