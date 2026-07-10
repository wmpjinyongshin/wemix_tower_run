/* eslint-disable */
// @ts-nocheck
/* ============================================================
   GameEngine (Next.js/React 연동판)
   - 기존 GameManager의 루프/물리/렌더/난이도/파티클 로직을 유지하되,
     DOM(UIManager/SceneManager/InputManager) 대신 콜백으로 React에 상태 전달.
   - 캔버스에는 배경/캐릭터/게이지/이펙트를 그리고, HUD·화면은 React가 렌더.
   ============================================================ */
import { AssetManager } from './assets';
import { SoundManager } from './sound';
import { PhysicsManager } from './physics';
import { CharacterManager } from './character';
import { StageManager } from './stage';
import { RankingManager } from './ranking';

export type Scene = 'nickname' | 'title' | 'select' | 'ready' | 'playing' | 'gameover';

export class GameEngine {
  constructor(canvas, onState) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.onState = onState || (() => {});

    this.assets = new AssetManager();
    this.sound = new SoundManager();
    this.physics = new PhysicsManager();
    this.characterMgr = new CharacterManager(this.assets);
    this.stageMgr = new StageManager(this.assets);
    this.rankingMgr = new RankingManager();

    this.selectedCharId = this.assets.characters[0].id;
    this.nickname = 'PLAYER';
    this.scene = 'nickname';
    this.soundOn = true;

    this.anchorX = this.W * 0.34;
    this.charSize = 150;

    this.particles = [];
    this.popups = [];
    this.speedLines = [];

    this._lastTime = 0;
    this._rankTimer = 0;
    this._diffLevel = 0;
    this._board = { board: [], myRank: 1, online: false, empty: true };
    this._gameover = null;
    this._emitTimer = 0;
    this._running = false;

    this._resetRun();
    this._bindInput();
  }

  getCharacter() { return this.assets.getCharacter(this.selectedCharId); }

  // ---------- React 상태 전달 ----------
  _snapshot() {
    const ts = this.assets.getThemeState(this.distance);
    return {
      scene: this.scene,
      nickname: this.nickname,
      selectedCharId: this.selectedCharId,
      soundOn: this.soundOn,
      hud: {
        time: this.elapsed,
        distance: this.distance,
        speed: this.speed,
        combo: this.combo,
        zone: ts.cur.name,
      },
      ranking: this._board,
      gameover: this._gameover,
    };
  }
  _push() { this.onState(this._snapshot()); }

  // ---------- 씬 전환 ----------
  setNickname(name) {
    this.nickname = (name || 'PLAYER').slice(0, 10);
    this.rankingMgr.setPlayer(this.nickname);
  }
  selectCharacter(id) { this.selectedCharId = id; this._push(); }

  goto(scene) {
    this.scene = scene;
    if (scene === 'ready') this.enterReady();
    if (scene === 'title') { this.sound.stopBGM(); }
    if (scene === 'gameover') { this.showGameOverScreen(); return; }
    this._push();
  }

  enterReady() {
    this._resetRun();
    this.rankingMgr.setPlayer(this.nickname);
    this.rankingMgr.setPlayerDist(0);
    this._board = this.rankingMgr.getBoard();
    this._ensureAudio();
    this.sound.startBGM();
    this._push();
    this.rankingMgr.fetchBoard().then(() => { this._board = this.rankingMgr.getBoard(); this._push(); });
  }

  retry() { this.goto('ready'); }
  goHome() { this.sound.stopBGM(); this.goto('title'); }

  _resetRun() {
    this.distance = 0;
    this.speed = 0;
    this.elapsed = 0;
    this.combo = 0;
    this.perfectStreakTime = 0;
    this.camX = 0;
    this.fallTimer = 0;
    this.gameOverReason = null;
    this.lastDir = 0;
    this.physics.reset();
    this.rankingMgr.reset();
    this.characterMgr.walkPhase = 0;
    this._submitTimer = 0;
    this._fetchTimer = 0;
    this._gameover = null;
    this.particles.length = 0;
    this.popups.length = 0;
    this.speedLines.length = 0;
    this._lastMilestoneName = '';
    this._milestoneTimer = 0;
  }

  // ---------- 입력 ----------
  _bindInput() {
    this._onKey = (e) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); this.press(-1); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); this.press(1); }
    };
    window.addEventListener('keydown', this._onKey, { passive: false });
  }

  _ensureAudio() { this.sound.ensure(); if (!this.soundOn && this.sound.master) this.sound.master.gain.value = 0; }

  press(dir) {
    this._ensureAudio();
    if (this.scene === 'ready') { this._startPlaying(); }
    if (this.scene !== 'playing') return;
    if (this.physics.fallen) return;
    let impulse = this.correctionImpulse();
    if (dir === this.lastDir) impulse *= 0.6;
    this.lastDir = dir;
    this.physics.applyInput(dir, impulse);
    this.sound.sfxStep();
  }

  _startPlaying() {
    this.scene = 'playing';
    this.elapsed = 0;
    this.speed = 6;
    this._push();
  }

  correctionImpulse() { return 0.42; }
  _difficulty() { return this.elapsed / 10 + this.distance / 1200; }

  toggleSound() {
    this._ensureAudio();
    this.soundOn = this.sound.toggle();
    this._push();
    return this.soundOn;
  }

  // ---------- 게임 오버 ----------
  _gameOver(reason) {
    if (this.gameOverReason) return;
    this.gameOverReason = reason;
    this.fallTimer = 0;
    if (reason === 'fall') this.sound.sfxFall();
    else this.physics.fallen = true;
  }

  showGameOverScreen() {
    const best = this.rankingMgr.getBest();
    const isRecord = this.rankingMgr.saveBest(this.distance);
    const newBest = Math.max(best, this.distance);
    const board = this.rankingMgr.getBoard();
    this._board = board;
    if (isRecord) this.sound.sfxRecord();
    this.sound.stopBGM();
    this._gameover = {
      distance: Math.floor(this.distance), best: Math.floor(newBest),
      isRecord, rank: board.myRank, online: this.rankingMgr.online, reason: this.gameOverReason,
    };
    this._push();
    this.rankingMgr.submit(this.distance)
      .then(() => this.rankingMgr.fetchBoard())
      .then(() => {
        const b = this.rankingMgr.getBoard();
        this._board = b;
        if (this._gameover) { this._gameover.rank = b.myRank; this._gameover.online = this.rankingMgr.online; }
        this._push();
      });
  }

  // ---------- 루프 ----------
  start() {
    if (this._running) return;
    this._running = true;
    this._lastWall = (performance || Date).now();
    const loop = (t) => { if (!this._running) return; this._step(t); this._raf = requestAnimationFrame(loop); };
    this._raf = requestAnimationFrame(loop);
    this._watch = setInterval(() => {
      const now = (performance || Date).now();
      if (this._running && now - this._lastWall > 120) this._step(now);
    }, 200);
    this._push();
  }

  destroy() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._watch) clearInterval(this._watch);
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
    this.sound.stopBGM();
  }

  _step(ts) {
    if (ts == null) ts = (performance || Date).now();
    if (!this._lastTime) this._lastTime = ts;
    let dt = (ts - this._lastTime) / 1000;
    this._lastTime = ts;
    dt = Math.min(dt, 0.05);
    this._lastWall = (performance || Date).now();
    this._update(dt);
    this._render();
  }

  _update(dt) {
    if (this.scene === 'playing' && !this.gameOverReason) {
      this.elapsed += dt;
      const diff = this._difficulty();
      this._diffLevel = diff;

      const instability = 2.4 + diff * 0.85;
      const noiseAmp = 0.45 + diff * 0.22;
      this.physics.perfectZone = Math.max(0.09, 0.17 - diff * 0.006);
      this.physics.update(dt, instability, noiseAmp);

      if (this.physics.fallen && !this.gameOverReason) this._gameOver('fall');

      let base = 6 + diff * 1.4;
      base = Math.min(base, 26);
      const perfect = this.physics.isPerfect();
      const boost = perfect ? 1.15 : 1.0;
      const stab = 0.7 + this.physics.stability() * 0.3;
      this.speed = base * boost * stab;
      this.distance += this.speed * dt;

      if (perfect) {
        this.perfectStreakTime += dt;
        if (this.perfectStreakTime >= 0.5) {
          this.perfectStreakTime -= 0.5;
          this.combo++;
          this.sound.sfxPerfect(this.combo);
          this._spawnPerfectFX();
          this._addPopup('PERFECT!', this.combo);
        }
        this._spawnSpeedLines();
      } else {
        this.combo = 0;
        this.perfectStreakTime = 0;
      }

      this.characterMgr.update(dt, this.speed / 12);
      this.sound.setIntensity(Math.floor(diff));

      this.rankingMgr.setPlayerDist(this.distance);
      this._rankTimer += dt;
      if (this._rankTimer >= 0.25) { this._rankTimer = 0; this._board = this.rankingMgr.getBoard(); }
      this._submitTimer += dt;
      if (this._submitTimer >= 1.2) { this._submitTimer = 0; this.rankingMgr.submit(this.distance); }
      this._fetchTimer += dt;
      if (this._fetchTimer >= 3) {
        this._fetchTimer = 0;
        this.rankingMgr.fetchBoard().then(() => { if (this.scene === 'playing') { this._board = this.rankingMgr.getBoard(); } });
      }

      // HUD/랭킹 React 갱신(초당 ~12회)
      this._emitTimer += dt;
      if (this._emitTimer >= 0.08) { this._emitTimer = 0; this._push(); }
    }

    if (this.gameOverReason) {
      this.fallTimer += dt;
      if (this.fallTimer >= 0.9 && this.scene !== 'gameover') { this.scene = 'gameover'; this.showGameOverScreen(); }
    }

    const targetCam = this.distance * this.stageMgr.PPM - this.anchorX;
    this.camX = targetCam;

    this._updateParticles(dt);
  }

  // ---------- 렌더 ----------
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);
    const groundY = this.stageMgr.draw(ctx, this.W, this.H, this.distance, this.camX);
    this._renderSpeedLines(ctx, groundY);

    const def = this.getCharacter();
    const drawing = this.scene === 'playing' || this.scene === 'ready' || this.gameOverReason;
    if (drawing) {
      const opts = {
        balance: this.physics.balance,
        perfect: this.physics.isPerfect(),
        moving: this.scene === 'playing' && !this.gameOverReason,
        fallen: this.gameOverReason === 'fall',
        fallDir: this.physics.fallDir,
        fallProgress: this.gameOverReason === 'fall' ? this.fallTimer / 0.9 : 0,
      };
      this.characterMgr.draw(ctx, def, this.anchorX, groundY + 2, this.charSize, opts);
      if (this.scene === 'playing' && !this.gameOverReason) {
        this._drawBalanceGauge(ctx, this.anchorX, groundY - this.charSize - 40);
      }
    }

    this._renderParticles(ctx);
    this._renderPopups(ctx);
    this._renderMilestone(ctx);
  }

  _drawBalanceGauge(ctx, cx, cy) {
    const w = 260, h = 22;
    const x = cx - w / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(10,20,45,0.75)';
    this.stageMgr._rr(ctx, x - 4, cy - 4, w + 8, h + 8, 12); ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff5a5a'); g.addColorStop(0.35, '#ffcf33');
    g.addColorStop(0.5, '#35f0a0'); g.addColorStop(0.65, '#ffcf33');
    g.addColorStop(1, '#ff5a5a');
    ctx.fillStyle = g;
    this.stageMgr._rr(ctx, x, cy, w, h, 8); ctx.fill();
    const pz = this.physics.perfectZone;
    const pzW = w * pz;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.strokeRect(cx - pzW, cy, pzW * 2, h);
    const ind = cx + (this.physics.balance) * (w / 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(ind, cy - 8); ctx.lineTo(ind - 8, cy - 20); ctx.lineTo(ind + 8, cy - 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.physics.isPerfect() ? '#35f0a0' : '#1a1f2b';
    ctx.fillRect(ind - 3, cy - 2, 6, h + 4);
    ctx.restore();
  }

  _spawnPerfectFX() {
    const gy = this.H * this.stageMgr.groundRatio;
    const cx = this.anchorX, cy = gy - this.charSize * 0.6;
    const colors = ['#35f0a0', '#ffcf33', '#22d3ee', '#ffffff'];
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0.7, max: 0.7, size: 3 + Math.random() * 4, color: colors[Math.floor(Math.random() * colors.length)], type: 'star' });
    }
  }
  _spawnSpeedLines() {
    if (Math.random() > 0.4) return;
    const gy = this.H * this.stageMgr.groundRatio;
    this.speedLines.push({ x: this.W + 20, y: 80 + Math.random() * (gy - 120), len: 40 + Math.random() * 80, life: 0.4, max: 0.4 });
  }
  _addPopup(text, combo) {
    const gy = this.H * this.stageMgr.groundRatio;
    this.popups.push({ x: this.anchorX, y: gy - this.charSize - 70, text, combo, life: 0.9, max: 0.9 });
  }
  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.speedLines.length - 1; i >= 0; i--) {
      const s = this.speedLines[i];
      s.x -= (this.speed * this.stageMgr.PPM * 1.5) * dt; s.life -= dt;
      if (s.life <= 0 || s.x < -100) this.speedLines.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= 40 * dt; p.life -= dt;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }
  _renderParticles(ctx) {
    this.particles.forEach(p => {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      if (p.type === 'star') this.characterMgr._sparkle(ctx, p.x, p.y, p.size);
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  }
  _renderSpeedLines(ctx) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
    this.speedLines.forEach(s => {
      ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.7;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len, s.y); ctx.stroke();
    });
    ctx.restore(); ctx.globalAlpha = 1;
  }
  _renderPopups(ctx) {
    ctx.save(); ctx.textAlign = 'center';
    this.popups.forEach(p => {
      const a = Math.max(0, p.life / p.max);
      const scale = 1 + (1 - a) * 0.4;
      ctx.globalAlpha = a; ctx.save(); ctx.translate(p.x, p.y); ctx.scale(scale, scale);
      ctx.fillStyle = '#35f0a0'; ctx.strokeStyle = '#0a1a3f'; ctx.lineWidth = 5;
      ctx.font = '900 34px Segoe UI, Malgun Gothic';
      ctx.strokeText(p.text, 0, 0); ctx.fillText(p.text, 0, 0);
      if (p.combo > 1) {
        ctx.fillStyle = '#ffcf33'; ctx.font = '900 22px Segoe UI';
        ctx.strokeText('x' + p.combo, 0, 28); ctx.fillText('x' + p.combo, 0, 28);
      }
      ctx.restore();
    });
    ctx.restore(); ctx.globalAlpha = 1;
  }
  _renderMilestone(ctx) {
    if (!this._lastMilestoneName) this._lastMilestoneName = '';
    const ts = this.assets.getThemeState(this.distance);
    if (this.scene === 'playing' && !this.gameOverReason && ts.cur.name !== this._lastMilestoneName) {
      this._lastMilestoneName = ts.cur.name; this._milestoneTimer = 2.0; this._milestoneText = ts.cur.name;
    }
    if (this._milestoneTimer > 0) {
      this._milestoneTimer -= 1 / 60;
      const a = Math.min(1, this._milestoneTimer) * Math.min(1, (2.0 - this._milestoneTimer) * 3);
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center';
      ctx.fillStyle = '#22d3ee'; ctx.strokeStyle = '#0a1a3f'; ctx.lineWidth = 6;
      ctx.font = '900 40px Segoe UI, Malgun Gothic';
      ctx.strokeText('▶ ' + this._milestoneText, this.W / 2, this.H * 0.34);
      ctx.fillText('▶ ' + this._milestoneText, this.W / 2, this.H * 0.34);
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }
}
