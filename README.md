# WEMIX TOWER RUN — Balance Challenge

위메이드플레이 · 애니팡 프렌즈와 함께하는 밸런스 러너. **Next.js 16 + React 19 + Tailwind CSS v4**로 제작.

Walk the Stork 스타일의 끊김 없는 횡스크롤 밸런스 게임. ← → 를 번갈아 눌러 균형을 잡으며 최대한 멀리 갑니다. 시간 제한 없이 넘어질 때까지 플레이하고, 기록은 온라인 실시간 랭킹으로 공유됩니다.

## 실행

```bash
npm install
npm run dev      # http://localhost:3000
```

프로덕션:

```bash
npm run build
npm run start
```

## 구조

```
src/
  app/
    page.tsx              # 메인 페이지
    layout.tsx            # 루트 레이아웃/메타데이터
    globals.css           # Tailwind + 커스텀 스타일/애니메이션
    api/scores/route.ts   # 온라인 랭킹 API (GET/POST, 파일 영속)
  components/
    Game.tsx              # 캔버스 + HUD + 화면(닉네임/타이틀/선택/게임오버)
  lib/engine/
    engine.ts             # 게임 루프·상태를 React로 전달하는 엔진
    assets.ts             # 캐릭터·테마 정의
    physics.ts            # 역진자 밸런스 물리
    character.ts          # 애니팡 프렌즈 9종 절차적 렌더링
    stage.ts              # 패럴랙스 배경·거리별 테마
    sound.ts              # WebAudio 절차적 BGM/효과음
    ranking.ts            # 온라인 랭킹 클라이언트
    preview.ts            # 캐릭터 미리보기 렌더
```

## 온라인 랭킹

- 플레이 중 1.2초마다 현재 거리를 `/api/scores`에 업로드, 3초마다 상위 목록 조회 → 실시간 갱신.
- 서버는 `clientId`별 최고 거리를 유지(`scores.json` 영속).
- 서버 응답이 없으면 자동으로 오프라인(로컬 기록) 모드로 폴백.

## 배포

Node 런타임을 지원하는 플랫폼(Vercel, Render, Railway 등)에 배포하면 랭킹 API가 그대로 동작합니다.
(GitHub Pages 같은 정적 호스팅은 API가 실행되지 않아 오프라인 랭킹으로 동작합니다.)
