import { Music, Volume2, VolumeX } from 'lucide-react';

interface TitleOverlayProps {
  bestScore: number;
  isMuted: boolean;
  isBgmEnabled: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onStart: () => void;
}

export function TitleOverlay({
  bestScore,
  isMuted,
  isBgmEnabled,
  onToggleMute,
  onToggleBgm,
  onStart,
}: TitleOverlayProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      {/* Top-right audio toggles */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleBgm}
          aria-label={isBgmEnabled ? '關閉背景音樂' : '開啟背景音樂'}
          title={isBgmEnabled ? '背景音樂：開' : '背景音樂：關'}
          className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309] ${
            isBgmEnabled && !isMuted
              ? 'border-[#D97706] bg-[#FEF3C7] text-[#92400E] hover:bg-[#FDE68A]'
              : 'border-[#D4C7B4] bg-[#FFFDF8] text-[#64748B] hover:bg-[#FEF6E6]'
          }`}
        >
          <Music className="h-5 w-5" />
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onToggleMute}
          aria-label={isMuted ? '開啟音效' : '靜音'}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4C7B4] bg-[#FFFDF8] text-[#1E293B] shadow-sm transition-transform duration-150 hover:bg-[#FEF6E6] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
        >
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Bottom-anchored Bullion Title Card leaving upper pendulum showcase open */}
      <div className="mx-auto w-full max-w-[360px]">
        <div className="pointer-events-auto rounded-2xl border border-[#DFD2BD] bg-[#FFFDF8] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.14)] sm:p-6">
          {/* Bespoke inline SVG Gold Bar Lockup */}
          <div className="flex items-center gap-3.5">
            <svg
              viewBox="0 0 56 56"
              className="h-13 w-13 shrink-0"
              aria-hidden="true"
            >
              <rect x="4" y="4" width="48" height="48" rx="14" fill="#1E293B" />
              <rect x="11" y="42" width="34" height="3.5" rx="1.75" fill="#F59E0B" />
              <rect x="12" y="32.5" width="32" height="8" rx="2" fill="#EAB308" />
              <rect x="12" y="32.5" width="32" height="2.2" rx="1" fill="#FEF08A" />
              <rect x="15" y="23" width="26" height="8" rx="2" fill="#F4C430" />
              <rect x="15" y="23" width="26" height="2.2" rx="1" fill="#FFFBEB" />
              <rect x="18" y="13.5" width="20" height="8" rx="2" fill="#FBBF24" />
              <rect x="18" y="13.5" width="20" height="2.2" rx="1" fill="#FFFFFF" />
              <polygon points="24,13.5 28,13.5 23,40.5 19,40.5" fill="#FFFFFF" opacity="0.28" />
            </svg>

            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-[28px]">
                金條疊疊樂
              </h1>
              <p className="mt-0.5 text-xs font-medium text-[#64748B]">
                精準對齊 · 堆砌金庫最高金磚塔
              </p>
            </div>
          </div>

          {/* Concise rule list */}
          <ol className="mt-4 space-y-1.5 border-t border-[#ECE4D6] pt-3.5 text-[13px] leading-snug text-[#334155]">
            <li className="flex items-baseline gap-2">
              <span className="font-display font-bold text-[#B45309] tabular-nums">01.</span>
              <span>點擊螢幕放下上方吊掛的金條</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="font-display font-bold text-[#B45309] tabular-nums">02.</span>
              <span>未與下方對齊的多餘部分將會被切落</span>
            </li>
            <li className="flex items-baseline gap-2">
              <span className="font-display font-bold text-[#B45309] tabular-nums">03.</span>
              <span>善用「自動對齊、加寬、防護盾」道具衝高分</span>
            </li>
          </ol>

          {/* Primary Start CTA */}
          <button
            type="button"
            onClick={onStart}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#B45309] px-6 font-display text-base font-bold text-white shadow-sm transition-transform duration-150 hover:bg-[#92400E] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            開始疊金條
          </button>

          {/* Best score + flat control hint */}
          <div className="mt-3 flex flex-col items-center gap-1 text-center text-xs text-[#64748B]">
            {bestScore > 0 && (
              <p className="font-semibold text-[#334155] tabular-nums">
                歷史最高紀錄 · {bestScore} 層
              </p>
            )}
            <p>點擊或 Space 放下 · 1/2/3 道具 · P 暫停</p>
          </div>
        </div>
      </div>
    </div>
  );
}
