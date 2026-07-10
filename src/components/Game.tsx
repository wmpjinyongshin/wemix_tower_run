"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine } from "@/lib/engine/engine";
import { getCharacters, drawCharacterPreview } from "@/lib/engine/preview";

type Snapshot = {
  scene: string;
  nickname: string;
  selectedCharId: string;
  soundOn: boolean;
  hud: { time: number; distance: number; speed: number; combo: number; zone: string };
  ranking: { board: any[]; myRank: number; online: boolean; empty: boolean; rankChanged?: boolean };
  gameover: any | null;
};

const INITIAL: Snapshot = {
  scene: "nickname",
  nickname: "PLAYER",
  selectedCharId: "mao",
  soundOn: true,
  hud: { time: 0, distance: 0, speed: 0, combo: 0, zone: "WEMIX TOWER · 외부" },
  ranking: { board: [], myRank: 1, online: false, empty: true },
  gameover: null,
};

function Logo() {
  return (
    <div className="logo-badge text-[clamp(13px,1.7vw,20px)]">
      WEMADE <span className="lp">PLAY</span>
    </div>
  );
}

/* 캐릭터 미리보기 캔버스 */
function CharPreview({ charId, size = 130, animated = false, className = "" }: { charId: string; size?: number; animated?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    let raf = 0;
    let frame = 0;
    const render = () => {
      drawCharacterPreview(cv, charId, frame, animated ? Math.sin(frame * 0.7) * 0.14 : 0, animated);
      if (animated) { frame += 0.06; raf = requestAnimationFrame(render); }
    };
    render();
    return () => { if (raf) cancelAnimationFrame(raf); };
  }, [charId, animated]);
  return <canvas ref={ref} width={size} height={Math.round(size * 1.1)} className={className} />;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<any>(null);
  const [s, setS] = useState<Snapshot>(INITIAL);
  const [nick, setNick] = useState("");
  const [pending, setPending] = useState("mao"); // 선택 화면 임시 선택
  const chars = getCharacters();

  useEffect(() => {
    const canvas = canvasRef.current!;
    const engine = new GameEngine(canvas, (snap: Snapshot) => setS(snap));
    engineRef.current = engine;
    engine.start();
    return () => engine.destroy();
  }, []);

  const eng = () => engineRef.current;

  // ---- 핸들러 ----
  const onNickStart = () => { eng()?.setNickname(nick.trim() || "PLAYER"); eng()?.sound?.sfxButton?.(); eng()?.goto("title"); };
  const onStart = () => { eng()?.sound?.sfxButton?.(); eng()?.goto("ready"); };
  const onOpenSelect = () => { setPending(s.selectedCharId); eng()?.sound?.sfxButton?.(); eng()?.goto("select"); };
  const onPick = (id: string) => { setPending(id); eng()?.sound?.sfxButton?.(); };
  const onConfirm = () => { eng()?.selectCharacter(pending); eng()?.sound?.sfxButton?.(); eng()?.goto("title"); };
  const onBack = () => { eng()?.sound?.sfxButton?.(); eng()?.goto("title"); };
  const onRetry = () => { eng()?.sound?.sfxButton?.(); eng()?.retry(); };
  const onHome = () => { eng()?.sound?.sfxButton?.(); eng()?.goHome(); };
  const onToggleSound = () => eng()?.toggleSound();
  const press = (dir: number) => eng()?.press(dir);

  const isGameView = s.scene === "ready" || s.scene === "playing" || s.scene === "gameover";
  const fmt = (n: number) => Math.floor(n).toLocaleString();

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_50%_20%,#142a5c_0%,#060913_70%)]">
      <div
        className="relative overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.6)] bg-[#071026]"
        style={{ width: "min(100vw, calc(100vh * 16 / 9))", height: "min(100vh, calc(100vw * 9 / 16))" }}
      >
        <canvas ref={canvasRef} width={1280} height={720} className="absolute inset-0 h-full w-full block" />

        {/* 터치/클릭 입력 존 (ready/playing 시) */}
        {(s.scene === "ready" || s.scene === "playing") && (
          <div className="absolute inset-0 z-10 flex">
            <div className="h-full w-1/2" onPointerDown={(e) => { e.preventDefault(); press(-1); }} />
            <div className="h-full w-1/2" onPointerDown={(e) => { e.preventDefault(); press(1); }} />
          </div>
        )}

        {/* ================= HUD ================= */}
        {isGameView && (
          <div className="pointer-events-none absolute inset-0 z-20">
            {/* 타이머 */}
            <div className="panel absolute left-[2%] top-[2.5%] min-w-[92px] rounded-xl px-4 py-2 text-center">
              <div className="text-[clamp(9px,1vw,12px)] font-bold tracking-widest text-[#9fb4d8]">TIME</div>
              <div className="text-[clamp(20px,3vw,34px)] font-black tabular-nums text-[var(--gold)]">{s.hud.time.toFixed(1)}</div>
            </div>

            {/* 거리 */}
            <div className="absolute left-1/2 top-[2%] flex -translate-x-1/2 items-baseline gap-1.5 drop-shadow-[0_3px_14px_rgba(0,0,0,0.6)]">
              <div className="text-[clamp(34px,6.5vw,74px)] font-black leading-none tabular-nums text-white">{fmt(s.hud.distance)}</div>
              <div className="text-[clamp(16px,2.6vw,30px)] font-extrabold text-[var(--wemix-cyan)]">m</div>
            </div>
            <div className="absolute left-1/2 top-[calc(2%_+_clamp(38px,7vw,78px))] -translate-x-1/2 whitespace-nowrap text-[clamp(12px,1.6vw,18px)] font-bold tracking-wide text-[var(--wemix-cyan)] drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {s.hud.zone}
            </div>

            {/* 랭킹 */}
            <div className="panel absolute right-[2%] top-[2.5%] w-[clamp(150px,17vw,210px)] rounded-xl px-3 py-2.5">
              <div className="mb-2 text-[clamp(11px,1.3vw,15px)] font-extrabold text-[var(--gold)]">
                🏆 실시간 랭킹 <span className="ml-0.5 text-[0.72em] font-bold text-[#9fb4d8]">{s.ranking.online ? "🟢 LIVE" : "⚪ OFFLINE"}</span>
              </div>
              <ul className="space-y-0.5">
                {s.ranking.empty ? (
                  <li className="py-2.5 text-center text-[clamp(10px,1.15vw,13px)] leading-snug text-[#9fb4d8]">아직 기록이 없어요.<br />첫 기록에 도전!</li>
                ) : (
                  s.ranking.board.map((row: any, i: number) => (
                    <li key={row.clientId ?? i} className={`flex items-center gap-1.5 rounded px-1 py-[3px] text-[clamp(10px,1.2vw,14px)] ${row.me ? "bg-gradient-to-r from-[rgba(255,207,51,0.22)] to-transparent" : ""} ${row.me && s.ranking.rankChanged ? "wtr-rankup" : ""}`}>
                      <span className="w-5 flex-shrink-0 text-center font-extrabold text-[#9fb4d8]">{row.rank}</span>
                      <span className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${row.me ? "font-extrabold text-[var(--gold)]" : ""}`}>{row.name}</span>
                      <span className="font-extrabold tabular-nums text-[var(--wemix-cyan)]">{(row.dist || 0).toLocaleString()}m</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* 스피드 */}
            <div className="panel absolute bottom-[3%] left-[2%] min-w-[90px] rounded-xl px-3.5 py-2 text-center">
              <div className="text-[clamp(9px,1vw,12px)] font-bold tracking-widest text-[#9fb4d8]">SPEED</div>
              <div className="text-[clamp(16px,2.2vw,24px)] font-black tabular-nums text-[var(--wemix-cyan)]">
                {s.hud.speed.toFixed(1)}<span className="ml-0.5 text-[0.55em] text-[#9fb4d8]">m/s</span>
              </div>
            </div>

            {/* 콤보 */}
            {s.hud.combo > 0 && (
              <div className="absolute bottom-[3%] right-[2%] min-w-[110px] rounded-xl border border-[var(--perfect)] bg-[linear-gradient(135deg,rgba(53,240,160,0.25),rgba(10,20,45,0.82))] px-4 py-2 text-center">
                <div className="text-[clamp(9px,1vw,12px)] font-bold tracking-widest text-[#9fb4d8]">PERFECT COMBO</div>
                <div className="text-[clamp(22px,3.4vw,40px)] font-black tabular-nums text-[var(--perfect)] drop-shadow-[0_0_14px_rgba(53,240,160,0.7)]">{s.hud.combo}</div>
              </div>
            )}

            {/* 시작 안내 */}
            {s.scene === "ready" && (
              <div className="wtr-float absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="mb-3">
                  <span className="mx-1.5 inline-block rounded-xl border-2 border-[var(--wemix-cyan)] bg-[rgba(10,20,45,0.82)] px-5 py-2.5 text-[clamp(24px,4vw,46px)] font-black text-white shadow-[0_6px_20px_rgba(34,211,238,0.4)]">←</span>
                  <span className="mx-1.5 inline-block rounded-xl border-2 border-[var(--wemix-cyan)] bg-[rgba(10,20,45,0.82)] px-5 py-2.5 text-[clamp(24px,4vw,46px)] font-black text-white shadow-[0_6px_20px_rgba(34,211,238,0.4)]">→</span>
                </div>
                <div className="text-[clamp(16px,2.4vw,28px)] font-extrabold text-white drop-shadow-[0_3px_14px_rgba(0,0,0,0.7)]">방향키를 번갈아 눌러 시작하세요!</div>
              </div>
            )}
          </div>
        )}

        {/* ================= 닉네임 ================= */}
        {s.scene === "nickname" && (
          <div className="wtr-fade absolute inset-0 z-30 flex items-center justify-center p-[3%]">
            <div className="panel w-4/5 max-w-[520px] rounded-[20px] px-[5%] py-[4%] text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              <Logo />
              <h1 className="text-grad-cyan mt-1 mb-1 text-[clamp(22px,3.4vw,40px)] font-black">WEMIX TOWER RUN</h1>
              <p className="mb-4 text-[clamp(12px,1.5vw,16px)] text-[#9fb4d8]">플레이어 닉네임을 입력하세요</p>
              <input
                value={nick}
                onChange={(e) => setNick(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") onNickStart(); }}
                maxLength={10}
                placeholder="닉네임 (최대 10자)"
                className="mb-4 w-full rounded-xl border-2 border-[rgba(88,160,255,0.35)] bg-white/5 px-4 py-3.5 text-center text-[clamp(15px,2vw,20px)] text-white outline-none focus:border-[var(--wemix-cyan)]"
              />
              <button onClick={onNickStart} className="btn btn-primary px-7 py-3 text-[clamp(14px,1.8vw,18px)]">START</button>
              <p className="mt-4 text-[clamp(11px,1.3vw,14px)] text-[#9fb4d8]">← → 키만으로 즐기는 밸런스 러닝 게임</p>
            </div>
          </div>
        )}

        {/* ================= 타이틀 ================= */}
        {s.scene === "title" && (
          <div className="wtr-fade absolute inset-0 z-30 flex items-center justify-center p-[3%] text-center">
            <div>
              <Logo />
              <h1 className="text-[clamp(38px,8vw,96px)] font-black leading-[0.95] tracking-wide text-white drop-shadow-[0_6px_30px_rgba(34,211,238,0.5)]">
                WEMIX<br /><span className="text-grad-gold">TOWER RUN</span>
              </h1>
              <div className="mt-2.5 text-[clamp(14px,2vw,22px)] font-bold tracking-[6px] text-[var(--wemix-cyan)]">— BALANCE CHALLENGE —</div>
              <div className="my-3.5 flex h-[clamp(70px,12vh,130px)] items-end justify-center">
                <CharPreview charId={s.selectedCharId} animated size={120} className="h-full w-auto" />
              </div>
              <div className="flex flex-wrap justify-center gap-3.5">
                <button onClick={onStart} className="btn btn-primary px-10 py-4 text-[clamp(16px,2.2vw,22px)]">▶ START</button>
                <button onClick={onOpenSelect} className="btn btn-ghost px-6 py-3 text-[clamp(14px,1.8vw,18px)]">캐릭터 선택</button>
              </div>
              <div className="mt-4 text-[clamp(13px,1.7vw,18px)] font-bold text-[var(--gold)]">{s.nickname} 님, 위믹스 타워에 오신 걸 환영합니다!</div>
            </div>
          </div>
        )}

        {/* ================= 캐릭터 선택 ================= */}
        {s.scene === "select" && (
          <div className="wtr-fade absolute inset-0 z-30 flex items-center justify-center p-[3%]">
            <div className="w-[96%] max-w-[1120px] text-center">
              <h2 className="text-[clamp(22px,3.2vw,38px)] font-black">캐릭터 선택</h2>
              <p className="mb-3.5 text-[clamp(12px,1.5vw,16px)] text-[#9fb4d8]">애니팡 프렌즈와 함께 타워를 오르세요!</p>
              <div className="mb-3.5 flex flex-wrap justify-center gap-[1.2%]">
                {chars.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => onPick(c.id)}
                    className={`panel w-[10.2%] min-w-[84px] rounded-2xl px-[5px] py-2.5 transition-transform hover:-translate-y-1.5 ${pending === c.id ? "!border-[var(--wemix-cyan)] shadow-[0_0_0_3px_rgba(34,211,238,0.4),0_12px_30px_rgba(34,211,238,0.3)] -translate-y-1.5" : ""}`}
                  >
                    <CharPreview charId={c.id} size={110} className="mx-auto block h-auto w-full" />
                    <div className="mt-1.5 text-[clamp(13px,1.5vw,17px)] font-extrabold">{c.name}</div>
                    <div className="text-[clamp(10px,1.1vw,12px)] text-[#9fb4d8]">{c.desc}</div>
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-3.5">
                <button onClick={onConfirm} className="btn btn-primary px-7 py-3">이 캐릭터로 결정</button>
                <button onClick={onBack} className="btn btn-ghost px-6 py-3">뒤로</button>
              </div>
            </div>
          </div>
        )}

        {/* ================= 게임오버 ================= */}
        {s.scene === "gameover" && s.gameover && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(3,6,14,0.55)] p-[3%] backdrop-blur-[2px]">
            <div className="wtr-pop panel w-[84%] max-w-[560px] rounded-[22px] px-[5%] py-[3%] text-center shadow-[0_24px_70px_rgba(0,0,0,0.6)]">
              <h1 className="text-grad-red mb-4 text-[clamp(34px,6vw,64px)] font-black tracking-widest">
                {s.gameover.reason === "time" ? "TIME UP!" : "GAME OVER"}
              </h1>
              <div className="mb-3.5 flex justify-center gap-[5%]">
                <div className="flex-1">
                  <div className="text-[clamp(11px,1.4vw,15px)] font-bold tracking-widest text-[#9fb4d8]">DISTANCE</div>
                  <div className="text-[clamp(28px,5vw,52px)] font-black text-white">{fmt(s.gameover.distance)}m</div>
                </div>
                <div className="flex-1">
                  <div className="text-[clamp(11px,1.4vw,15px)] font-bold tracking-widest text-[#9fb4d8]">BEST</div>
                  <div className="text-[clamp(28px,5vw,52px)] font-black text-[var(--gold)]">{fmt(s.gameover.best)}m</div>
                </div>
              </div>
              <div className="mb-2 text-[clamp(14px,1.9vw,20px)] font-bold text-[var(--wemix-cyan)]">
                {s.gameover.online ? `🌐 온라인 랭킹 ${s.gameover.rank}위` : "오프라인 (기록 저장됨)"}
              </div>
              {s.gameover.isRecord && (
                <div className="wtr-pulse mb-3 text-[clamp(18px,2.6vw,28px)] font-black text-[var(--gold)] drop-shadow-[0_0_18px_rgba(255,207,51,0.7)]">🎉 NEW RECORD! 🎉</div>
              )}
              <div className="flex justify-center gap-3.5">
                <button onClick={onRetry} className="btn btn-primary px-10 py-4 text-[clamp(16px,2.2vw,22px)]">🔄 RETRY</button>
                <button onClick={onHome} className="btn btn-ghost px-6 py-3">타이틀로</button>
              </div>
              <div className="mt-4"><Logo /></div>
            </div>
          </div>
        )}

        {/* 사운드 토글 */}
        <button
          onClick={onToggleSound}
          className="panel absolute bottom-[2%] left-1/2 z-40 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full text-lg hover:bg-white/15"
          title="사운드 켜기/끄기"
        >
          {s.soundOn ? "🔊" : "🔇"}
        </button>
      </div>
    </div>
  );
}
