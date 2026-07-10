/* ============================================================
   AssetManager
   - 게임 전역에서 쓰는 데이터형 애셋(색상 팔레트, 캐릭터 정의,
     스테이지/테마 정의)을 관리한다. 모든 그래픽은 canvas로
     절차적으로 그리므로 외부 이미지 파일이 없다.
   ============================================================ */
class AssetManager {
  constructor() {
    // ---- 애니팡 프렌즈 캐릭터 정의 (원작 캐릭터 참고) ----
    // 색: body(몸), belly(배/얼굴 밝은부분), ear/earInner(귀), detail(외곽선/진한색),
    //     face(얼굴 패치/주둥이), cheek(볼), paw(손발), accent(포인트).
    this.characters = [
      { id: 'mao',    name: 'MAO',    desc: '듬직한 판다', type: 'panda',
        body: '#20264a', belly: '#ffffff', ear: '#1a2044', detail: '#12162f',
        face: '#ffffff', cheek: '#f6a8b6', accent: '#f5c542' },
      { id: 'pinky',  name: 'PINKY',  desc: '깜찍한 돼지', type: 'pig',
        body: '#f2a0be', belly: '#ffc9dd', ear: '#f2a0be', detail: '#d76e93',
        face: '#ef8fb2', cheek: '#ffb45c' },
      { id: 'ani',    name: 'ANI',    desc: '폭신한 토끼', type: 'rabbit',
        body: '#f8d6e2', belly: '#ffffff', ear: '#f8d6e2', earInner: '#f4a6c0',
        detail: '#dca7ba', cheek: '#ffadc6' },
      { id: 'blue',   name: 'BLUE',   desc: '용감한 강아지', type: 'dog',
        body: '#4fb3e6', belly: '#dff2fb', ear: '#2f8fcc', detail: '#2b7aa8',
        face: '#ffffff', cheek: '#ffb454', paw: '#f5b942' },
      { id: 'mongyi', name: 'MONGYI', desc: '장난꾸러기 원숭이', type: 'monkey',
        body: '#7d5233', belly: '#e6bd8c', ear: '#7d5233', detail: '#5a3a20',
        face: '#e6bd8c', cheek: '#e8907e' },
      { id: 'lucy',   name: 'LUCY',   desc: '도도한 고양이', type: 'cat',
        body: '#a8aeb8', belly: '#f2f4f7', ear: '#a8aeb8', earInner: '#f4a6c0',
        detail: '#727986', face: '#f2f4f7', stripe: '#878e9b', cheek: '#ffadc0', nose: '#e78ba0' },
      { id: 'micky',  name: 'MICKY',  desc: '엉뚱한 곰돌이', type: 'bear',
        body: '#8ec63f', belly: '#c8e88e', ear: '#8ec63f', earInner: '#c8e88e',
        detail: '#5f8f22', face: '#c8e88e', cheek: '#ffb0c0' },
      { id: 'pang',   name: 'PANG',   desc: '터프한 폭탄', type: 'bomb',
        body: '#20202a', belly: null, ear: null, detail: '#000000', accent: '#ffcf33' },
      { id: 'ari',    name: 'ARI',    desc: '노란 병아리', type: 'chick',
        body: '#ffd83b', belly: '#ffe98a', ear: '#f0b400', detail: '#e6a800',
        cheek: '#ffb09a', paw: '#ff9f1c' },
    ];

    // ---- 거리(m)별 테마 정의 ----
    // 각 테마는 시작 거리(from), 이름, 하늘/바닥 색, 무드를 가진다.
    // 하나의 거대한 월드로 자연스럽게 이어지도록 색상은 보간된다.
    this.themes = [
      { from: 0,     name: 'WEMIX TOWER · 외부',   sky: ['#7fc4ff', '#cdeaff'], ground: '#3a4a63', accent: '#1652f0', kind: 'exterior' },
      { from: 100,   name: 'B4 · 지하주차장',       sky: ['#2a3142', '#3b4358'], ground: '#22262f', accent: '#ffcf33', kind: 'parking' },
      { from: 250,   name: 'B3 · 기계실',           sky: ['#3a2b2b', '#52413a'], ground: '#2b2320', accent: '#ff7a1a', kind: 'machine' },
      { from: 400,   name: 'B2 · 구내식당',         sky: ['#4a3b2f', '#6b5440'], ground: '#3a2c22', accent: '#ffb454', kind: 'cafeteria' },
      { from: 600,   name: 'B1 · 지하 복도',        sky: ['#2f3550', '#454d70'], ground: '#262b40', accent: '#58a0ff', kind: 'corridor' },
      { from: 800,   name: '1F · 로비',             sky: ['#dfeeff', '#ffffff'], ground: '#c9d6e8', accent: '#1652f0', kind: 'lobby' },
      { from: 1000,  name: '2F · 사무실',           sky: ['#eaf1ff', '#ffffff'], ground: '#d3ddf0', accent: '#22d3ee', kind: 'office' },
      { from: 1300,  name: '3F · 개발실',           sky: ['#e6eeff', '#fbfdff'], ground: '#ccd8f0', accent: '#7c5cff', kind: 'dev' },
      { from: 1600,  name: '4F · 회의실 & 휴게실',  sky: ['#eef2ff', '#ffffff'], ground: '#d0dbf0', accent: '#35f0a0', kind: 'meeting' },
      { from: 2500,  name: '10F · 스튜디오',        sky: ['#ffeef6', '#fff7fb'], ground: '#e6d3e0', accent: '#ff5a9e', kind: 'studio' },
      { from: 3200,  name: '옥상',                  sky: ['#4a7bd0', '#a9d4ff'], ground: '#5a6b86', accent: '#ffcf33', kind: 'rooftop' },
      { from: 4000,  name: '하늘',                  sky: ['#3a6fd8', '#bfe0ff'], ground: '#ffffff', accent: '#ffffff', kind: 'sky' },
      { from: 5000,  name: '우주',                  sky: ['#050818', '#12173a'], ground: '#0a0f26', accent: '#22d3ee', kind: 'space' },
      { from: 6500,  name: '은하',                  sky: ['#14032a', '#3a0a5c'], ground: '#1a0730', accent: '#c96bff', kind: 'galaxy' },
      { from: 8000,  name: 'AI WORLD',              sky: ['#001a1a', '#00363a'], ground: '#002a2a', accent: '#35f0a0', kind: 'aiworld' },
      { from: 10000, name: 'DIGITAL WORLD',         sky: ['#001028', '#002a55'], ground: '#001a3a', accent: '#22d3ee', kind: 'digital' },
      { from: 12000, name: 'PIXEL WORLD',           sky: ['#1a0030', '#3a0060'], ground: '#12002a', accent: '#ff5a9e', kind: 'pixel' },
      { from: 15000, name: '???  미지의 공간',      sky: ['#000000', '#1a0033'], ground: '#080012', accent: '#ffcf33', kind: 'void' },
    ];
  }

  getCharacter(id) {
    return this.characters.find(c => c.id === id) || this.characters[0];
  }

  // 주어진 거리에 해당하는 현재 테마와 다음 테마, 진행도(0~1)를 반환.
  getThemeState(distance) {
    let idx = 0;
    for (let i = 0; i < this.themes.length; i++) {
      if (distance >= this.themes[i].from) idx = i;
    }
    const cur = this.themes[idx];
    const next = this.themes[Math.min(idx + 1, this.themes.length - 1)];
    let t = 0;
    if (next !== cur) {
      t = (distance - cur.from) / (next.from - cur.from);
      t = Math.max(0, Math.min(1, t));
    }
    return { cur, next, t, idx };
  }

  // 두 hex 색을 t(0~1)로 선형 보간.
  static lerpColor(a, b, t) {
    const pa = AssetManager.hexToRgb(a), pb = AssetManager.hexToRgb(b);
    const r = Math.round(pa.r + (pb.r - pa.r) * t);
    const g = Math.round(pa.g + (pb.g - pa.g) * t);
    const bl = Math.round(pa.b + (pb.b - pa.b) * t);
    return `rgb(${r},${g},${bl})`;
  }

  static hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16),
    };
  }
}
