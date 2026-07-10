/* ============================================================
   CharacterManager
   - 애니팡 프렌즈 캐릭터를 canvas에 절차적으로 렌더링.
   - 원작 치비 비율: 큰 머리 + 작은 몸통(밝은 배) + 짧은 팔다리.
   - 지원: panda(MAO), pig(PINKY), rabbit(ANI), dog(BLUE),
     monkey(MONGYI), cat(LUCY), bear(MICKY), bomb(PANG), chick(ARI)
   ============================================================ */
class CharacterManager {
  constructor(assets) {
    this.assets = assets;
    this.walkPhase = 0;
  }

  update(dt, speedFactor) {
    this.walkPhase += dt * (6 + speedFactor * 6);
  }

  draw(ctx, def, x, y, size, opts = {}) {
    const balance = opts.balance || 0;
    const perfect = opts.perfect;
    const moving = opts.moving;

    ctx.save();
    ctx.translate(x, y);

    if (opts.fallen) {
      const p = Math.min(1, opts.fallProgress || 0);
      const ease = 1 - Math.pow(1 - p, 3);
      const angle = opts.fallDir * (Math.PI / 2) * ease;
      ctx.translate(0, -size * 0.05);
      ctx.rotate(angle);
      ctx.translate(0, size * 0.05);
      this._drawBody(ctx, def, size, { walk: 0, arms: 0.25, eyeState: 'x' });
      ctx.restore();
      return;
    }

    const bounce = moving ? Math.abs(Math.sin(this.walkPhase)) * size * 0.04 : 0;
    const sway = moving ? Math.sin(this.walkPhase * 0.5) * 0.02 : 0;
    const lean = balance * 0.5 + sway;
    const arms = 0.25 + Math.abs(balance) * 0.85;

    ctx.translate(0, -bounce);
    ctx.rotate(lean);

    this._drawBody(ctx, def, size, {
      walk: this.walkPhase, arms, moving,
      eyeState: perfect ? 'happy' : (Math.abs(balance) > 0.6 ? 'worried' : 'normal'),
      perfect,
    });

    ctx.restore();
  }

  // 공통 몸체 (발밑 원점 기준)
  _drawBody(ctx, def, S, st) {
    if (def.type === 'bomb') { this._drawBomb(ctx, def, S, st); return; }

    // 레이아웃
    const headR = S * 0.30;
    const headCy = -S * 0.62;
    const bodyCy = -S * 0.24;
    const bodyRx = S * 0.235;
    const bodyRy = S * 0.215;
    const lw = S * 0.02;

    // 그림자
    ctx.save();
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 0, S * 0.26, S * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = def.detail; ctx.lineWidth = lw; ctx.lineJoin = 'round';

    // 꼬리 (고양이/원숭이) — 몸통 뒤
    this._tail(ctx, def, S, bodyCy, bodyRx);

    // 다리/발
    const swing = st.moving ? Math.sin(st.walk) * S * 0.05 : 0;
    this._foot(ctx, -S * 0.1 + swing, -S * 0.015, S, def);
    this._foot(ctx, S * 0.1 - swing, -S * 0.015, S, def);

    // 몸통
    ctx.fillStyle = def.body;
    this._ellipse(ctx, 0, bodyCy, bodyRx, bodyRy); ctx.fill(); ctx.stroke();
    // 배 (밝은 부분)
    if (def.belly) {
      ctx.fillStyle = def.belly;
      this._ellipse(ctx, 0, bodyCy + S * 0.02, bodyRx * 0.62, bodyRy * 0.72); ctx.fill();
    }

    // 팔 (균형에 따라 벌어짐)
    this._arm(ctx, -bodyRx * 0.92, bodyCy - S * 0.03, -st.arms, S, def);
    this._arm(ctx, bodyRx * 0.92, bodyCy - S * 0.03, st.arms, S, def);

    // 귀 (머리 뒤)
    this._ears(ctx, 0, headCy, headR, def);

    // 머리
    ctx.fillStyle = def.body;
    ctx.beginPath(); ctx.arc(0, headCy, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 얼굴 특징 (패치/주둥이/줄무늬)
    this._faceFeatures(ctx, 0, headCy, headR, def);

    // 볼
    this._cheeks(ctx, 0, headCy, headR, def);

    // 눈 / 코 / 입
    const eyeState = (def.type === 'panda' && st.eyeState === 'normal') ? 'happy' : st.eyeState;
    this._eyes(ctx, 0, headCy, headR, eyeState, def);
    this._nose(ctx, 0, headCy, headR, def);

    // MAO 금색 팔찌
    if (def.type === 'panda' && def.accent) {
      ctx.strokeStyle = def.accent; ctx.lineWidth = S * 0.03; ctx.lineCap = 'round';
      [-1, 1].forEach(s => {
        ctx.beginPath();
        ctx.arc(s * bodyRx * 0.92, bodyCy + S * 0.08, S * 0.05, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.lineCap = 'butt';
    }

    // Perfect 반짝임
    if (st.perfect) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 3; i++) {
        const a = st.walk * 2 + i * 2.1;
        this._sparkle(ctx, Math.cos(a) * headR * 1.4, headCy + Math.sin(a) * headR * 1.4, headR * 0.16);
      }
    }
  }

  // ---------- 부위별 ----------
  _foot(ctx, x, y, S, def) {
    ctx.fillStyle = def.paw || def.body;
    ctx.strokeStyle = def.detail; ctx.lineWidth = S * 0.016;
    this._ellipse(ctx, x, y, S * 0.075, S * 0.05); ctx.fill(); ctx.stroke();
  }

  _arm(ctx, x, y, spread, S, def) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spread);
    ctx.fillStyle = def.body; ctx.strokeStyle = def.detail; ctx.lineWidth = S * 0.016;
    this._ellipse(ctx, 0, S * 0.11, S * 0.06, S * 0.13); ctx.fill(); ctx.stroke();
    // 손 끝 (paw 색)
    if (def.paw) {
      ctx.fillStyle = def.paw;
      this._ellipse(ctx, 0, S * 0.2, S * 0.05, S * 0.045); ctx.fill();
    }
    ctx.restore();
  }

  _tail(ctx, def, S, bodyCy, bodyRx) {
    if (def.type === 'cat') {
      ctx.fillStyle = def.body; ctx.strokeStyle = def.detail; ctx.lineWidth = S * 0.016;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(bodyRx * 0.8, bodyCy + S * 0.05);
      ctx.quadraticCurveTo(bodyRx * 1.9, bodyCy - S * 0.02, bodyRx * 1.6, bodyCy - S * 0.18);
      ctx.quadraticCurveTo(bodyRx * 1.5, bodyCy - S * 0.06, bodyRx * 0.8, bodyCy + S * 0.11);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    } else if (def.type === 'monkey') {
      ctx.strokeStyle = def.detail; ctx.lineWidth = S * 0.028; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bodyRx * 0.8, bodyCy + S * 0.06);
      ctx.quadraticCurveTo(bodyRx * 2.0, bodyCy + S * 0.05, bodyRx * 1.7, bodyCy - S * 0.14);
      ctx.stroke();
      ctx.strokeStyle = def.body; ctx.lineWidth = S * 0.016;
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
  }

  _ears(ctx, cx, cy, r, def) {
    ctx.fillStyle = def.ear || def.body;
    ctx.strokeStyle = def.detail; ctx.lineWidth = r * 0.06;
    const top = cy - r * 0.85;
    switch (def.type) {
      case 'panda':
        ctx.beginPath();
        ctx.arc(cx - r * 0.68, cy - r * 0.72, r * 0.34, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.68, cy - r * 0.72, r * 0.34, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        break;
      case 'bear':
        [-1, 1].forEach(s => {
          ctx.fillStyle = def.ear; ctx.beginPath();
          ctx.arc(cx + s * r * 0.72, cy - r * 0.68, r * 0.38, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = def.earInner || def.belly;
          ctx.beginPath(); ctx.arc(cx + s * r * 0.72, cy - r * 0.66, r * 0.2, 0, Math.PI * 2); ctx.fill();
        });
        break;
      case 'cat':
        this._triEar(ctx, cx - r * 0.6, top, r, -0.1, def);
        this._triEar(ctx, cx + r * 0.6, top, r, 0.1, def);
        break;
      case 'pig':
        this._floppyTri(ctx, cx - r * 0.58, cy - r * 0.6, r, -0.5, def);
        this._floppyTri(ctx, cx + r * 0.58, cy - r * 0.6, r, 0.5, def);
        break;
      case 'dog':
        // 늘어진 귀 (진한 파랑)
        ctx.fillStyle = def.ear;
        [-1, 1].forEach(s => {
          ctx.save(); ctx.translate(cx + s * r * 0.82, cy - r * 0.35); ctx.rotate(s * 0.3);
          this._ellipse(ctx, 0, r * 0.25, r * 0.26, r * 0.45); ctx.fill(); ctx.stroke();
          ctx.restore();
        });
        break;
      case 'monkey':
        [-1, 1].forEach(s => {
          ctx.fillStyle = def.ear; ctx.beginPath();
          ctx.arc(cx + s * r * 0.95, cy - r * 0.05, r * 0.26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = def.face || def.belly;
          ctx.beginPath(); ctx.arc(cx + s * r * 0.95, cy - r * 0.05, r * 0.14, 0, Math.PI * 2); ctx.fill();
        });
        break;
      case 'rabbit':
        ctx.fillStyle = def.ear;
        [-1, 1].forEach(s => {
          ctx.save(); ctx.translate(cx + s * r * 0.32, cy - r * 0.55); ctx.rotate(s * 0.14);
          this._ellipse(ctx, 0, -r * 0.7, r * 0.19, r * 0.72); ctx.fill(); ctx.stroke();
          ctx.fillStyle = def.earInner || '#f4a6c0';
          this._ellipse(ctx, 0, -r * 0.72, r * 0.09, r * 0.52); ctx.fill();
          ctx.fillStyle = def.ear;
          ctx.restore();
        });
        break;
      case 'chick':
        ctx.fillStyle = def.ear;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.1, cy - r * 0.9);
        ctx.quadraticCurveTo(cx - r * 0.05, cy - r * 1.4, cx + r * 0.18, cy - r * 1.15);
        ctx.quadraticCurveTo(cx + r * 0.3, cy - r * 1.35, cx + r * 0.14, cy - r * 0.95);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
    }
  }

  _triEar(ctx, x, y, r, tilt, def) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.fillStyle = def.ear || def.body;
    ctx.beginPath();
    ctx.moveTo(-r * 0.26, r * 0.28);
    ctx.lineTo(0, -r * 0.42);
    ctx.lineTo(r * 0.26, r * 0.28);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (def.earInner) {
      ctx.fillStyle = def.earInner;
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, r * 0.16); ctx.lineTo(0, -r * 0.2); ctx.lineTo(r * 0.12, r * 0.16);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  _floppyTri(ctx, x, y, r, tilt, def) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    ctx.fillStyle = def.ear || def.body;
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.05, -r * 0.4, r * 0.24, r * 0.05);
    ctx.quadraticCurveTo(r * 0.05, r * 0.12, -r * 0.2, -r * 0.05);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _faceFeatures(ctx, cx, cy, r, def) {
    switch (def.type) {
      case 'panda': {
        // 흰 얼굴
        ctx.fillStyle = def.face || '#fff';
        this._ellipse(ctx, cx, cy + r * 0.12, r * 0.72, r * 0.66); ctx.fill();
        // 진한 눈 패치
        ctx.fillStyle = def.detail;
        [-1, 1].forEach(s => {
          ctx.save(); ctx.translate(cx + s * r * 0.32, cy - r * 0.02); ctx.rotate(s * 0.5);
          this._ellipse(ctx, 0, 0, r * 0.2, r * 0.28); ctx.fill(); ctx.restore();
        });
        break;
      }
      case 'monkey': {
        // 밝은 하트형 얼굴 패치
        ctx.fillStyle = def.face;
        this._ellipse(ctx, cx, cy + r * 0.14, r * 0.66, r * 0.7); ctx.fill();
        // 이마 라인
        ctx.fillStyle = def.body;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.66, cy - r * 0.05);
        ctx.quadraticCurveTo(cx, cy - r * 0.55, cx + r * 0.66, cy - r * 0.05);
        ctx.quadraticCurveTo(cx, cy - r * 0.15, cx - r * 0.66, cy - r * 0.05);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'dog': {
        // 흰 주둥이
        ctx.fillStyle = def.face || def.belly;
        this._ellipse(ctx, cx, cy + r * 0.28, r * 0.42, r * 0.34); ctx.fill();
        break;
      }
      case 'cat': {
        // 이마 줄무늬 (M자)
        ctx.strokeStyle = def.stripe || def.detail; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + i * r * 0.16, cy - r * 0.7);
          ctx.lineTo(cx + i * r * 0.16, cy - r * 0.42);
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
        // 흰 주둥이
        ctx.fillStyle = def.face || def.belly;
        this._ellipse(ctx, cx, cy + r * 0.28, r * 0.38, r * 0.3); ctx.fill();
        break;
      }
      case 'bear': {
        ctx.fillStyle = def.face || def.belly;
        this._ellipse(ctx, cx, cy + r * 0.28, r * 0.38, r * 0.3); ctx.fill();
        break;
      }
    }
  }

  _cheeks(ctx, cx, cy, r, def) {
    ctx.fillStyle = def.cheek || 'rgba(255,140,160,0.55)';
    ctx.globalAlpha = def.cheek ? 0.85 : 1;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.52, cy + r * 0.24, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.52, cy + r * 0.24, r * 0.14, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _eyes(ctx, cx, cy, r, state, def) {
    // 눈 위치: 원숭이/강아지는 주둥이 위라 조금 높게
    const ex = r * 0.32, ey = cy - r * 0.02, er = r * 0.135;

    if (state === 'x') {
      ctx.strokeStyle = '#1a1f2b'; ctx.lineWidth = r * 0.06; ctx.lineCap = 'round';
      [-1, 1].forEach(s => {
        const bx = cx + s * ex;
        ctx.beginPath();
        ctx.moveTo(bx - er, ey - er); ctx.lineTo(bx + er, ey + er);
        ctx.moveTo(bx + er, ey - er); ctx.lineTo(bx - er, ey + er);
        ctx.stroke();
      });
      ctx.lineCap = 'butt';
      return;
    }

    if (state === 'happy') {
      ctx.strokeStyle = '#1a1f2b'; ctx.lineWidth = r * 0.065; ctx.lineCap = 'round';
      [-1, 1].forEach(s => {
        const bx = cx + s * ex;
        ctx.beginPath();
        ctx.moveTo(bx - er, ey + er * 0.5);
        ctx.quadraticCurveTo(bx, ey - er * 0.8, bx + er, ey + er * 0.5);
        ctx.stroke();
      });
      ctx.lineCap = 'butt';
      return;
    }

    // normal / worried
    const pupilY = state === 'worried' ? ey - er * 0.4 : ey;
    [-1, 1].forEach(s => {
      const bx = cx + s * ex;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(bx, ey, er * 1.02, er * 1.18, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = r * 0.01; ctx.stroke();
      ctx.fillStyle = '#1a1f2b';
      ctx.beginPath(); ctx.arc(bx, pupilY, er * 0.66, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(bx + er * 0.24, pupilY - er * 0.3, er * 0.22, 0, Math.PI * 2); ctx.fill();
    });
  }

  _nose(ctx, cx, cy, r, def) {
    switch (def.type) {
      case 'chick': {
        ctx.fillStyle = '#ff9f1c'; ctx.strokeStyle = '#e08a00'; ctx.lineWidth = r * 0.02;
        const ny = cy + r * 0.2;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.16, ny - r * 0.03);
        ctx.lineTo(cx + r * 0.16, ny - r * 0.03);
        ctx.lineTo(cx, ny + r * 0.18);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'pig': {
        const ny = cy + r * 0.24;
        ctx.fillStyle = def.face || '#ef8fb2'; ctx.strokeStyle = def.detail; ctx.lineWidth = r * 0.03;
        this._ellipse(ctx, cx, ny, r * 0.26, r * 0.19); ctx.fill(); ctx.stroke();
        ctx.fillStyle = def.detail;
        this._ellipse(ctx, cx - r * 0.1, ny, r * 0.05, r * 0.08); ctx.fill();
        this._ellipse(ctx, cx + r * 0.1, ny, r * 0.05, r * 0.08); ctx.fill();
        break;
      }
      case 'panda': {
        const ny = cy + r * 0.24;
        ctx.fillStyle = def.detail;
        this._ellipse(ctx, cx, ny, r * 0.1, r * 0.075); ctx.fill();
        ctx.strokeStyle = def.detail; ctx.lineWidth = r * 0.035; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, ny + r * 0.07);
        ctx.quadraticCurveTo(cx - r * 0.1, ny + r * 0.2, cx - r * 0.17, ny + r * 0.1);
        ctx.moveTo(cx, ny + r * 0.07);
        ctx.quadraticCurveTo(cx + r * 0.1, ny + r * 0.2, cx + r * 0.17, ny + r * 0.1);
        ctx.stroke(); ctx.lineCap = 'butt';
        break;
      }
      case 'rabbit': {
        const ny = cy + r * 0.24;
        ctx.fillStyle = def.detail;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.06, ny - r * 0.04); ctx.lineTo(cx + r * 0.06, ny - r * 0.04);
        ctx.lineTo(cx, ny + r * 0.05); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = def.detail; ctx.lineWidth = r * 0.03; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx, ny + r * 0.05); ctx.lineTo(cx, ny + r * 0.14); ctx.stroke();
        ctx.lineCap = 'butt';
        break;
      }
      default: { // dog / cat / bear / monkey
        const ny = cy + r * 0.2;
        ctx.fillStyle = (def.type === 'cat' && def.nose) ? def.nose : '#1a1f2b';
        this._ellipse(ctx, cx, ny, r * 0.1, r * 0.075); ctx.fill();
        ctx.strokeStyle = '#1a1f2b'; ctx.lineWidth = r * 0.035; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, ny + r * 0.07);
        ctx.quadraticCurveTo(cx - r * 0.11, ny + r * 0.2, cx - r * 0.18, ny + r * 0.1);
        ctx.moveTo(cx, ny + r * 0.07);
        ctx.quadraticCurveTo(cx + r * 0.11, ny + r * 0.2, cx + r * 0.18, ny + r * 0.1);
        ctx.stroke();
        if (def.type === 'cat') {
          ctx.lineWidth = r * 0.02;
          [-1, 1].forEach(s => {
            for (let i = 0; i < 2; i++) {
              ctx.beginPath();
              ctx.moveTo(cx + s * r * 0.24, ny + i * r * 0.08 - r * 0.02);
              ctx.lineTo(cx + s * r * 0.62, ny + i * r * 0.12 - r * 0.06);
              ctx.stroke();
            }
          });
        }
        ctx.lineCap = 'butt';
      }
    }
  }

  // 폭탄 PANG — 검은 구 + 심지 + 화난 얼굴 + 작은 발
  _drawBomb(ctx, def, S, st) {
    const R = S * 0.36;
    const cy = -S * 0.42;

    ctx.save();
    ctx.globalAlpha = 0.2; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(0, 0, S * 0.28, S * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 작은 발
    ctx.fillStyle = def.body; ctx.strokeStyle = def.detail; ctx.lineWidth = S * 0.016;
    const swing = st.moving ? Math.sin(st.walk) * S * 0.04 : 0;
    this._ellipse(ctx, -S * 0.11 + swing, -S * 0.01, S * 0.07, S * 0.045); ctx.fill(); ctx.stroke();
    this._ellipse(ctx, S * 0.11 - swing, -S * 0.01, S * 0.07, S * 0.045); ctx.fill(); ctx.stroke();

    // 작은 팔
    this._arm(ctx, -R * 0.85, cy + R * 0.1, -st.arms, S, def);
    this._arm(ctx, R * 0.85, cy + R * 0.1, st.arms, S, def);

    // 본체
    ctx.fillStyle = def.body; ctx.strokeStyle = def.detail; ctx.lineWidth = S * 0.02;
    ctx.beginPath(); ctx.arc(0, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    this._ellipse(ctx, -R * 0.35, cy - R * 0.4, R * 0.22, R * 0.3, -0.5); ctx.fill();

    // 심지 (금속 캡 + 곡선)
    ctx.fillStyle = '#9aa1ad';
    ctx.fillRect(-R * 0.2, cy - R * 1.12, R * 0.4, R * 0.16);
    ctx.strokeStyle = '#6b5233'; ctx.lineWidth = R * 0.1; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, cy - R * 1.1);
    ctx.quadraticCurveTo(R * 0.5, cy - R * 1.5, R * 0.2, cy - R * 1.7);
    ctx.stroke();
    // 불꽃 (깜빡)
    const flick = 0.8 + 0.4 * Math.abs(Math.sin(st.walk * 3));
    ctx.fillStyle = def.accent || '#ffcf33';
    this._sparkle(ctx, R * 0.22, cy - R * 1.75, R * 0.2 * flick);
    ctx.fillStyle = '#ff7a1a';
    this._sparkle(ctx, R * 0.22, cy - R * 1.75, R * 0.11 * flick);

    // 화난 얼굴
    if (st.eyeState === 'x') { this._eyes(ctx, 0, cy, R * 0.9, 'x', def); }
    else {
      const ex = R * 0.28, ey = cy - R * 0.02, er = R * 0.14;
      [-1, 1].forEach(s => {
        const bx = 0 + s * ex;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(bx, ey, er * 0.95, er * 1.15, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a1f2b';
        ctx.beginPath(); ctx.arc(bx, ey + er * 0.25, er * 0.55, 0, Math.PI * 2); ctx.fill();
      });
      // 화난 눈썹
      ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.09; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-ex - er, ey - er * 1.3); ctx.lineTo(-ex + er * 0.7, ey - er * 0.3);
      ctx.moveTo(ex + er, ey - er * 1.3); ctx.lineTo(ex - er * 0.7, ey - er * 0.3);
      ctx.stroke(); ctx.lineCap = 'butt';
      // 입
      ctx.strokeStyle = '#fff'; ctx.lineWidth = R * 0.05;
      ctx.beginPath(); ctx.arc(0, cy + R * 0.4, R * 0.18, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
  }

  // ---------- 헬퍼 ----------
  _ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  }

  _sparkle(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
      const a2 = a + Math.PI / 4;
      ctx.lineTo(Math.cos(a2) * s * 0.35, Math.sin(a2) * s * 0.35);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
