/* ============================================================
   InputManager
   - 키보드(← →)와 터치/클릭(화면 좌우 절반)을 통합 관리.
   - 콜백 방식으로 GameManager에 방향 입력을 전달한다.
   ============================================================ */
class InputManager {
  constructor(stageEl) {
    this.stageEl = stageEl;
    this.onDirection = null; // (dir) => {}  dir: -1(left) | 1(right)
    this.enabled = false;
    this._bind();
  }

  enable() { this.enabled = true; }
  disable() { this.enabled = false; }

  _emit(dir) {
    if (this.enabled && this.onDirection) this.onDirection(dir);
  }

  _bind() {
    // 키보드
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return; // 꾹 누름 반복 방지 → 실제 "탭" 리듬 유지
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        this._emit(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        this._emit(1);
      }
    }, { passive: false });

    // 터치 / 마우스 (모바일·태블릿 대응): 화면 좌우 절반 탭
    const handlePointer = (clientX) => {
      const rect = this.stageEl.getBoundingClientRect();
      const rel = (clientX - rect.left) / rect.width;
      this._emit(rel < 0.5 ? -1 : 1);
    };

    this.stageEl.addEventListener('touchstart', (e) => {
      // 스크린(오버레이 UI) 위에서는 무시 — 버튼/입력창 클릭 보호
      if (this._overUI(e.target)) return;
      if (e.cancelable) e.preventDefault();
      for (const t of e.changedTouches) handlePointer(t.clientX);
    }, { passive: false });

    this.stageEl.addEventListener('mousedown', (e) => {
      if (this._overUI(e.target)) return;
      handlePointer(e.clientX);
    });
  }

  _overUI(target) {
    // 화면(screen) 또는 버튼/입력창 위 클릭이면 게임 입력으로 처리하지 않음.
    return !!(target.closest && (target.closest('.screen') || target.closest('button') || target.closest('input')));
  }
}
