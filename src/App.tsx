import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { GameOverModal, PauseModal } from './components/ModalOverlays';
import { TitleOverlay } from './components/TitleOverlay';
import { soundEngine } from './game/audio';
import { CakeStackEngine } from './game/engine';
import { GameHudStats, GameState } from './game/types';

const INITIAL_STATS: GameHudStats = {
  score: 0,
  bestScore: 0,
  combo: 0,
  maxCombo: 0,
  perfectCount: 0,
  currentWidthPct: 100,
  canWiden: true,
  currentFlavorName: '24K 足金條',
  isNewBest: false,
  powerUps: { autoAlign: 2, widen: 2, shield: 1 },
  shieldActive: false,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CakeStackEngine | null>(null);
  const gameStateRef = useRef<GameState>('TITLE_MENU');

  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [stats, setStats] = useState<GameHudStats>(INITIAL_STATS);
  const [isMuted, setIsMuted] = useState<boolean>(() => soundEngine.isMuted());
  const [isBgmEnabled, setIsBgmEnabled] = useState<boolean>(() => soundEngine.isBgmEnabled());

  const updateGameState = useCallback((next: GameState) => {
    gameStateRef.current = next;
    setGameState(next);
    engineRef.current?.setGameState(next);
    if (next === 'PLAYING') {
      soundEngine.startBgm();
    } else {
      soundEngine.pauseBgm();
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new CakeStackEngine(canvas, {
      onHudChange: (nextStats) => {
        setStats(nextStats);
      },
      onGameOver: (finalStats) => {
        setStats(finalStats);
        gameStateRef.current = 'GAME_OVER';
        setGameState('GAME_OVER');
        soundEngine.pauseBgm();
      },
    });

    engineRef.current = engine;
    setStats(engine.getHudStats());
    engine.startLoop();

    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      soundEngine.stopBgm();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const handleStartGame = useCallback(() => {
    soundEngine.unlock();
    soundEngine.playClick();
    gameStateRef.current = 'PLAYING';
    setGameState('PLAYING');
    engineRef.current?.startNewGame();
    soundEngine.startBgm();
  }, []);

  const handlePause = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    soundEngine.playClick();
    updateGameState('PAUSED');
  }, [updateGameState]);

  const handleResume = useCallback(() => {
    if (gameStateRef.current !== 'PAUSED') return;
    soundEngine.unlock();
    soundEngine.playClick();
    updateGameState('PLAYING');
  }, [updateGameState]);

  const handleQuitToTitle = useCallback(() => {
    soundEngine.playClick();
    updateGameState('TITLE_MENU');
    if (engineRef.current) {
      setStats(engineRef.current.getHudStats());
    }
  }, [updateGameState]);

  const handleToggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      soundEngine.unlock();
      soundEngine.playClick();
      if (gameStateRef.current === 'PLAYING') {
        soundEngine.startBgm();
      }
    }
  }, []);

  const handleToggleBgm = useCallback(() => {
    soundEngine.unlock();
    const enabled = soundEngine.toggleBgm();
    setIsBgmEnabled(enabled);
    soundEngine.playClick();
    if (enabled && gameStateRef.current === 'PLAYING') {
      soundEngine.startBgm();
    }
  }, []);

  const handleUseAutoAlign = useCallback(() => {
    soundEngine.unlock();
    engineRef.current?.useAutoAlign();
  }, []);

  const handleUseWiden = useCallback(() => {
    soundEngine.unlock();
    engineRef.current?.useWiden();
  }, []);

  const handleUseShield = useCallback(() => {
    soundEngine.unlock();
    engineRef.current?.useShield();
  }, []);

  const handleCanvasPointerDown = useCallback(() => {
    if (gameStateRef.current !== 'PLAYING') return;
    soundEngine.unlock();
    engineRef.current?.triggerDrop();
  }, []);

  // Keyboard shortcuts & auto-pause on tab hidden
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const key = e.key;
      const code = e.code;

      if (key === 'm' || key === 'M') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (key === 'b' || key === 'B') {
        e.preventDefault();
        handleToggleBgm();
        return;
      }

      if (key === 'Escape' || key === 'p' || key === 'P') {
        if (gameStateRef.current === 'PLAYING') {
          e.preventDefault();
          handlePause();
        } else if (gameStateRef.current === 'PAUSED') {
          e.preventDefault();
          handleResume();
        }
        return;
      }

      if (gameStateRef.current === 'PLAYING') {
        if (key === '1') {
          e.preventDefault();
          handleUseAutoAlign();
          return;
        }
        if (key === '2') {
          e.preventDefault();
          handleUseWiden();
          return;
        }
        if (key === '3') {
          e.preventDefault();
          handleUseShield();
          return;
        }
      }

      if (code === 'Space' || key === 'Enter' || key === 'ArrowDown') {
        e.preventDefault();
        if (gameStateRef.current === 'PLAYING') {
          soundEngine.unlock();
          engineRef.current?.triggerDrop();
        } else if (gameStateRef.current === 'TITLE_MENU' || gameStateRef.current === 'GAME_OVER') {
          handleStartGame();
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && gameStateRef.current === 'PLAYING') {
        updateGameState('PAUSED');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    handlePause,
    handleResume,
    handleStartGame,
    handleToggleBgm,
    handleToggleMute,
    handleUseAutoAlign,
    handleUseShield,
    handleUseWiden,
    updateGameState,
  ]);

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#E4E8EE]">
      {/* Isolated full-viewport game canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handleCanvasPointerDown}
        className="block h-full w-full touch-none cursor-pointer"
        aria-label="金條疊疊樂遊戲畫布"
      />

      {gameState === 'TITLE_MENU' && (
        <TitleOverlay
          bestScore={stats.bestScore}
          isMuted={isMuted}
          isBgmEnabled={isBgmEnabled}
          onToggleMute={handleToggleMute}
          onToggleBgm={handleToggleBgm}
          onStart={handleStartGame}
        />
      )}

      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <GameHud
          stats={stats}
          isMuted={isMuted}
          isBgmEnabled={isBgmEnabled}
          onToggleMute={handleToggleMute}
          onToggleBgm={handleToggleBgm}
          onPause={handlePause}
          onUseAutoAlign={handleUseAutoAlign}
          onUseWiden={handleUseWiden}
          onUseShield={handleUseShield}
        />
      )}

      {gameState === 'PAUSED' && (
        <PauseModal
          stats={stats}
          onResume={handleResume}
          onRestart={handleStartGame}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {gameState === 'GAME_OVER' && (
        <GameOverModal
          stats={stats}
          onRestart={handleStartGame}
          onQuitToTitle={handleQuitToTitle}
        />
      )}
    </main>
  );
}
