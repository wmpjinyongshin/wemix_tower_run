/* ============================================================
   GameManager
   - 전체 게임을 조립하고 requestAnimationFrame 루프를 구동.
   - 카메라/거리/타이머/속도/난이도/파티클/렌더링/게임오버 처리.
   - Walk the Stork 스타일의 "끊김 없는 오른쪽 진행 + 밸런스" 감각 구현.
   ============================================================ */
class GameManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;   // 1280 (내부 고정 해상도)
    this.H = canvas.height;  // 720

    // 매니저들
    this.assets = new AssetManager();
    this.sound = new SoundManager();
    this.physics = new PhysicsManager();
    this.characterMgr = new CharacterManager(this.assets);
    this.stageMgr = new StageManager(this.assets);
    this.rankingMgr = new RankingManager();
    this.ui = new UIManager(this);
    this.input = new InputManager(document.getElementById('stage'));
    this.scene = new SceneManager(this);

    this.selectedCharId = this.assets.characters[0].id;

    // 월드/카메라
    this.anchorX = this.W * 0.34; // 캐릭터가 서 있는 화면상 x
    this.charSize = 150;

    // 게임 상태 값
    this._resetRun();

    // 입력 연결 (씬 상태 게이팅은 _onDirection 내부에서 처리)
    this.input.onDirection = (dir) => this._onDirection(dir);
    this.input.enable();

    // 파티클/이펙트
    this.particles = [];
    this.popups = [];   // PERFECT! 텍스트 팝업
    this.speedLines = [];

    this._lastTime = 0;
    this._rankTimer = 0;
    this._diffLevel = 0;
  }

  getCharacter() { return this.assets.getCharacter(this.selectedCharId); }

  // 한 판(run) 상태 초기화
  _resetRun() {
    this.distance = 0;
    this.speed = 0;
    this.elapsed = 0; // 생존 시간(초) — 시간 제한 없이 카운트업
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
    if (this.particles) this.particles.length = 0;
    if (this.popups) this.popups.length = 0;
    if (this.speedLines) this.speedLines.length = 0;
  }

  // ---- 상태 진입 ----
  enterReady() {
    this._resetRun();
    this.rankingMgr.setPlayerDist(0);
    this._updateHUD();
    this.ui.updateRanking(this.rankingMgr.getBoard());
    // 온라인 랭킹 최신화
    this.rankingMgr.fetchBoard().then(() => this.ui.updateRanking(this.rankingMgr.getBoard()));
    this.sound.startBGM();
  }

  _startPlaying() {
    this.scene.goto(SCENE.PLAYING);
    // 첫 입력 순간부터 생존 시간 카운트 시작 (시간 제한 없음)
    this.elapsed = 0;
    this.speed = 6;
  }

  // ---- 입력 처리 ----
  _onDirection(dir) {
    if (this.scene.is(SCENE.READY)) {
      this._startPlaying();
    }
    if (!this.scene.is(SCENE.PLAYING)) return;
    if (this.physics.fallen) return;

    // 교정 임펄스: 최근과 같은 방향을 연타하면 효과 약간 감소 →
    // 좌우 번갈아 누르는 리듬을 유도(오래 걷기 감각).
    let impulse = this.correctionImpulse();
    if (dir === this.lastDir) impulse *= 0.6;
    this.lastDir = dir;

    this.physics.applyInput(dir, impulse);
    this.sound.sfxStep();
  }

  // 난이도에 따른 교정 세기
  correctionImpulse() { return 0.42; }

  // ---- 난이도 파라미터 (시간+거리 기반, 하나의 월드에서 연속 상승) ----
  _difficulty() {
    // 0에서 시작, 시간과 거리에 따라 완만히 상승
    return this.elapsed / 10 + this.distance / 1200;
  }

  // ---- 게임 오버 ----
  _gameOver(reason) {
    if (this.gameOverReason) return;
    this.gameOverReason = reason;
    this.fallTimer = 0;
    if (reason === 'fall') this.sound.sfxFall();
    else this.physics.fallen = true; // time up 시에도 정지
  }

  showGameOverScreen() {
    const best = this.rankingMgr.getBest();
    const isRecord = this.rankingMgr.saveBest(this.distance);
    const newBest = Math.max(best, this.distance);
    const board = this.rankingMgr.getBoard();
    if (isRecord) this.sound.sfxRecord();
    this.sound.stopBGM();
    // 로컬 순위로 즉시 표시
    this.ui.showGameOver(this.distance, newBest, isRecord, board.myRank, this.gameOverReason);
    this.ui.updateGameOverRank(board.myRank, this.rankingMgr.online);
    // 최종 기록 온라인 업로드 후 실제 순위/보드 갱신
    this.rankingMgr.submit(this.distance)
      .then(() => this.rankingMgr.fetchBoard())
      .then(() => {
        const b = this.rankingMgr.getBoard();
        this.ui.updateGameOverRank(b.myRank, this.rankingMgr.online);
        this.ui.updateRanking(b);
      });
  }

  // ============================================================
  //  메인 루프
  // ============================================================
  loop(ts) {
    this._step(ts);
    // 단일 rAF 체인 (백그라운드 탭에서는 일시정지 → 워치독이 대신 구동)
    requestAnimationFrame((t) => this.loop(t));
  }

  // 한 프레임 진행 (rAF 또는 워치독이 호출)
  _step(ts) {
    if (ts == null) ts = (performance || Date).now();
    if (!this._lastTime) this._lastTime = ts;
    let dt = (ts - this._lastTime) / 1000;
    this._lastTime = ts;
    dt = Math.min(dt, 0.05); // 프레임 튐 방지
    this._lastWall = (performance || Date).now();

    this._update(dt);
    this._render();
  }

  _update(dt) {
    const playing = this.scene.is(SCENE.PLAYING);
    const ready = this.scene.is(SCENE.READY);

    if (playing && !this.gameOverReason) {
      this.elapsed += dt; // 생존 시간 누적 (제한 없음)

      const diff = this._difficulty();
      this._diffLevel = diff;

      // 물리 파라미터
      const instability = 2.4 + diff * 0.85;
      const noiseAmp = 0.45 + diff * 0.22;
      this.physics.perfectZone = Math.max(0.09, 0.17 - diff * 0.006);

      this.physics.update(dt, instability, noiseAmp);

      // 넘어짐 판정
      if (this.physics.fallen && !this.gameOverReason) this._gameOver('fall');

      // 속도: 기본 속도 + 난이도, Perfect 시 15% 부스트
      let base = 6 + diff * 1.4;
      base = Math.min(base, 26);
      const perfect = this.physics.isPerfect();
      const boost = perfect ? 1.15 : 1.0;
      // 균형이 무너질수록 살짝 감속(휘청)
      const stab = 0.7 + this.physics.stability() * 0.3;
      this.speed = base * boost * stab;

      // 거리 누적
      this.distance += this.speed * dt;

      // Perfect 콤보/이펙트
      if (perfect) {
        this.perfectStreakTime += dt;
        // 일정 주기마다 콤보 증가
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

      // 캐릭터 걷기 애니메이션
      this.characterMgr.update(dt, this.speed / 12);

      // BGM 강도
      this.sound.setIntensity(Math.floor(diff));

      // 랭킹: 로컬 병합 렌더(자주) + 온라인 업로드/조회(주기적)
      this.rankingMgr.setPlayerDist(this.distance);
      this._rankTimer += dt;
      if (this._rankTimer >= 0.25) {
        this._rankTimer = 0;
        this.ui.updateRanking(this.rankingMgr.getBoard());
      }
      // 실시간 업로드 (내 현재 거리를 서버로)
      this._submitTimer += dt;
      if (this._submitTimer >= 1.2) {
        this._submitTimer = 0;
        this.rankingMgr.submit(this.distance);
      }
      // 다른 유저 기록 실시간 조회
      this._fetchTimer += dt;
      if (this._fetchTimer >= 3) {
        this._fetchTimer = 0;
        this.rankingMgr.fetchBoard().then(() => {
          if (this.scene.is(SCENE.PLAYING)) this.ui.updateRanking(this.rankingMgr.getBoard());
        });
      }

      this._updateHUD();
    }

    // 넘어짐 연출 진행
    if (this.gameOverReason) {
      this.fallTimer += dt;
      // 넘어짐 애니메이션 후 게임오버 화면
      if (this.fallTimer >= 0.9 && !this.scene.is(SCENE.GAMEOVER)) {
        this.scene.goto(SCENE.GAMEOVER);
      }
    }

    // 카메라 (캐릭터 월드 위치를 anchor에 고정)
    const targetCam = this.distance * this.stageMgr.PPM - this.anchorX;
    this.camX = targetCam;

    // 파티클/팝업 갱신
    this._updateParticles(dt);
  }

  _updateHUD() {
    this.ui.updateTimer(this.elapsed);
    this.ui.updateDistance(this.distance);
    this.ui.updateSpeed(this.speed);
    this.ui.updateCombo(this.combo);
    const ts = this.assets.getThemeState(this.distance);
    this.ui.updateZone(ts.cur.name);
  }

  // ============================================================
  //  렌더링
  // ============================================================
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    // 배경(월드)
    const groundY = this.stageMgr.draw(ctx, this.W, this.H, this.distance, this.camX);

    // 속도선(캐릭터 뒤)
    this._renderSpeedLines(ctx, groundY);

    // 캐릭터
    const def = this.getCharacter();
    const drawing = this.scene.is(SCENE.PLAYING) || this.scene.is(SCENE.READY) || this.gameOverReason;
    if (drawing) {
      const opts = {
        balance: this.physics.balance,
        perfect: this.physics.isPerfect(),
        moving: this.scene.is(SCENE.PLAYING) && !this.gameOverReason,
        fallen: this.gameOverReason === 'fall' || (this.gameOverReason === 'time'),
        fallDir: this.physics.fallDir,
        fallProgress: this.gameOverReason === 'fall' ? this.fallTimer / 0.9 : (this.gameOverReason === 'time' ? 0.15 : 0),
      };
      // time up은 캐릭터가 힘빠져 살짝 주저앉는 정도만
      if (this.gameOverReason === 'time') { opts.fallen = false; opts.moving = false; }
      this.characterMgr.draw(ctx, def, this.anchorX, groundY + 2, this.charSize, opts);

      // 밸런스 게이지 (캐릭터 위)
      if (this.scene.is(SCENE.PLAYING) && !this.gameOverReason) {
        this._drawBalanceGauge(ctx, this.anchorX, groundY - this.charSize - 40);
      }
    }

    // 파티클
    this._renderParticles(ctx);

    // 팝업(PERFECT!)
    this._renderPopups(ctx);

    // 거리 마일스톤 배너
    this._renderMilestone(ctx);
  }

  // 밸런스 게이지: 좌우로 흔들리는 인디케이터 + 중앙 Perfect Zone
  _drawBalanceGauge(ctx, cx, cy) {
    const w = 260, h = 22;
    const x = cx - w / 2;
    ctx.save();
    // 배경 트랙
    ctx.fillStyle = 'rgba(10,20,45,0.75)';
    this.stageMgr._rr(ctx, x - 4, cy - 4, w + 8, h + 8, 12); ctx.fill();
    // 위험 그라데이션
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#ff5a5a'); g.addColorStop(0.35, '#ffcf33');
    g.addColorStop(0.5, '#35f0a0'); g.addColorStop(0.65, '#ffcf33');
    g.addColorStop(1, '#ff5a5a');
    ctx.fillStyle = g;
    this.stageMgr._rr(ctx, x, cy, w, h, 8); ctx.fill();
    // Perfect Zone 표시
    const pz = this.physics.perfectZone;
    const pzW = w * pz;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - pzW, cy, pzW * 2, h);
    // 인디케이터
    const ind = cx + (this.physics.balance) * (w / 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(ind, cy - 8);
    ctx.lineTo(ind - 8, cy - 20);
    ctx.lineTo(ind + 8, cy - 20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = this.physics.isPerfect() ? '#35f0a0' : '#1a1f2b';
    ctx.fillRect(ind - 3, cy - 2, 6, h + 4);
    ctx.restore();
  }

  // ---- 파티클 시스템 ----
  _spawnPerfectFX() {
    const gy = this.H * this.stageMgr.groundRatio;
    const cx = this.anchorX, cy = gy - this.charSize * 0.6;
    const colors = ['#35f0a0', '#ffcf33', '#22d3ee', '#ffffff'];
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 160;
      this.particles.push({
        x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.7, max: 0.7, size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)], type: 'star',
      });
    }
  }

  _spawnSpeedLines() {
    if (Math.random() > 0.4) return;
    const gy = this.H * this.stageMgr.groundRatio;
    this.speedLines.push({
      x: this.W + 20, y: 80 + Math.random() * (gy - 120),
      len: 40 + Math.random() * 80, life: 0.4, max: 0.4,
    });
  }

  _addPopup(text, combo) {
    const gy = this.H * this.stageMgr.groundRatio;
    this.popups.push({
      x: this.anchorX, y: gy - this.charSize - 70,
      text, combo, life: 0.9, max: 0.9,
    });
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.speedLines.length - 1; i >= 0; i--) {
      const s = this.speedLines[i];
      s.x -= (this.speed * this.stageMgr.PPM * 1.5) * dt;
      s.life -= dt;
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
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.type === 'star') {
        this.characterMgr._sparkle(ctx, p.x, p.y, p.size);
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  _renderSpeedLines(ctx, groundY) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    this.speedLines.forEach(s => {
      ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.7;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.len, s.y); ctx.stroke();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _renderPopups(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    this.popups.forEach(p => {
      const a = Math.max(0, p.life / p.max);
      const scale = 1 + (1 - a) * 0.4;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#35f0a0';
      ctx.strokeStyle = '#0a1a3f'; ctx.lineWidth = 5;
      ctx.font = '900 34px Segoe UI, Malgun Gothic';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillText(p.text, 0, 0);
      if (p.combo > 1) {
        ctx.fillStyle = '#ffcf33';
        ctx.font = '900 22px Segoe UI';
        ctx.strokeText('x' + p.combo, 0, 28);
        ctx.fillText('x' + p.combo, 0, 28);
      }
      ctx.restore();
    });
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // 새 구역 진입 시 배너
  _renderMilestone(ctx) {
    if (!this._lastMilestoneName) this._lastMilestoneName = '';
    const ts = this.assets.getThemeState(this.distance);
    if (this.scene.is(SCENE.PLAYING) && !this.gameOverReason && ts.cur.name !== this._lastMilestoneName) {
      this._lastMilestoneName = ts.cur.name;
      this._milestoneTimer = 2.0;
      this._milestoneText = ts.cur.name;
    }
    if (this._milestoneTimer > 0) {
      this._milestoneTimer -= 1 / 60;
      const a = Math.min(1, this._milestoneTimer) * Math.min(1, (2.0 - this._milestoneTimer) * 3);
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#22d3ee';
      ctx.strokeStyle = '#0a1a3f'; ctx.lineWidth = 6;
      ctx.font = '900 40px Segoe UI, Malgun Gothic';
      ctx.strokeText('▶ ' + this._milestoneText, this.W / 2, this.H * 0.34);
      ctx.fillText('▶ ' + this._milestoneText, this.W / 2, this.H * 0.34);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  start() {
    this.scene.goto(SCENE.NICKNAME);
    this._lastWall = (performance || Date).now();
    requestAnimationFrame((t) => this.loop(t));
    // 워치독: 백그라운드 탭 등으로 rAF가 멈추면(>120ms) 수동으로 프레임 구동.
    // rAF 체인은 그대로 유지되므로 탭이 다시 보일 때 자연스럽게 이어진다.
    setInterval(() => {
      const now = (performance || Date).now();
      if (now - this._lastWall > 120) this._step(now);
    }, 200);
  }
}
