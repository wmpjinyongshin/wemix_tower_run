/* eslint-disable */
// @ts-nocheck
/* ============================================================
   SoundManager
   - WebAudio API로 BGM/효과음을 절차적으로 합성 (외부 파일 없음).
   - 밝고 중독성 있는 BGM 루프 + Perfect/넘어짐/버튼/기록갱신 SFX.
   ============================================================ */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.bgmGain = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
    this.tempo = 132; // BPM
  }

  // 사용자 제스처 후 오디오 컨텍스트 생성/재개 (브라우저 정책).
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.18;
      this.bgmGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.master) this.master.gain.value = this.enabled ? 0.7 : 0;
    return this.enabled;
  }

  // ---- 기본 톤 생성기 ----
  tone(freq, dur, type = 'sine', vol = 0.3, when = 0, dest = null) {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ---- SFX ----
  sfxStep() { this.tone(220, 0.08, 'triangle', 0.12); }

  sfxPerfect(combo = 1) {
    const base = 660 + Math.min(combo, 12) * 22;
    this.tone(base, 0.12, 'sine', 0.28);
    this.tone(base * 1.5, 0.14, 'sine', 0.16, 0.03);
  }

  sfxButton() {
    this.tone(520, 0.07, 'square', 0.18);
    this.tone(780, 0.08, 'square', 0.12, 0.05);
  }

  sfxFall() {
    if (!this.ctx || !this.enabled) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, t0);
    osc.frequency.exponentialRampToValueAtTime(70, t0 + 0.5);
    g.gain.setValueAtTime(0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + 0.6);
  }

  sfxRecord() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => this.tone(n, 0.18, 'triangle', 0.24, i * 0.09));
  }

  // ---- BGM: 밝은 8비트풍 아르페지오 루프 ----
  startBGM() {
    if (!this.ctx || this.bgmTimer) return;
    // C major 계열 밝은 진행 (I - V - vi - IV)
    const scale = {
      C: [523.25, 659.25, 783.99], // C E G
      G: [392.0, 493.88, 587.33],  // G B D
      Am: [440.0, 523.25, 659.25], // A C E
      F: [349.23, 440.0, 523.25],  // F A C
    };
    const prog = ['C', 'C', 'G', 'G', 'Am', 'Am', 'F', 'F'];
    const bassNotes = { C: 130.81, G: 98.0, Am: 110.0, F: 87.31 };
    const stepDur = 60 / this.tempo / 2; // 8분음표
    this.bgmStep = 0;

    const tick = () => {
      if (!this.enabled) { this.bgmStep++; return; }
      const bar = Math.floor(this.bgmStep / 4) % prog.length;
      const chord = prog[bar];
      const arp = scale[chord];
      const noteInBar = this.bgmStep % 4;
      // 아르페지오 멜로디
      const mel = arp[noteInBar % arp.length] * (noteInBar === 3 ? 2 : 1);
      this.tone(mel, stepDur * 0.9, 'square', 0.10, 0, this.bgmGain);
      // 베이스 (박자 처음)
      if (noteInBar === 0) this.tone(bassNotes[chord], stepDur * 3.6, 'triangle', 0.14, 0, this.bgmGain);
      // 하이햇 느낌
      if (noteInBar % 2 === 1) this.tone(60, 0.02, 'square', 0.05, 0, this.bgmGain);
      this.bgmStep++;
    };
    tick();
    this.bgmTimer = setInterval(tick, stepDur * 1000);
  }

  stopBGM() {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  }

  // 속도/난이도에 따라 BGM 템포 살짝 상승 (긴장감).
  setIntensity(level) {
    const newTempo = 132 + Math.min(level, 8) * 6;
    if (Math.abs(newTempo - this.tempo) > 2 && this.bgmTimer) {
      this.tempo = newTempo;
      this.stopBGM();
      this.startBGM();
    }
  }
}
