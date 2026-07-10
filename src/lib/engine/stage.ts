/* eslint-disable */
// @ts-nocheck
import { AssetManager } from './assets';
/* ============================================================
   StageManager
   - 하나의 거대한 횡스크롤 월드를 렌더링.
   - 거리(m)에 따라 하늘/바닥 색이 자연스럽게 보간되고,
     테마별(외부→지하→로비→사무실→옥상→우주→...) 장식이 등장.
   - 패럴랙스 3레이어 + 위믹스 타워/로고/사무실/엘리베이터/포스터 등
     위메이드플레이 회사 요소를 배치.
   - 모든 요소는 월드좌표에 결정적으로 배치되어 카메라와 함께 스크롤.
   ============================================================ */
export class StageManager {
  constructor(assets) {
    this.assets = assets;
    this.PPM = 42;          // pixels per meter (월드 스케일)
    this.groundRatio = 0.82; // 바닥선 y 위치 (화면 높이 비율)
    this.starCache = null;
  }

  // 결정적 유사난수 (슬롯 인덱스 기반)
  _rand(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /*
    배경 전체 렌더.
    ctx, W, H : 컨텍스트/캔버스 크기
    distance  : 현재 거리(m)
    camX      : 카메라 월드 x (px)
  */
  draw(ctx, W, H, distance, camX) {
    const ts = this.assets.getThemeState(distance);
    const groundY = H * this.groundRatio;

    // ---- 하늘 (테마 색 보간) ----
    const skyTop = AssetManager.lerpColor(ts.cur.sky[0], ts.next.sky[0], ts.t);
    const skyBot = AssetManager.lerpColor(ts.cur.sky[1], ts.next.sky[1], ts.t);
    const grad = ctx.createLinearGradient(0, 0, 0, groundY);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, groundY);

    const kind = ts.cur.kind;
    const accent = AssetManager.lerpColor(ts.cur.accent, ts.next.accent, ts.t);
    const isSpaceLike = ['space', 'galaxy', 'aiworld', 'digital', 'pixel', 'void'].includes(kind);
    const isOutdoor = ['exterior', 'rooftop', 'sky'].includes(kind);
    const isIndoor = ['lobby', 'office', 'dev', 'meeting', 'studio', 'parking', 'machine', 'cafeteria', 'corridor'].includes(kind);

    // 우주류 배경 별 + 성운
    if (isSpaceLike) this._drawStars(ctx, W, groundY, camX, kind);

    // 야외: 햇살 글로우 + 지평선 헤이즈
    if (isOutdoor) this._skyAtmosphere(ctx, W, groundY, kind, skyBot, camX);

    // 실내: 천장/벽 그라데이션 + 은은한 조명
    if (isIndoor) this._interiorAtmosphere(ctx, W, groundY, kind, accent);

    // ---- 원경 패럴랙스 (0.22x) ----
    this._drawFarLayer(ctx, W, H, groundY, camX * 0.22, ts, kind);

    // ---- 중경 패럴랙스 (0.55x) ----
    this._drawMidLayer(ctx, W, H, groundY, camX * 0.55, ts, kind);

    // 지평선 접합부 소프트 섀도(깊이감)
    const hz = ctx.createLinearGradient(0, groundY - 40, 0, groundY + 8);
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, groundY - 40, W, 48);

    // ---- 바닥 (수직 그라데이션 + 광택) ----
    const gTop = AssetManager.lerpColor(ts.cur.ground, ts.next.ground, ts.t);
    const gBot = this._shade(gTop, -0.28);
    const gg = ctx.createLinearGradient(0, groundY, 0, H);
    gg.addColorStop(0, this._shade(gTop, 0.06));
    gg.addColorStop(0.25, gTop);
    gg.addColorStop(1, gBot);
    ctx.fillStyle = gg;
    ctx.fillRect(0, groundY, W, H - groundY);
    // 표면 림 라이트
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(0, groundY, W, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, groundY + 2, W, 6);

    // 바닥 결/타일 (근경 패럴랙스 1x)
    this._drawGroundDetail(ctx, W, H, groundY, camX, kind);

    // ---- 근경 장식(회사 요소) 1x ----
    this._drawProps(ctx, W, H, groundY, camX, distance);

    // 전체 비네트(가장자리 어둡게) — 깊이감
    const vg = ctx.createRadialGradient(W / 2, groundY * 0.5, groundY * 0.3, W / 2, groundY * 0.5, W * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    return groundY;
  }

  // 야외 대기: 태양 글로우 + 지평선 헤이즈
  _skyAtmosphere(ctx, W, groundY, kind, horizonCol, camX) {
    ctx.save();
    // 태양/광원
    const sx = W * 0.72, sy = groundY * 0.32;
    const sr = W * 0.34;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    const warm = kind === 'sky' ? 'rgba(255,255,255,0.5)' : 'rgba(255,246,210,0.55)';
    sun.addColorStop(0, warm);
    sun.addColorStop(0.5, 'rgba(255,240,200,0.12)');
    sun.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, groundY);
    // 지평선 헤이즈
    const haze = ctx.createLinearGradient(0, groundY - groundY * 0.28, 0, groundY);
    haze.addColorStop(0, 'rgba(255,255,255,0)');
    haze.addColorStop(1, this._alpha(horizonCol, 0.55));
    ctx.fillStyle = haze;
    ctx.fillRect(0, groundY - groundY * 0.28, W, groundY * 0.28);
    ctx.restore();
  }

  // 실내 대기: 천장 그림자 + 바닥 근처 조명 반사
  _interiorAtmosphere(ctx, W, groundY, kind, accent) {
    ctx.save();
    // 천장 어둠
    const ceil = ctx.createLinearGradient(0, 0, 0, groundY * 0.5);
    ceil.addColorStop(0, 'rgba(0,0,0,0.16)');
    ceil.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ceil;
    ctx.fillRect(0, 0, W, groundY * 0.5);
    // 은은한 액센트 조명(바닥 근처)
    const glow = ctx.createLinearGradient(0, groundY - groundY * 0.35, 0, groundY);
    glow.addColorStop(0, 'rgba(255,255,255,0)');
    glow.addColorStop(1, this._alpha(accent, 0.12));
    ctx.fillStyle = glow;
    ctx.fillRect(0, groundY - groundY * 0.35, W, groundY * 0.35);
    ctx.restore();
  }

  // 색 밝기 조절 (t>0 밝게, t<0 어둡게)
  _shade(col, t) {
    const p = AssetManager.hexToRgb(col.startsWith('#') ? col : this._toHex(col));
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + (t > 0 ? (255 - c) * t : c * t))));
    return `rgb(${f(p.r)},${f(p.g)},${f(p.b)})`;
  }
  _alpha(col, a) {
    const p = AssetManager.hexToRgb(col.startsWith('#') ? col : this._toHex(col));
    return `rgba(${p.r},${p.g},${p.b},${a})`;
  }
  _toHex(rgb) {
    const m = rgb.match(/\d+/g);
    if (!m) return '#000000';
    return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  }

  // ---------- 별 (우주류) ----------
  _drawStars(ctx, W, H, camX, kind) {
    ctx.save();
    for (let i = 0; i < 90; i++) {
      const bx = (this._rand(i) * W * 3 - camX * 0.1) % (W + 40);
      const x = bx < 0 ? bx + W + 40 : bx;
      const y = this._rand(i + 50) * H;
      const s = this._rand(i + 99) * 1.8 + 0.4;
      const tw = 0.5 + 0.5 * Math.abs(Math.sin(camX * 0.001 + i));
      if (kind === 'galaxy' || kind === 'pixel') {
        ctx.fillStyle = `rgba(${180 + this._rand(i) * 75 | 0},${120 + this._rand(i + 3) * 100 | 0},255,${tw})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${tw})`;
      }
      ctx.fillRect(x, y, s, s);
    }
    // 큰 행성/구조물
    if (kind === 'space' || kind === 'galaxy') {
      const px = ((W * 0.7 - camX * 0.05) % (W * 2) + W * 2) % (W * 2);
      const r = W * 0.09;
      const g = ctx.createRadialGradient(px - r * 0.3, H * 0.28 - r * 0.3, r * 0.2, px, H * 0.28, r);
      g.addColorStop(0, kind === 'galaxy' ? '#ff9be0' : '#8fd0ff');
      g.addColorStop(1, kind === 'galaxy' ? '#7a2bd0' : '#2a5fb0');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, H * 0.28, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ---------- 원경 레이어 ----------
  _drawFarLayer(ctx, W, H, groundY, ox, ts, kind) {
    ctx.save();
    if (kind === 'exterior' || kind === 'rooftop' || kind === 'sky') {
      // 도시 스카이라인 + 위믹스 타워 (2겹 원근)
      this._citySkyline(ctx, W, groundY, ox * 0.6, ts.cur.accent, 0.18, 0.55);
      this._citySkyline(ctx, W, groundY, ox, ts.cur.accent, 0.32, 0.78);
    } else if (['lobby', 'office', 'dev', 'meeting', 'studio'].includes(kind)) {
      // 실내: 벽 + 따뜻한 조명 창문 + 몰딩
      const wallTop = groundY * 0.12;
      // 벽 패널
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, wallTop, W, groundY - wallTop);
      // 걸레받이(몰딩)
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(0, groundY - 14, W, 14);
      // 창문/유리 파티션 (은은한 빛)
      const winW = 130, gap = 70, unit = winW + gap;
      for (let i = -1; i < W / unit + 2; i++) {
        const x = ((i * unit - ox * 0.5) % (W + unit) + W + unit) % (W + unit) - winW;
        const wy = groundY * 0.22, wh = groundY * 0.42;
        const g = ctx.createLinearGradient(0, wy, 0, wy + wh);
        g.addColorStop(0, 'rgba(180,220,255,0.22)');
        g.addColorStop(1, 'rgba(120,170,230,0.10)');
        ctx.fillStyle = g; ctx.fillRect(x, wy, winW, wh);
        ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 2;
        ctx.strokeRect(x, wy, winW, wh);
        ctx.beginPath(); ctx.moveTo(x + winW / 2, wy); ctx.lineTo(x + winW / 2, wy + wh); ctx.stroke();
      }
    } else if (['parking', 'machine', 'cafeteria', 'corridor'].includes(kind)) {
      // 지하: 콘크리트 벽 + 기둥 + 형광등
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, W, groundY);
      const pW = 46, gap = 210, unit = pW + gap;
      for (let i = -1; i < W / unit + 2; i++) {
        const x = ((i * unit - ox) % (W + unit) + W + unit) % (W + unit) - pW;
        const g = ctx.createLinearGradient(x, 0, x + pW, 0);
        g.addColorStop(0, 'rgba(0,0,0,0.32)');
        g.addColorStop(0.5, 'rgba(90,100,120,0.28)');
        g.addColorStop(1, 'rgba(0,0,0,0.32)');
        ctx.fillStyle = g;
        ctx.fillRect(x, groundY * 0.08, pW, groundY * 0.92);
      }
      // 천장 형광등
      ctx.fillStyle = 'rgba(255,255,240,0.16)';
      const lg = 320, lo = (ox * 1.4) % lg;
      for (let x = -lo; x < W; x += lg) ctx.fillRect(x + 40, groundY * 0.1, 120, 6);
    }
    ctx.restore();
  }

  _citySkyline(ctx, W, groundY, ox, accent, alpha = 0.32, hScale = 0.78) {
    const baseY = groundY;
    const bw = 90;
    for (let i = -1; i < W / bw + 3; i++) {
      const seed = Math.floor((i * bw + ox) / bw);
      const h = (0.18 + this._rand(seed) * 0.4) * groundY * hScale;
      const x = ((i * bw - ox) % (W + bw * 2) + W + bw * 2) % (W + bw * 2) - bw;
      // 건물 몸체 (원근에 따른 채도/명도)
      ctx.fillStyle = `rgba(40,62,105,${alpha})`;
      ctx.fillRect(x, baseY - h, bw - 12, h);
      // 창문 불빛 (가까운 레이어만)
      if (alpha > 0.25) {
        ctx.fillStyle = `rgba(150,200,255,${alpha * 0.5})`;
        for (let ry = 0; ry < h / 22; ry++) {
          for (let rx = 0; rx < 3; rx++) {
            if (this._rand(seed * 7 + ry * 3 + rx) > 0.55)
              ctx.fillRect(x + 8 + rx * 22, baseY - h + 10 + ry * 22, 12, 12);
          }
        }
      }
    }
    // 위믹스 타워 (랜드마크) — 가까운 레이어에만
    if (alpha > 0.25) {
      const towerPeriod = W * 2.2;
      for (let k = -1; k < 3; k++) {
        const tx = ((k * towerPeriod - ox * 1.0) % (towerPeriod) + towerPeriod) % (towerPeriod);
        this._wemixTower(ctx, tx - towerPeriod + W * 0.6, baseY, groundY * 0.78, accent);
      }
    }
  }

  _wemixTower(ctx, x, baseY, h, accent) {
    const w = h * 0.16;
    ctx.save();
    // 타워 몸체 (그라데이션 유리)
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#12325f');
    g.addColorStop(0.5, '#2a5fb0');
    g.addColorStop(1, '#12325f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, baseY);
    ctx.lineTo(x - w * 0.32, baseY - h);
    ctx.lineTo(x + w * 0.32, baseY - h);
    ctx.lineTo(x + w / 2, baseY);
    ctx.closePath();
    ctx.fill();
    // 창문 격자
    ctx.fillStyle = 'rgba(140,200,255,0.25)';
    for (let r = 0; r < 22; r++) {
      const yy = baseY - h * 0.05 - r * (h * 0.042);
      ctx.fillRect(x - w * 0.28, yy, w * 0.56, h * 0.02);
    }
    // 첨탑 + 로고 라이트
    ctx.fillStyle = accent;
    ctx.fillRect(x - 2, baseY - h - h * 0.08, 4, h * 0.08);
    ctx.beginPath(); ctx.arc(x, baseY - h - h * 0.08, w * 0.12, 0, Math.PI * 2); ctx.fill();
    // WEMIX 세로 텍스트
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `bold ${Math.max(8, w * 0.22)}px Segoe UI`;
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x, baseY - h * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('WEMIX', 0, w * 0.08);
    ctx.restore();
    ctx.restore();
  }

  // ---------- 중경 레이어 ----------
  _drawMidLayer(ctx, W, H, groundY, ox, ts, kind) {
    // 실내면 벽 하단 몰딩/바닥 반사, 로비면 카운터 등 — 근경 props에서 대부분 처리
    if (kind === 'aiworld' || kind === 'digital' || kind === 'pixel') {
      // 디지털 그리드 라인
      ctx.save();
      ctx.strokeStyle = 'rgba(53,240,160,0.15)';
      if (kind === 'digital') ctx.strokeStyle = 'rgba(34,211,238,0.15)';
      if (kind === 'pixel') ctx.strokeStyle = 'rgba(255,90,158,0.15)';
      ctx.lineWidth = 1;
      const gap = 60;
      for (let i = 0; i < W / gap + 2; i++) {
        const x = ((i * gap - ox) % (W + gap) + W + gap) % (W + gap);
        ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x - (x - W / 2) * 0.3, groundY * 0.3); ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------- 바닥 디테일 ----------
  _drawGroundDetail(ctx, W, H, groundY, camX, kind) {
    ctx.save();
    const tile = 84;
    const off = camX % tile;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let x = -off; x < W; x += tile) {
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(x, H); ctx.stroke();
    }
    // 지하주차장 노란 주차선
    if (kind === 'parking') {
      ctx.strokeStyle = 'rgba(255,207,51,0.5)';
      ctx.lineWidth = 4;
      const p = 220, o = camX % p;
      for (let x = -o; x < W; x += p) {
        ctx.beginPath(); ctx.moveTo(x, groundY + 8); ctx.lineTo(x, H); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ---------- 근경 장식(회사 요소) ----------
  _drawProps(ctx, W, H, groundY, camX, distance) {
    const slot = 300; // 장식 간격(px world)
    const startSlot = Math.floor((camX - W * 0.2) / slot) - 1;
    const endSlot = Math.floor((camX + W * 1.2) / slot) + 1;
    for (let s = startSlot; s <= endSlot; s++) {
      const worldX = s * slot;
      const screenX = worldX - camX;
      const m = worldX / this.PPM; // 이 슬롯의 거리(m)
      if (m < 0) continue;
      const ts = this.assets.getThemeState(m);
      this._prop(ctx, screenX, groundY, H, ts.cur.kind, s, ts.cur.accent);
    }
  }

  _prop(ctx, x, groundY, H, kind, seed, accent) {
    const r = this._rand(seed);
    const r2 = this._rand(seed + 777);
    ctx.save();
    switch (kind) {
      case 'exterior':
        if (r < 0.32) this._signboard(ctx, x, groundY, 'WEMADE PLAY', accent);
        else if (r < 0.58) this._tree(ctx, x, groundY);
        else if (r < 0.8) this._streetLamp(ctx, x, groundY);
        else this._bush(ctx, x, groundY);
        break;
      case 'parking':
        if (r < 0.5) this._car(ctx, x, groundY, r2);
        else this._pillar(ctx, x, groundY, H, 'B4');
        break;
      case 'machine':
        if (r < 0.5) this._machine(ctx, x, groundY);
        else this._pillar(ctx, x, groundY, H, 'B3');
        break;
      case 'cafeteria':
        if (r < 0.5) this._table(ctx, x, groundY, '#8a5a2b');
        else this._cafeCounter(ctx, x, groundY);
        break;
      case 'corridor':
        if (r < 0.5) this._doorSign(ctx, x, groundY, 'B1', accent);
        else this._plant(ctx, x, groundY);
        break;
      case 'lobby':
        if (r < 0.3) this._deskInfo(ctx, x, groundY);
        else if (r < 0.55) this._elevator(ctx, x, groundY, H);
        else if (r < 0.8) this._logoStand(ctx, x, groundY, 'WEMIX', accent);
        else this._plant(ctx, x, groundY);
        break;
      case 'office':
        if (r < 0.5) this._officeDesk(ctx, x, groundY, r2);
        else this._doorSign(ctx, x, groundY, r2 < 0.5 ? '회의실' : '휴게실', accent);
        break;
      case 'dev':
        if (r < 0.55) this._officeDesk(ctx, x, groundY, r2, true);
        else this._doorSign(ctx, x, groundY, r2 < 0.5 ? '개발실' : 'QA실', accent);
        break;
      case 'meeting':
        if (r < 0.5) this._meetingTable(ctx, x, groundY);
        else this._doorSign(ctx, x, groundY, r2 < 0.5 ? '회의실' : '휴게실', accent);
        break;
      case 'studio':
        if (r < 0.45) this._goods(ctx, x, groundY, r2);
        else if (r < 0.75) this._officeDesk(ctx, x, groundY, r2, true);
        else this._plant(ctx, x, groundY);
        break;
      case 'rooftop':
        if (r < 0.5) this._rooftopAC(ctx, x, groundY);
        else this._logoStand(ctx, x, groundY, 'WEMADE', accent);
        break;
      case 'sky':
        this._cloud(ctx, x, groundY - this._rand(seed + 5) * 120, this._rand(seed + 9));
        break;
      case 'space': case 'galaxy':
        if (r < 0.5) this._satellite(ctx, x, groundY);
        break;
      case 'aiworld':
        this._aiNode(ctx, x, groundY, accent);
        break;
      case 'digital':
        this._dataPillar(ctx, x, groundY, H, accent);
        break;
      case 'pixel':
        this._pixelBlock(ctx, x, groundY, seed, accent);
        break;
      case 'void':
        if (r < 0.4) this._logoStand(ctx, x, groundY, '?', accent);
        break;
    }
    ctx.restore();
  }

  // ===== 개별 프롭 드로잉 =====
  _text(ctx, x, y, str, size, color, weight = 'bold') {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Segoe UI, Malgun Gothic`;
    ctx.textAlign = 'center';
    ctx.fillText(str, x, y);
  }

  _signboard(ctx, x, groundY, label, accent) {
    const w = 130, h = 44, y = groundY - 150;
    ctx.fillStyle = '#0a1a3f';
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    this._rr(ctx, x - w / 2, y, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a3550'; ctx.fillRect(x - 4, y + h, 8, 106);
    this._text(ctx, x, y + 28, label, 16, '#fff');
  }

  _logoStand(ctx, x, groundY, label, accent) {
    const w = 90, h = 60, y = groundY - h;
    ctx.fillStyle = '#dfe8f5'; ctx.fillRect(x - 6, y, 12, h);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#1652f0'); g.addColorStop(1, '#22d3ee');
    ctx.fillStyle = g; this._rr(ctx, x - w / 2, y - 46, w, 46, 8); ctx.fill();
    this._text(ctx, x, y - 16, label, label.length > 5 ? 15 : 20, '#fff', '900');
  }

  // 가로등 (야외 퀄리티 업)
  _streetLamp(ctx, x, groundY) {
    ctx.save();
    ctx.fillStyle = '#3a4763';
    ctx.fillRect(x - 4, groundY - 150, 8, 150);
    ctx.beginPath(); ctx.moveTo(x - 4, groundY - 150);
    ctx.quadraticCurveTo(x - 4, groundY - 170, x + 26, groundY - 168); ctx.lineTo(x + 26, groundY - 160);
    ctx.quadraticCurveTo(x + 2, groundY - 160, x + 4, groundY - 150); ctx.closePath(); ctx.fill();
    // 램프 + 글로우
    const g = ctx.createRadialGradient(x + 26, groundY - 156, 2, x + 26, groundY - 156, 34);
    g.addColorStop(0, 'rgba(255,240,190,0.85)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + 26, groundY - 156, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(x + 26, groundY - 156, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a3550'; ctx.fillRect(x - 12, groundY - 8, 24, 8);
    ctx.restore();
  }

  // 관목/화단
  _bush(ctx, x, groundY) {
    ctx.fillStyle = '#2f9350';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.arc(x + i * 20, groundY - 16, 18 + Math.abs(i) * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#3ba85a';
    ctx.beginPath(); ctx.arc(x - 8, groundY - 24, 12, 0, Math.PI * 2);
    ctx.arc(x + 12, groundY - 22, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x, groundY - 2, 34, 5, 0, 0, Math.PI * 2); ctx.fill();
  }

  _tree(ctx, x, groundY) {
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x - 5, groundY - 40, 10, 40);
    ctx.fillStyle = '#3ba85a';
    ctx.beginPath(); ctx.arc(x, groundY - 55, 26, 0, Math.PI * 2);
    ctx.arc(x - 18, groundY - 42, 18, 0, Math.PI * 2);
    ctx.arc(x + 18, groundY - 42, 18, 0, Math.PI * 2); ctx.fill();
  }

  _plant(ctx, x, groundY) {
    ctx.fillStyle = '#c98b4a'; this._rr(ctx, x - 14, groundY - 26, 28, 26, 4); ctx.fill();
    ctx.fillStyle = '#3ba85a';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(x + i * 10, groundY - 44, 8, 24, i * 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  _car(ctx, x, groundY, r) {
    const colors = ['#e05a5a', '#5a8ae0', '#e0c05a', '#6ac96a'];
    const c = colors[Math.floor(r * colors.length)];
    ctx.fillStyle = c;
    this._rr(ctx, x - 45, groundY - 34, 90, 24, 6); ctx.fill();
    this._rr(ctx, x - 28, groundY - 52, 52, 22, 8); ctx.fill();
    ctx.fillStyle = '#aef'; this._rr(ctx, x - 22, groundY - 48, 44, 14, 4); ctx.fill();
    ctx.fillStyle = '#1a1f2b';
    ctx.beginPath(); ctx.arc(x - 26, groundY - 10, 10, 0, Math.PI * 2); ctx.arc(x + 26, groundY - 10, 10, 0, Math.PI * 2); ctx.fill();
  }

  _pillar(ctx, x, groundY, H, label) {
    ctx.fillStyle = '#3a4150'; ctx.fillRect(x - 26, groundY - 200, 52, 200 + (H - groundY));
    ctx.fillStyle = '#ffcf33'; ctx.fillRect(x - 26, groundY - 60, 52, 8);
    this._text(ctx, x, groundY - 100, label, 30, 'rgba(255,255,255,0.5)', '900');
  }

  _machine(ctx, x, groundY) {
    ctx.fillStyle = '#4a4a55'; this._rr(ctx, x - 40, groundY - 90, 80, 90, 6); ctx.fill();
    ctx.fillStyle = '#22d3ee';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 22 + i * 22, groundY - 66, 6, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#2a2a33'; ctx.fillRect(x - 30, groundY - 40, 60, 30);
    ctx.strokeStyle = '#666'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x + 40, groundY - 60); ctx.lineTo(x + 70, groundY - 60); ctx.stroke();
  }

  _table(ctx, x, groundY, col) {
    ctx.fillStyle = col; this._rr(ctx, x - 45, groundY - 44, 90, 10, 3); ctx.fill();
    ctx.fillRect(x - 40, groundY - 44, 6, 44); ctx.fillRect(x + 34, groundY - 44, 6, 44);
    // 식판
    ctx.fillStyle = '#dfe8f5'; this._rr(ctx, x - 20, groundY - 50, 40, 8, 3); ctx.fill();
  }

  _cafeCounter(ctx, x, groundY) {
    ctx.fillStyle = '#5a3a22'; this._rr(ctx, x - 50, groundY - 60, 100, 60, 6); ctx.fill();
    ctx.fillStyle = '#fff'; this._rr(ctx, x - 50, groundY - 66, 100, 10, 4); ctx.fill();
    this._text(ctx, x, groundY - 26, 'CAFE', 18, '#ffcf33', '900');
    // 커피잔
    ctx.fillStyle = '#fff'; this._rr(ctx, x + 20, groundY - 84, 16, 18, 3); ctx.fill();
  }

  _doorSign(ctx, x, groundY, label, accent) {
    const w = 64, h = 150;
    ctx.fillStyle = '#c7d3e6'; ctx.fillRect(x - w / 2, groundY - h, w, h);
    ctx.fillStyle = '#8a97ad'; ctx.fillRect(x - w / 2, groundY - h, 4, h);
    ctx.fillStyle = accent; this._rr(ctx, x - 34, groundY - h - 26, 68, 26, 6); ctx.fill();
    this._text(ctx, x, groundY - h - 8, label, 15, '#fff', '800');
    ctx.fillStyle = '#ffcf33'; ctx.beginPath(); ctx.arc(x + 18, groundY - h / 2, 4, 0, Math.PI * 2); ctx.fill();
  }

  _deskInfo(ctx, x, groundY) {
    ctx.fillStyle = '#1652f0'; this._rr(ctx, x - 55, groundY - 50, 110, 50, 6); ctx.fill();
    ctx.fillStyle = '#dfe8f5'; this._rr(ctx, x - 55, groundY - 56, 110, 10, 4); ctx.fill();
    this._text(ctx, x, groundY - 20, 'INFO', 18, '#fff', '900');
    // 안내판
    ctx.fillStyle = '#0a1a3f'; this._rr(ctx, x - 20, groundY - 120, 40, 56, 6); ctx.fill();
    this._text(ctx, x, groundY - 88, 'i', 30, '#22d3ee', '900');
  }

  _elevator(ctx, x, groundY, H) {
    const w = 96, h = 170;
    ctx.fillStyle = '#8fa2bd'; ctx.fillRect(x - w / 2 - 6, groundY - h - 6, w + 12, h + 6);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, '#c7d3e6'); g.addColorStop(0.5, '#eef4fb'); g.addColorStop(1, '#c7d3e6');
    ctx.fillStyle = g; ctx.fillRect(x - w / 2, groundY - h, w, h);
    ctx.strokeStyle = '#8fa2bd'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, groundY - h); ctx.lineTo(x, groundY); ctx.stroke();
    // 층 표시
    ctx.fillStyle = '#0a1a3f'; this._rr(ctx, x - 22, groundY - h - 28, 44, 22, 4); ctx.fill();
    this._text(ctx, x, groundY - h - 11, '▲ 25', 14, '#22d3ee', '800');
  }

  _officeDesk(ctx, x, groundY, r, dev) {
    ctx.fillStyle = '#c9a06a'; this._rr(ctx, x - 50, groundY - 34, 100, 8, 2); ctx.fill();
    ctx.fillStyle = '#a07840'; ctx.fillRect(x - 46, groundY - 34, 6, 34); ctx.fillRect(x + 40, groundY - 34, 6, 34);
    // 모니터
    ctx.fillStyle = '#1a1f2b'; this._rr(ctx, x - 24, groundY - 74, 48, 34, 3); ctx.fill();
    ctx.fillStyle = dev ? '#0f1e12' : '#123'; this._rr(ctx, x - 20, groundY - 70, 40, 26, 2); ctx.fill();
    // 코드 라인 (개발실)
    if (dev) {
      ctx.fillStyle = '#35f0a0';
      for (let i = 0; i < 4; i++) ctx.fillRect(x - 16, groundY - 66 + i * 6, (r * 20 + 8 + i * 3) % 30, 2);
    } else {
      ctx.fillStyle = '#22d3ee'; ctx.fillRect(x - 16, groundY - 64, 32, 14);
    }
    ctx.fillStyle = '#333'; ctx.fillRect(x - 6, groundY - 40, 12, 6);
    // 의자
    ctx.fillStyle = '#2a3550'; this._rr(ctx, x + 30, groundY - 44, 20, 30, 4); ctx.fill();
  }

  _meetingTable(ctx, x, groundY) {
    ctx.fillStyle = '#5a6b86'; ctx.beginPath();
    ctx.ellipse(x, groundY - 30, 60, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#465370'; ctx.fillRect(x - 4, groundY - 30, 8, 30);
    // 의자들
    ctx.fillStyle = '#2a3550';
    for (let i = -2; i <= 2; i++) { this._rr(ctx, x + i * 22 - 6, groundY - 48, 12, 18, 3); ctx.fill(); }
    // 화이트보드
    ctx.fillStyle = '#fff'; this._rr(ctx, x - 40, groundY - 120, 80, 44, 4); ctx.fill();
    ctx.strokeStyle = '#1652f0'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 30, groundY - 100); ctx.lineTo(x + 20, groundY - 110);
    ctx.lineTo(x + 30, groundY - 90); ctx.stroke();
  }

  _goods(ctx, x, groundY) {
    // 애니팡 굿즈 진열 (인형/피규어)
    const cols = ['#ffdf4d', '#ffc2d6', '#e7ecf5', '#f2b45a'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = cols[(i + Math.floor(x)) % cols.length];
      const gx = x - 30 + i * 30;
      ctx.beginPath(); ctx.arc(gx, groundY - 24, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1f2b';
      ctx.beginPath(); ctx.arc(gx - 4, groundY - 26, 2.5, 0, Math.PI * 2); ctx.arc(gx + 4, groundY - 26, 2.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x - 44, groundY - 10, 88, 10);
  }

  _rooftopAC(ctx, x, groundY) {
    ctx.fillStyle = '#9aa7bd'; this._rr(ctx, x - 34, groundY - 40, 68, 40, 4); ctx.fill();
    ctx.strokeStyle = '#6b7896'; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 28, groundY - 34 + i * 8); ctx.lineTo(x + 28, groundY - 34 + i * 8); ctx.stroke(); }
  }

  _cloud(ctx, x, y, r) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 22 + r * 10, 0, Math.PI * 2);
    ctx.arc(x - 24, y + 6, 16, 0, Math.PI * 2);
    ctx.arc(x + 24, y + 6, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  _satellite(ctx, x, groundY) {
    const y = groundY - 60;
    ctx.fillStyle = '#c7d3e6'; this._rr(ctx, x - 12, y, 24, 30, 4); ctx.fill();
    ctx.fillStyle = '#1652f0'; ctx.fillRect(x - 40, y + 6, 24, 16); ctx.fillRect(x + 16, y + 6, 24, 16);
    ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + 15, 20, -0.5, 0.5); ctx.stroke();
  }

  _aiNode(ctx, x, groundY, accent) {
    const y = groundY - 70;
    ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.fillStyle = accent;
    const pts = [[0, 0], [-30, 30], [30, 30], [-20, 60], [20, 60]];
    ctx.globalAlpha = 0.5;
    for (let i = 1; i < pts.length; i++) {
      ctx.beginPath(); ctx.moveTo(x + pts[0][0], y + pts[0][1]);
      ctx.lineTo(x + pts[i][0], y + pts[i][1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    pts.forEach(p => { ctx.beginPath(); ctx.arc(x + p[0], y + p[1], 5, 0, Math.PI * 2); ctx.fill(); });
    this._text(ctx, x, y - 12, 'AI', 16, accent, '900');
  }

  _dataPillar(ctx, x, groundY, H, accent) {
    const h = 60 + (this._rand(Math.floor(x)) * 120);
    ctx.fillStyle = 'rgba(34,211,238,0.15)'; ctx.fillRect(x - 16, groundY - h, 32, h);
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5; ctx.strokeRect(x - 16, groundY - h, 32, h);
    ctx.fillStyle = accent; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    for (let i = 0; i < h / 14; i++) ctx.fillText(Math.random() > 0.5 ? '1' : '0', x, groundY - i * 14 - 4);
  }

  _pixelBlock(ctx, x, groundY, seed, accent) {
    const cols = ['#ff5a9e', '#ffcf33', '#22d3ee', '#35f0a0'];
    const px = 12;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      if (this._rand(seed + i * 7 + j * 13) > 0.45) {
        ctx.fillStyle = cols[(i + j) % cols.length];
        ctx.fillRect(x - 30 + i * px, groundY - 48 + j * px, px, px);
      }
    }
  }

  // 사각형 라운드 헬퍼
  _rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
