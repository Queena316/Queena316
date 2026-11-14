export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type PowerUpType = 'autoAlign' | 'widen' | 'shield';

export interface PowerUpInventory {
  autoAlign: number;
  widen: number;
  shield: number;
}

export interface CakeFlavor {
  id: string;
  name: string;
  sponge: string;
  spongeShade: string;
  filling: string;
  frosting: string;
  frostingHighlight: string;
  accent: string;
  dripCountSeed: number;
}

export interface CakeTier {
  id: number;
  x: number; // center x in world units
  y: number; // bottom y in world units
  width: number;
  height: number;
  flavor: CakeFlavor;
  scaleX: number;
  scaleY: number;
  isPerfect: boolean;
}

export interface DroppingCake {
  x: number;
  y: number; // center y in world units
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  angularVelocity: number;
  flavor: CakeFlavor;
  missed: boolean;
  autoGuided?: boolean;
  targetX?: number;
}

export interface SlicedPiece {
  x: number; // center x
  y: number; // center y
  vx: number;
  vy: number;
  width: number;
  height: number;
  rotation: number;
  angularVelocity: number;
  flavor: CakeFlavor;
  alpha: number;
  side: 'left' | 'right';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  kind: 'crumb' | 'spark' | 'ring' | 'shieldRing';
}

export interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  subtext?: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  scale: number;
}

export interface GameHudStats {
  score: number;
  bestScore: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  currentWidthPct: number;
  canWiden: boolean;
  currentFlavorName: string;
  isNewBest: boolean;
  powerUps: PowerUpInventory;
  shieldActive: boolean;
}
