import { Crosshair, MoveHorizontal, Music, Pause, Shield, Volume2, VolumeX } from 'lucide-react';
import { GameHudStats } from '../game/types';

interface GameHudProps {
  stats: GameHudStats;
  isMuted: boolean;
  isBgmEnabled: boolean;
  onToggleMute: () => void;
  onToggleBgm: () => void;
  onPause: () => void;
  onUseAutoAlign: () => void;
  onUseWiden: () => void;
  onUseShield: () => void;
}

export function GameHud({
  stats,
  isMuted,
  isBgmEnabled,
  onToggleMute,
  onToggleBgm,
  onPause,
  onUseAutoAlign,
  onUseWiden,
  onUseShield,
}: GameHudProps) {
  const isDarkSky = stats.score >= 22;

  return (
    <>
      {/* Top Perimeter HUD */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6"
        aria-live="polite"
      >
        {/* Left: Clean unboxed score & metadata */}
        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2.5">
            <span
              className={`font-display text-4xl font-extrabold tracking-tight tabular-nums transition-colors duration-300 sm:text-5xl ${
                isDarkSky ? 'text-[#F8FAFC] drop-shadow-sm' : 'text-[#0F172A]'
              }`}
            >
              {stats.score}
            </span>
            <span
              className={`text-sm font-bold transition-colors duration-300 ${
                isDarkSky ? 'text-[#E2E8F0]' : 'text-[#475569]'
              }`}
            >
              層
            </span>
            {stats.combo > 1 && (
              <span
                className={`font-display text-sm font-extrabold tabular-nums transition-colors duration-200 ${
                  isDarkSky ? 'text-[#FBBF24]' : 'text-[#B45309]'
                }`}
              >
                連擊 ×{stats.combo}
              </span>
            )}
          </div>

          <div
            className={`flex items-center gap-2 text-xs font-medium tabular-nums transition-colors duration-300 ${
              isDarkSky ? 'text-[#CBD5E1]' : 'text-[#475569]'
            }`}
          >
            <span>最高 {stats.bestScore}</span>
            <span aria-hidden="true">·</span>
            <span>寬度 {stats.currentWidthPct}%</span>
            {stats.shieldActive && (
              <>
                <span aria-hidden="true">·</span>
                <span className={isDarkSky ? 'font-bold text-[#38BDF8]' : 'font-bold text-[#0284C7]'}>
                  防護盾啟用中
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: >= 44px touch-safe controls (BGM, Mute, Pause) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleBgm}
            aria-label={isBgmEnabled ? '關閉背景音樂' : '開啟背景音樂'}
            title={isBgmEnabled ? '背景音樂：開' : '背景音樂：關'}
            className={`flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309] ${
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
            title={isMuted ? '開啟音效 (M)' : '靜音 (M)'}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4C7B4] bg-[#FFFDF8] text-[#1E293B] shadow-sm transition-transform duration-150 hover:bg-[#FEF6E6] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309]"
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onPause}
            aria-label="暫停遊戲"
            title="暫停 (P / Esc)"
            className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[#D4C7B4] bg-[#FFFDF8] px-3.5 text-sm font-bold text-[#0F172A] shadow-sm transition-transform duration-150 hover:bg-[#FEF6E6] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309] whitespace-nowrap shrink-0"
          >
            <Pause className="h-4 w-4" />
            <span>暫停</span>
          </button>
        </div>
      </div>

      {/* Bottom Power-up Dock (<= 15% mobile height, pointer-safe) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-[max(0.85rem,env(safe-area-inset-bottom))]">
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto grid w-full max-w-[400px] grid-cols-3 gap-2"
        >
          <button
            type="button"
            onClick={onUseAutoAlign}
            disabled={stats.powerUps.autoAlign <= 0}
            title="自動對齊落下 (快捷鍵 1)"
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#DFD2BD] bg-[#FFFDF8] px-2.5 py-2 text-xs font-bold text-[#0F172A] shadow-sm transition-transform duration-150 hover:bg-[#FEF6E6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309] whitespace-nowrap"
          >
            <Crosshair className="h-4 w-4 shrink-0 text-[#B45309]" />
            <span className="truncate">自動對齊</span>
            <span className="font-display text-xs font-extrabold text-[#B45309] tabular-nums">
              ×{stats.powerUps.autoAlign}
            </span>
          </button>

          <button
            type="button"
            onClick={onUseWiden}
            disabled={stats.powerUps.widen <= 0 || !stats.canWiden}
            title="增加金條寬度 (快捷鍵 2)"
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-[#DFD2BD] bg-[#FFFDF8] px-2.5 py-2 text-xs font-bold text-[#0F172A] shadow-sm transition-transform duration-150 hover:bg-[#FEF6E6] active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B45309] whitespace-nowrap"
          >
            <MoveHorizontal className="h-4 w-4 shrink-0 text-[#D97706]" />
            <span className="truncate">增加寬度</span>
            <span className="font-display text-xs font-extrabold text-[#B45309] tabular-nums">
              ×{stats.powerUps.widen}
            </span>
          </button>

          <button
            type="button"
            onClick={onUseShield}
            disabled={stats.powerUps.shield <= 0 || stats.shieldActive}
            title="防護盾防止遊戲結束 (快捷鍵 3)"
            className={`flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold shadow-sm transition-transform duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0284C7] whitespace-nowrap ${
              stats.shieldActive
                ? 'border-[#0284C7] bg-[#E0F2FE] text-[#0369A1]'
                : 'border-[#DFD2BD] bg-[#FFFDF8] text-[#0F172A] hover:bg-[#FEF6E6] disabled:cursor-not-allowed disabled:opacity-45'
            }`}
          >
            <Shield className="h-4 w-4 shrink-0 text-[#0284C7]" />
            <span className="truncate">{stats.shieldActive ? '防護中' : '防護盾'}</span>
            {!stats.shieldActive && (
              <span className="font-display text-xs font-extrabold text-[#0284C7] tabular-nums">
                ×{stats.powerUps.shield}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
