/* ============================================================
   SceneManager
   - 게임 흐름 상태 머신을 관리:
     NICKNAME → TITLE → SELECT → READY → PLAYING → GAMEOVER
   - 각 스크린의 버튼 이벤트를 GameManager에 연결한다.
   ============================================================ */
const SCENE = {
  NICKNAME: 'nickname',
  TITLE: 'title',
  SELECT: 'select',
  READY: 'ready',     // 게임 화면이지만 첫 입력 대기 중
  PLAYING: 'playing',
  GAMEOVER: 'gameover',
};

class SceneManager {
  constructor(game) {
    this.game = game;
    this.state = SCENE.NICKNAME;
    this._bindUI();
  }

  is(s) { return this.state === s; }

  goto(state) {
    this.state = state;
    const ui = this.game.ui;
    switch (state) {
      case SCENE.NICKNAME: ui.showScreen('nickname'); break;
      case SCENE.TITLE:
        ui.showScreen('title');
        ui.renderTitlePreview(this.game.getCharacter(), this.game.characterMgr);
        this._updateGreeting();
        break;
      case SCENE.SELECT:
        ui.showScreen('select');
        ui.renderCharGrid(this.game.assets.characters, this.game.selectedCharId,
          this.game.characterMgr, (id) => this._pickChar(id));
        break;
      case SCENE.READY:
        ui.showScreen('game');
        ui.showStartHint(true);
        this.game.enterReady();
        break;
      case SCENE.PLAYING:
        ui.showScreen('game');
        ui.showStartHint(false);
        break;
      case SCENE.GAMEOVER:
        this.game.showGameOverScreen();
        break;
    }
  }

  _updateGreeting() {
    const el = document.getElementById('title-greeting');
    el.textContent = `${this.game.rankingMgr.playerName} 님, 위믹스 타워에 오신 걸 환영합니다!`;
  }

  _pickChar(id) {
    this._pendingCharId = id;
    // 카드 하이라이트 갱신
    this.game.ui.renderCharGrid(this.game.assets.characters, id,
      this.game.characterMgr, (nid) => this._pickChar(nid));
    this.game.sound.sfxButton();
  }

  _bindUI() {
    const g = this.game;
    const byId = (id) => document.getElementById(id);

    // 닉네임 START
    byId('btn-nickname-start').addEventListener('click', () => {
      g.sound.ensure(); g.sound.sfxButton();
      const val = byId('nickname-input').value.trim();
      g.rankingMgr.setPlayer(val || 'PLAYER');
      this.goto(SCENE.TITLE);
    });
    byId('nickname-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') byId('btn-nickname-start').click();
    });

    // 타이틀
    byId('btn-start').addEventListener('click', () => {
      g.sound.ensure(); g.sound.sfxButton();
      this.goto(SCENE.READY);
    });
    byId('btn-select').addEventListener('click', () => {
      g.sound.sfxButton();
      this._pendingCharId = g.selectedCharId;
      this.goto(SCENE.SELECT);
    });

    // 캐릭터 선택
    byId('btn-select-confirm').addEventListener('click', () => {
      g.sound.sfxButton();
      if (this._pendingCharId) g.selectedCharId = this._pendingCharId;
      this.goto(SCENE.TITLE);
    });
    byId('btn-select-back').addEventListener('click', () => {
      g.sound.sfxButton();
      this.goto(SCENE.TITLE);
    });

    // 게임오버
    byId('btn-retry').addEventListener('click', () => {
      g.sound.ensure(); g.sound.sfxButton();
      this.goto(SCENE.READY);
    });
    byId('btn-home').addEventListener('click', () => {
      g.sound.sfxButton();
      g.sound.stopBGM();
      this.goto(SCENE.TITLE);
    });

    // 사운드 토글
    byId('btn-sound').addEventListener('click', () => {
      g.sound.ensure();
      const on = g.sound.toggle();
      byId('btn-sound').textContent = on ? '🔊' : '🔇';
    });
  }
}
