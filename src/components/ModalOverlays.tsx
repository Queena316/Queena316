import { GameHudStats } from '../game/types';

interface PauseModalProps {
  stats: GameHudStats;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function PauseModal({
  stats,
  onResume,
  onRestart,
  onQuitToTitle,
}: PauseModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#0F172A]/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-title"
    >
      <div className="w-full max-w-[330px] rounded-2xl border border-[#DFD2BD] bg-[#FFFDF8] p-6 shadow-[0_18px_48px_rgba(15,23,42,0.28)]">
        <h2
          id="pause-title"
          className="font-display text-center text-2xl font-extrabold text-[#0F172A]"
        >
          遊戲暫停
        </h2>
        <p className="mt-1 text-center text-xs font-medium text-[#64748B] tabular-nums">
          目前 {stats.score} 層 · 最高紀錄 {stats.bestScore} 層
        </p>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#B45309] px-5 font-display text-base font-bold text-white transition-transform duration-150 hover:bg-[#92400E] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            繼續遊戲
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="flex h-11 w-full items-center justify-center rounded-xl border border-[#DFD2BD] bg-white px-5 text-sm font-bold text-[#1E293B] transition-colors duration-150 hover:bg-[#FEF6E6] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            重新開始
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold text-[#64748B] transition-colors duration-150 hover:bg-[#FEF6E6] hover:text-[#0F172A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            回到主畫面
          </button>
        </div>
      </div>
    </div>
  );
}

interface GameOverModalProps {
  stats: GameHudStats;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function GameOverModal({
  stats,
  onRestart,
  onQuitToTitle,
}: GameOverModalProps) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#0F172A]/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gameover-title"
    >
      <div className="w-full max-w-[340px] rounded-2xl border border-[#DFD2BD] bg-[#FFFDF8] p-6 shadow-[0_18px_48px_rgba(15,23,42,0.3)]">
        <div className="text-center">
          {stats.isNewBest && stats.score > 0 ? (
            <p className="text-xs font-bold tracking-wide text-[#B45309]">
              刷新個人最高紀錄
            </p>
          ) : (
            <p className="text-xs font-semibold text-[#64748B]">挑戰結束</p>
          )}

          <h2
            id="gameover-title"
            className="font-display mt-1 text-2xl font-extrabold text-[#0F172A]"
          >
            金磚塔完成！
          </h2>
        </div>

        {/* Clean numerical summary */}
        <div className="mt-4 flex flex-col items-center border-y border-[#ECE4D6] py-4">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-5xl font-extrabold tracking-tight text-[#B45309] tabular-nums">
              {stats.score}
            </span>
            <span className="text-base font-bold text-[#334155]">層</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-[#475569] tabular-nums">
            <span>最高紀錄 {stats.bestScore} 層</span>
            <span aria-hidden="true">·</span>
            <span>完美對齊 {stats.perfectCount} 次</span>
            <span aria-hidden="true">·</span>
            <span>最佳連擊 ×{stats.maxCombo}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onRestart}
            className="flex h-12 w-full items-center justify-center rounded-xl bg-[#B45309] px-5 font-display text-base font-bold text-white shadow-sm transition-transform duration-150 hover:bg-[#92400E] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            再玩一次
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="flex h-11 w-full items-center justify-center rounded-xl border border-[#DFD2BD] bg-white px-5 text-sm font-bold text-[#1E293B] transition-colors duration-150 hover:bg-[#FEF6E6] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            回到主畫面
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-[#64748B]">
          按 Enter 或 Space 快速再玩一局
        </p>
      </div>
    </div>
  );
}
