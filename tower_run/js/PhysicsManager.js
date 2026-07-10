/* ============================================================
   PhysicsManager
   - Walk the Stork 스타일 "역진자(inverted pendulum)" 밸런스 물리.
   - balance: -1(뒤/왼쪽) ~ +1(앞/오른쪽), 0 = 완벽한 중심.
   - 중심에서 벗어날수록 더 빨리 기울어지는 불안정 평형 →
     플레이어는 ← → 를 번갈아 눌러 반대 방향으로 밀어 균형 유지.
   - |balance| >= 1 이면 넘어짐(게임오버).
   ============================================================ */
class PhysicsManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.balance = 0;          // 현재 기울기 [-1, 1]
    this.balanceVel = 0;       // 기울기 속도
    this.perfectZone = 0.16;   // Perfect 판정 폭 (중심 기준 ±)
    this.fallen = false;
    this.fallDir = 1;          // 넘어진 방향 (+앞 / -뒤)
    this._noiseSeed = 12.9898; // 결정적 노이즈용 시드
    this._noisePhase = 0;
  }

  // 방향 입력 → 반대쪽으로 교정 임펄스.
  // dir: -1(left) => balance 감소, +1(right) => balance 증가.
  applyInput(dir, strength) {
    if (this.fallen) return;
    this.balanceVel += dir * strength;
  }

  // 결정적 유사난수 노이즈(-1~1). Math.random 미사용(재현성/일관성).
  _noise() {
    this._noisePhase += 0.137;
    const s = Math.sin(this._noisePhase * this._noiseSeed) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  }

  /*
    한 프레임 물리 갱신.
    params:
      dt          : 델타타임(초)
      instability : 불안정도(난이도에 따라 증가) — 클수록 빨리 기움
      noiseAmp    : 외란(바람/흔들림) 세기 — 난이도에 따라 증가
  */
  update(dt, instability, noiseAmp) {
    if (this.fallen) return;

    // 불안정 평형: 기운 만큼 가속(중심에서 멀수록 강함)
    this.balanceVel += this.balance * instability * dt;

    // 외란 노이즈 (지속적 미세 흔들림)
    this.balanceVel += this._noise() * noiseAmp * dt;

    // 감쇠 (과도한 진동 억제 → 조작 가능성 확보)
    this.balanceVel *= Math.pow(0.985, dt * 60);

    // 적분
    this.balance += this.balanceVel * dt;

    // 넘어짐 판정
    if (this.balance >= 1) { this.balance = 1; this.fallen = true; this.fallDir = 1; }
    else if (this.balance <= -1) { this.balance = -1; this.fallen = true; this.fallDir = -1; }
  }

  isPerfect() {
    return !this.fallen && Math.abs(this.balance) < this.perfectZone;
  }

  // 균형 안정도(0~1): 1이면 완벽 중심, 0이면 넘어지기 직전.
  stability() {
    return 1 - Math.min(1, Math.abs(this.balance));
  }
}
