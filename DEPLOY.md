# Cloudflare Pages 배포 가이드

## 방법 A — CLI로 직접 배포 (가장 확실, 권장)

대시보드 빌드설정과 무관하게 이미 만들어진 정적 결과물(`out/`)과 Function(`functions/`)을 그대로 업로드합니다.

```bash
cd wemix_tower_run
npx wrangler login          # 최초 1회, 브라우저에서 인증
npm run deploy              # = next build && wrangler pages deploy out --project-name=wemix-tower-run
```

배포가 끝나면 출력되는 URL(또는 https://wemix-tower-run.pages.dev/)에서 게임이 뜹니다.

### 온라인 랭킹(KV) 켜기
```bash
npx wrangler kv namespace create SCORES
```
출력된 id를 `wrangler.toml`의 `[[kv_namespaces]]` 에 넣고 다시 `npm run deploy`.
(또는 대시보드 → Pages 프로젝트 → Settings → Bindings → KV, Variable name `SCORES`)

KV를 안 붙여도 게임은 정상 플레이되며 랭킹만 오프라인(로컬)으로 표시됩니다.

---

## 방법 B — GitHub 연동 자동 빌드

Cloudflare Pages 프로젝트가 이 저장소에 연결돼 있다면, Settings에서:

- Build command: `npm run build`
- Build output directory: `out`
- (빌드 실패 시) 환경변수 `NODE_VERSION=20`

설정 후 **Retry deployment**. 그 다음 KV 바인딩(위와 동일)을 추가.

> 404가 계속 났다면 대개 프로젝트가 Git 빌드로 연결돼 있지 않거나(Direct Upload), output 디렉터리가 `out`이 아니기 때문입니다. 방법 A가 이를 우회합니다.

---

## 로컬에서 Cloudflare 런타임 미리보기
```bash
npm run cf:preview   # wrangler pages dev + 로컬 KV
```
