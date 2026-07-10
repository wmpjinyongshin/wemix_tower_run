/* ============================================================
   main.js — 부트스트랩
   - DOM 로드 후 GameManager를 생성하고 게임을 시작한다.
   ============================================================ */
(function () {
  function boot() {
    const canvas = document.getElementById('game-canvas');
    const game = new GameManager(canvas);
    window.__WEMIX_GAME = game; // 디버그 접근용
    game.start();

    // 닉네임 입력창 자동 포커스
    const input = document.getElementById('nickname-input');
    if (input) setTimeout(() => input.focus(), 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
