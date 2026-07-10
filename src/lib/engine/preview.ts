/* eslint-disable */
// @ts-nocheck
/* ============================================================
   캐릭터 미리보기 헬퍼
   - 타이틀/선택 화면의 미니 캔버스에 캐릭터를 그린다.
   - 엔진과 무관하게 독립 인스턴스를 사용.
   ============================================================ */
import { AssetManager } from './assets';
import { CharacterManager } from './character';

let _assets: any = null;
let _charMgr: any = null;

function mgr() {
  if (!_assets) { _assets = new AssetManager(); _charMgr = new CharacterManager(_assets); }
  return { assets: _assets, charMgr: _charMgr };
}

export function getCharacters() {
  return mgr().assets.characters;
}

// canvas에 캐릭터 1명을 그린다. frame(선택)으로 걷기 위상 지정.
export function drawCharacterPreview(canvas, charId, frame = 0, balance = 0, moving = false) {
  const { assets, charMgr } = mgr();
  const def = assets.getCharacter(charId);
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  charMgr.walkPhase = frame;
  const size = Math.min(W, H) * 0.92;
  charMgr.draw(ctx, def, W / 2, H - H * 0.06, size, { moving, balance });
}
