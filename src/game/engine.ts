import { soundEngine } from './audio';
import { getFlavorForTier, getSkyGradientColors } from './flavors';
import {
  CakeFlavor,
  CakeTier,
  DroppingCake,
  FloatingCallout,
  GameHudStats,
  GameState,
  Particle,
  PowerUpInventory,
  SlicedPiece,
} from './types';

const BEST_SCORE_KEY = 'patisserie_stack_best_v1';

const INITIAL_CAKE_WIDTH = 176;
const MAX_CAKE_WIDTH = 220;
const CAKE_HEIGHT = 40;
const STAND_WIDTH = 280;
const STAND_TOP_Y = 34;
const PERFECT_TOLERANCE = 6.5;
const GRAVITY = 2700;

interface CloudItem {
  x: number;
  y: number;
  w: number;
  speed: number;
  alpha: number;
}

interface StarItem {
  x: number; // -0.5..0.5 normalized
  y: number; // 0..1 normalized
  size: number;
  phase: number;
}

export interface EngineCallbacks {
  onHudChange: (stats: GameHudStats) => void;
  onGameOver: (stats: GameHudStats) => void;
}

export class CakeStackEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;

  private rafId: number | null = null;
  private lastTimestamp: number = 0;

  // Viewport & world scaling
  private viewWidth: number = 390;
  private viewHeight: number = 844;
  private dpr: number = 1;
  private scale: number = 1;
  private viewWorldWidth: number = 430;
  private viewWorldHeight: number = 760;
  private bottomMargin: number = 152;

  // Game state
  private gameState: GameState = 'TITLE_MENU';
  private score: number = 0;
  private bestScore: number = 0;
  private isNewBest: boolean = false;
  private combo: number = 0;
  private maxCombo: number = 0;
  private perfectCount: number = 0;

  // Entities
  private stack: CakeTier[] = [];
  private activeWidth: number = INITIAL_CAKE_WIDTH;
  private activeFlavor: CakeFlavor = getFlavorForTier(0);
  private dropping: DroppingCake | null = null;
  private slicedPieces: SlicedPiece[] = [];
  private particles: Particle[] = [];
  private callouts: FloatingCallout[] = [];

  // Pendulum state
  private pendulumPhase: number = 0;
  private ropeIntroProgress: number = 1; // 0..1 smooth slide-in for next bar
  private pendingGameOverTimer: number = -1;

  // Power-ups
  private powerUps: PowerUpInventory = { autoAlign: 2, widen: 2, shield: 1 };
  private shieldActive: boolean = false;

  // Camera & Juice
  private cameraY: number = 0;
  private targetCameraY: number = 0;
  private shakeTime: number = 0;
  private shakeIntensity: number = 0;
  private hitstopTimer: number = 0;
  private perfectFlashAlpha: number = 0;

  // Ambient scenery
  private clouds: CloudItem[] = [];
  private stars: StarItem[] = [];
  private elapsedTime: number = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    try {
      const saved = localStorage.getItem(BEST_SCORE_KEY);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          this.bestScore = parsed;
        }
      }
    } catch {
      this.bestScore = 0;
    }

    this.initScenery();
    this.setupTitleShowcase();
    this.resize();
  }

  private initScenery(): void {
    this.clouds = [];
    for (let i = 0; i < 10; i++) {
      this.clouds.push({
        x: (Math.random() - 0.5) * 900,
        y: 340 + i * 260 + Math.random() * 120,
        w: 90 + Math.random() * 110,
        speed: (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 12),
        alpha: 0.45 + Math.random() * 0.35,
      });
    }

    this.stars = [];
    for (let i = 0; i < 48; i++) {
      this.stars.push({
        x: Math.random() - 0.5,
        y: Math.random() * 0.78,
        size: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private setupTitleShowcase(): void {
    this.stack = [];
    for (let i = 0; i < 4; i++) {
      this.stack.push({
        id: i + 1,
        x: i === 2 ? 4 : i === 3 ? -3 : 0,
        y: STAND_TOP_Y + i * CAKE_HEIGHT,
        width: INITIAL_CAKE_WIDTH - i * 4,
        height: CAKE_HEIGHT,
        flavor: getFlavorForTier(i),
        scaleX: 1,
        scaleY: 1,
        isPerfect: i < 2,
      });
    }
    this.activeWidth = INITIAL_CAKE_WIDTH - 12;
    this.activeFlavor = getFlavorForTier(4);
    this.dropping = null;
    this.slicedPieces = [];
    this.particles = [];
    this.callouts = [];
    this.cameraY = 0;
    this.targetCameraY = 0;
    this.pendulumPhase = 0.4;
    this.ropeIntroProgress = 1;
    this.pendingGameOverTimer = -1;
  }

  public startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      const rawDt = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      this.update(dt);
      this.render();

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public resize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    this.viewWidth = Math.max(320, rect?.width || window.innerWidth);
    this.viewHeight = Math.max(480, rect?.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(this.viewWidth * this.dpr);
    this.canvas.height = Math.round(this.viewHeight * this.dpr);

    this.scale = Math.min(this.viewHeight / 760, this.viewWidth / 430);
    this.viewWorldWidth = this.viewWidth / this.scale;
    this.viewWorldHeight = this.viewHeight / this.scale;
    this.bottomMargin = this.viewWorldHeight * 0.2;
  }

  public startNewGame(): void {
    this.gameState = 'PLAYING';
    this.score = 0;
    this.isNewBest = false;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectCount = 0;

    this.stack = [];
    this.activeWidth = INITIAL_CAKE_WIDTH;
    this.activeFlavor = getFlavorForTier(0);
    this.dropping = null;
    this.slicedPieces = [];
    this.particles = [];
    this.callouts = [];

    this.powerUps = { autoAlign: 2, widen: 2, shield: 1 };
    this.shieldActive = false;

    this.cameraY = 0;
    this.targetCameraY = 0;
    this.pendulumPhase = -Math.PI * 0.25;
    this.ropeIntroProgress = 1;
    this.pendingGameOverTimer = -1;
    this.hitstopTimer = 0;
    this.shakeTime = 0;
    this.perfectFlashAlpha = 0;

    this.emitHud();
  }

  public setGameState(state: GameState): void {
    this.gameState = state;
    if (state === 'TITLE_MENU') {
      this.setupTitleShowcase();
    }
  }

  public getHudStats(): GameHudStats {
    return {
      score: this.score,
      bestScore: this.bestScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      perfectCount: this.perfectCount,
      currentWidthPct: Math.round((this.activeWidth / INITIAL_CAKE_WIDTH) * 100),
      canWiden: this.activeWidth < MAX_CAKE_WIDTH - 1,
      currentFlavorName: this.activeFlavor.name,
      isNewBest: this.isNewBest,
      powerUps: { ...this.powerUps },
      shieldActive: this.shieldActive,
    };
  }

  public useAutoAlign(): boolean {
    if (this.gameState !== 'PLAYING') return false;
    if (this.powerUps.autoAlign <= 0) return false;
    if (this.dropping !== null) return false;
    if (this.pendingGameOverTimer >= 0) return false;
    if (this.ropeIntroProgress < 0.45) return false;

    this.powerUps.autoAlign -= 1;
    const { cakeX, cakeY, theta } = this.getPendulumPose();
    const targetX = this.stack.length === 0 ? 0 : this.stack[this.stack.length - 1].x;

    this.dropping = {
      x: cakeX,
      y: cakeY,
      vx: 0,
      vy: -180,
      width: this.activeWidth,
      height: CAKE_HEIGHT,
      rotation: theta * 0.14,
      angularVelocity: 0,
      flavor: this.activeFlavor,
      missed: false,
      autoGuided: true,
      targetX,
    };

    soundEngine.playAutoAlign();
    this.emitHud();
    return true;
  }

  public useWiden(): boolean {
    if (this.gameState !== 'PLAYING') return false;
    if (this.powerUps.widen <= 0) return false;
    if (this.activeWidth >= MAX_CAKE_WIDTH - 1) return false;

    this.powerUps.widen -= 1;
    this.activeWidth = Math.min(MAX_CAKE_WIDTH, this.activeWidth + 36);
    if (this.dropping && !this.dropping.missed) {
      this.dropping.width = this.activeWidth;
    }

    const { cakeX, cakeY } = this.getPendulumPose();
    const fxX = this.dropping ? this.dropping.x : cakeX;
    const fxY = this.dropping ? this.dropping.y : cakeY;

    this.spawnPerfectBurst(fxX, fxY, this.activeWidth);
    this.callouts.push({
      x: fxX,
      y: fxY + 26,
      vy: 60,
      text: '金條加寬 +20%',
      color: '#D97706',
      alpha: 1,
      life: 0,
      maxLife: 0.9,
      scale: 1.05,
    });

    soundEngine.playExpand();
    this.emitHud();
    return true;
  }

  public useShield(): boolean {
    if (this.gameState !== 'PLAYING') return false;
    if (this.powerUps.shield <= 0) return false;
    if (this.shieldActive) return false;

    this.powerUps.shield -= 1;
    this.shieldActive = true;

    const targetY =
      this.stack.length === 0
        ? STAND_TOP_Y
        : this.stack[this.stack.length - 1].y + CAKE_HEIGHT;
    const targetX = this.stack.length === 0 ? 0 : this.stack[this.stack.length - 1].x;

    this.particles.push({
      x: targetX,
      y: targetY + 12,
      vx: 0,
      vy: 0,
      size: (this.stack.length === 0 ? STAND_WIDTH : this.activeWidth) * 0.65,
      color: '#0EA5E9',
      alpha: 1,
      life: 0,
      maxLife: 0.55,
      kind: 'shieldRing',
    });

    this.callouts.push({
      x: targetX,
      y: targetY + 34,
      vy: 55,
      text: '防護盾已啟動',
      color: '#0284C7',
      alpha: 1,
      life: 0,
      maxLife: 0.9,
      scale: 1.0,
    });

    soundEngine.playShieldActivate();
    this.emitHud();
    return true;
  }

  public triggerDrop(): boolean {
    if (this.gameState !== 'PLAYING') return false;
    if (this.dropping !== null) return false;
    if (this.pendingGameOverTimer >= 0) return false;
    if (this.ropeIntroProgress < 0.65) return false;

    const { cakeX, cakeY, theta } = this.getPendulumPose();

    this.dropping = {
      x: cakeX,
      y: cakeY,
      vx: 0,
      vy: -140,
      width: this.activeWidth,
      height: CAKE_HEIGHT,
      rotation: theta * 0.14,
      angularVelocity: 0,
      flavor: this.activeFlavor,
      missed: false,
    };

    soundEngine.playDrop();
    return true;
  }

  private getPendulumConfig(): {
    anchorX: number;
    anchorY: number;
    ropeLength: number;
    maxAngle: number;
    angularFreq: number;
  } {
    const wyTop = this.cameraY - this.bottomMargin + this.viewWorldHeight;
    const anchorY = wyTop - 72;
    const ropeLength = Math.min(185, Math.max(135, this.viewWorldHeight * 0.2));

    const difficulty = this.gameState === 'TITLE_MENU' ? 0 : this.score;
    const maxAngle = Math.min(0.74, 0.58 + difficulty * 0.0045);
    const angularFreq =
      this.gameState === 'TITLE_MENU'
        ? 1.9
        : 2.55 + 2.25 * (1 - Math.exp(-difficulty / 26));

    return {
      anchorX: 0,
      anchorY,
      ropeLength,
      maxAngle,
      angularFreq,
    };
  }

  private getPendulumPose(): {
    anchorX: number;
    anchorY: number;
    hookX: number;
    hookY: number;
    cakeX: number;
    cakeY: number;
    theta: number;
  } {
    const { anchorX, anchorY, ropeLength, maxAngle } = this.getPendulumConfig();
    const theta = maxAngle * Math.sin(this.pendulumPhase);
    const effectiveLen = ropeLength * (0.45 + 0.55 * this.ropeIntroProgress);
    const hookX = anchorX + effectiveLen * Math.sin(theta);
    const hookY = anchorY - effectiveLen * Math.cos(theta);
    const cakeX = hookX;
    const cakeY = hookY - CAKE_HEIGHT * 0.5;

    return { anchorX, anchorY, hookX, hookY, cakeX, cakeY, theta };
  }

  private emitHud(): void {
    this.callbacks.onHudChange(this.getHudStats());
  }

  private update(dt: number): void {
    this.elapsedTime += dt;

    if (this.gameState === 'PAUSED') {
      return;
    }

    // Drift clouds gently regardless of hitstop
    for (const c of this.clouds) {
      c.x += c.speed * dt;
      if (c.x > 520) c.x = -520;
      if (c.x < -520) c.x = 520;
    }

    // Hitstop pause for crisp impact punch
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Shake decay
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
    }
    if (this.perfectFlashAlpha > 0) {
      this.perfectFlashAlpha = Math.max(0, this.perfectFlashAlpha - dt * 2.6);
    }

    // Smooth camera pan
    const camLerp = 1 - Math.exp(-7.5 * dt);
    this.cameraY += (this.targetCameraY - this.cameraY) * camLerp;

    // Pendulum swing
    const { angularFreq } = this.getPendulumConfig();
    this.pendulumPhase += angularFreq * dt;

    if (this.ropeIntroProgress < 1) {
      this.ropeIntroProgress = Math.min(1, this.ropeIntroProgress + dt * 5.8);
    }

    // Squash & stretch recovery for stacked tiers
    for (let i = Math.max(0, this.stack.length - 6); i < this.stack.length; i++) {
      const tier = this.stack[i];
      tier.scaleX += (1 - tier.scaleX) * Math.min(1, dt * 15);
      tier.scaleY += (1 - tier.scaleY) * Math.min(1, dt * 15);
    }

    // Update dropping bar
    if (this.dropping) {
      const d = this.dropping;
      d.vy -= GRAVITY * dt;
      d.y += d.vy * dt;

      if (d.autoGuided && d.targetX !== undefined && !d.missed) {
        d.x += (d.targetX - d.x) * Math.min(1, dt * 20);
      } else {
        d.x += d.vx * dt;
      }

      if (!d.missed) {
        // Straighten angle cleanly during fall
        d.rotation += (0 - d.rotation) * Math.min(1, dt * 14);
        const targetSurfaceY =
          this.stack.length === 0
            ? STAND_TOP_Y
            : this.stack[this.stack.length - 1].y + CAKE_HEIGHT;

        const cakeBottomY = d.y - d.height * 0.5;
        if (cakeBottomY <= targetSurfaceY) {
          if (d.autoGuided && d.targetX !== undefined) {
            d.x = d.targetX;
          }
          this.handleCakeCollision(d, targetSurfaceY);
        }
      } else {
        d.rotation += d.angularVelocity * dt;
        if (d.y < this.cameraY - this.bottomMargin - 120) {
          this.dropping = null;
        }
      }
    }

    // Pending game over delay so player sees missed cake tumble
    if (this.pendingGameOverTimer >= 0) {
      this.pendingGameOverTimer -= dt;
      if (this.pendingGameOverTimer <= 0) {
        this.pendingGameOverTimer = -1;
        this.gameState = 'GAME_OVER';
        this.callbacks.onGameOver(this.getHudStats());
      }
    }

    // Update sliced pieces
    for (let i = this.slicedPieces.length - 1; i >= 0; i--) {
      const p = this.slicedPieces[i];
      p.vy -= GRAVITY * 0.88 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.angularVelocity * dt;
      if (p.y < this.cameraY - this.bottomMargin - 80) {
        this.slicedPieces.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      if (pt.kind === 'crumb') {
        pt.vy -= GRAVITY * 0.55 * dt;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha = 1 - pt.life / pt.maxLife;
    }

    // Update floating callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life += dt;
      if (c.life >= c.maxLife) {
        this.callouts.splice(i, 1);
        continue;
      }
      c.y += c.vy * dt;
      c.vy *= Math.exp(-3 * dt);
      const progress = c.life / c.maxLife;
      c.alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
    }
  }

  private handleCakeCollision(d: DroppingCake, targetSurfaceY: number): void {
    const isFirst = this.stack.length === 0;
    const prevLeft = isFirst
      ? -STAND_WIDTH * 0.5
      : this.stack[this.stack.length - 1].x - this.stack[this.stack.length - 1].width * 0.5;
    const prevRight = isFirst
      ? STAND_WIDTH * 0.5
      : this.stack[this.stack.length - 1].x + this.stack[this.stack.length - 1].width * 0.5;
    const prevCenter = isFirst ? 0 : this.stack[this.stack.length - 1].x;

    const currLeft = d.x - d.width * 0.5;
    const currRight = d.x + d.width * 0.5;

    const overlapLeft = Math.max(prevLeft, currLeft);
    const overlapRight = Math.min(prevRight, currRight);
    const overlapWidth = overlapRight - overlapLeft;

    // 1. Complete Miss -> Shield Save OR Game Over
    if (overlapWidth <= 2) {
      d.missed = true;
      d.y = targetSurfaceY + d.height * 0.5;
      if (d.x >= prevCenter) {
        d.vx = 115;
        d.angularVelocity = -4.2;
      } else {
        d.vx = -115;
        d.angularVelocity = 4.2;
      }
      d.vy = this.shieldActive ? 160 : -120;

      if (this.shieldActive) {
        this.shieldActive = false;
        this.hitstopTimer = 0.035;
        this.shakeTime = 0.18;
        this.shakeIntensity = 5;
        this.ropeIntroProgress = 0;

        this.particles.push({
          x: prevCenter,
          y: targetSurfaceY + 10,
          vx: 0,
          vy: 0,
          size: (isFirst ? STAND_WIDTH : this.activeWidth) * 0.72,
          color: '#0EA5E9',
          alpha: 1,
          life: 0,
          maxLife: 0.6,
          kind: 'shieldRing',
        });

        this.callouts.push({
          x: prevCenter,
          y: targetSurfaceY + 38,
          vy: 65,
          text: '防護盾發動！',
          subtext: '成功防止遊戲結束',
          color: '#0284C7',
          alpha: 1,
          life: 0,
          maxLife: 1.15,
          scale: 1.1,
        });

        soundEngine.playShieldSave();
        this.emitHud();
        return;
      }

      this.shakeTime = 0.28;
      this.shakeIntensity = 9;
      this.pendingGameOverTimer = 0.55;
      soundEngine.playGameOver();
      return;
    }

    // 2. Successful landing (Perfect or Sliced)
    const deltaX = d.x - prevCenter;
    const isPerfect = d.autoGuided ? true : !isFirst && Math.abs(deltaX) <= PERFECT_TOLERANCE;

    let landedX: number;
    let landedWidth: number;
    let expanded = false;

    if (isFirst) {
      // On cake stand: if inside stand, keep full width; if hanging off stand edge, slice excess!
      landedWidth = overlapWidth;
      landedX = (overlapLeft + overlapRight) * 0.5;
      if (landedWidth < d.width - 0.5) {
        this.spawnSlicedOverhang(d, targetSurfaceY, prevLeft, prevRight, currLeft, currRight);
      }
    } else if (isPerfect) {
      landedX = prevCenter;
      landedWidth = this.activeWidth;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.perfectCount += 1;

      if (this.combo > 0 && this.combo % 5 === 0 && landedWidth < INITIAL_CAKE_WIDTH) {
        landedWidth = Math.min(INITIAL_CAKE_WIDTH, landedWidth + 16);
        expanded = true;
      }
    } else {
      landedWidth = overlapWidth;
      landedX = (overlapLeft + overlapRight) * 0.5;
      this.combo = 0;
      this.spawnSlicedOverhang(d, targetSurfaceY, prevLeft, prevRight, currLeft, currRight);
    }

    // Commit stacked tier
    const newTier: CakeTier = {
      id: this.stack.length + 1,
      x: landedX,
      y: targetSurfaceY,
      width: landedWidth,
      height: CAKE_HEIGHT,
      flavor: d.flavor,
      scaleX: isPerfect ? 1.12 : 1.07,
      scaleY: isPerfect ? 0.84 : 0.89,
      isPerfect,
    };

    this.stack.push(newTier);
    this.dropping = null;
    this.activeWidth = landedWidth;
    this.score += 1;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.isNewBest = true;
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(this.bestScore));
      } catch {
        // ignore
      }
    }

    // Update target camera height
    const topOfStackY = targetSurfaceY + CAKE_HEIGHT;
    this.targetCameraY = Math.max(0, topOfStackY - this.viewWorldHeight * 0.16);

    // Prepare next cake on pendulum
    this.activeFlavor = getFlavorForTier(this.score);
    this.ropeIntroProgress = 0;

    // Tactile Juice & Audio
    if (isPerfect) {
      this.hitstopTimer = 0.032;
      this.perfectFlashAlpha = 0.45;
      this.spawnPerfectBurst(landedX, targetSurfaceY + CAKE_HEIGHT * 0.5, landedWidth);
      if (expanded) {
        soundEngine.playExpand();
        this.callouts.push({
          x: landedX,
          y: topOfStackY + 26,
          vy: 75,
          text: `連擊 ×${this.combo}`,
          subtext: '金條加寬獎勵！',
          color: '#D97706',
          alpha: 1,
          life: 0,
          maxLife: 1.05,
          scale: 1.15,
        });
      } else {
        soundEngine.playPerfect(this.combo);
        this.callouts.push({
          x: landedX,
          y: topOfStackY + 24,
          vy: 70,
          text: this.combo > 1 ? `完美對齊 ×${this.combo}` : '完美對齊！',
          color: '#B45309',
          alpha: 1,
          life: 0,
          maxLife: 0.85,
          scale: 1.05,
        });
      }
    } else {
      const wasSliced = landedWidth < d.width - 0.5;
      soundEngine.playLand(wasSliced);
      this.shakeTime = wasSliced ? 0.14 : 0.08;
      this.shakeIntensity = wasSliced ? 4.2 : 2.2;
      this.spawnLandingCrumbs(landedX, targetSurfaceY, landedWidth, d.flavor);
    }

    // Milestone item supply every 8 layers
    if (this.score > 0 && this.score % 8 === 0) {
      const cycle = Math.floor(this.score / 8) % 3;
      let rewardLabel = '';
      if (cycle === 1) {
        this.powerUps.autoAlign += 1;
        rewardLabel = '補給 +1 自動對齊';
      } else if (cycle === 2) {
        this.powerUps.widen += 1;
        rewardLabel = '補給 +1 增加寬度';
      } else {
        this.powerUps.shield += 1;
        rewardLabel = '補給 +1 防護盾';
      }
      this.callouts.push({
        x: landedX,
        y: topOfStackY + 56,
        vy: 55,
        text: rewardLabel,
        color: '#0F766E',
        alpha: 1,
        life: 0,
        maxLife: 1.1,
        scale: 0.95,
      });
    }

    this.emitHud();
  }

  private spawnSlicedOverhang(
    d: DroppingCake,
    surfaceY: number,
    prevLeft: number,
    prevRight: number,
    currLeft: number,
    currRight: number
  ): void {
    // Left overhang
    if (currLeft < prevLeft) {
      const sliceW = prevLeft - currLeft;
      if (sliceW > 0.5) {
        const sliceCenterX = currLeft + sliceW * 0.5;
        this.slicedPieces.push({
          x: sliceCenterX,
          y: surfaceY + d.height * 0.5,
          vx: -95 - Math.random() * 35,
          vy: 95,
          width: sliceW,
          height: d.height,
          rotation: 0,
          angularVelocity: 3.4 + Math.random() * 1.6,
          flavor: d.flavor,
          alpha: 1,
          side: 'left',
        });
        this.spawnCutSeamCrumbs(prevLeft, surfaceY + d.height * 0.5, d.flavor);
      }
    }

    // Right overhang
    if (currRight > prevRight) {
      const sliceW = currRight - prevRight;
      if (sliceW > 0.5) {
        const sliceCenterX = prevRight + sliceW * 0.5;
        this.slicedPieces.push({
          x: sliceCenterX,
          y: surfaceY + d.height * 0.5,
          vx: 95 + Math.random() * 35,
          vy: 95,
          width: sliceW,
          height: d.height,
          rotation: 0,
          angularVelocity: -(3.4 + Math.random() * 1.6),
          flavor: d.flavor,
          alpha: 1,
          side: 'right',
        });
        this.spawnCutSeamCrumbs(prevRight, surfaceY + d.height * 0.5, d.flavor);
      }
    }
  }

  private spawnCutSeamCrumbs(cutX: number, cutY: number, flavor: CakeFlavor): void {
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 145;
      this.particles.push({
        x: cutX + (Math.random() - 0.5) * 4,
        y: cutY + (Math.random() - 0.5) * 26,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 75,
        size: 2.2 + Math.random() * 3,
        color: i % 3 === 0 ? '#FFFFFF' : i % 3 === 1 ? flavor.frostingHighlight : flavor.sponge,
        alpha: 1,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.25,
        kind: i % 2 === 0 ? 'spark' : 'crumb',
      });
    }
  }

  private spawnLandingCrumbs(x: number, surfaceY: number, width: number, flavor: CakeFlavor): void {
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      this.particles.push({
        x: x + side * (width * 0.46) + (Math.random() - 0.5) * 10,
        y: surfaceY + 3,
        vx: side * (50 + Math.random() * 70),
        vy: 28 + Math.random() * 55,
        size: 2 + Math.random() * 2.5,
        color: i % 2 === 0 ? flavor.frostingHighlight : '#FDE047',
        alpha: 1,
        life: 0,
        maxLife: 0.34 + Math.random() * 0.18,
        kind: 'spark',
      });
    }
  }

  private spawnPerfectBurst(x: number, y: number, width: number): void {
    // Expanding golden ring
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: width * 0.55,
      color: '#F59E0B',
      alpha: 1,
      life: 0,
      maxLife: 0.48,
      kind: 'ring',
    });

    // Sparkles around the edges
    for (let i = 0; i < 16; i++) {
      const side = i < 8 ? -1 : 1;
      const sx = x + side * (width * 0.5 + Math.random() * 8);
      const sy = y + (Math.random() - 0.5) * 24;
      this.particles.push({
        x: sx,
        y: sy,
        vx: side * (55 + Math.random() * 90),
        vy: 35 + Math.random() * 90,
        size: 3 + Math.random() * 3.5,
        color: i % 2 === 0 ? '#FBBF24' : '#FFFBEB',
        alpha: 1,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.25,
        kind: 'spark',
      });
    }
  }

  private worldToScreenX(wx: number): number {
    return this.viewWidth * 0.5 + wx * this.scale;
  }

  private worldToScreenY(wy: number): number {
    return this.viewHeight - this.scale * (wy - this.cameraY + this.bottomMargin);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Dynamic Altitude Sky Background
    const skyLayers = this.gameState === 'TITLE_MENU' ? 2 : this.score;
    const sky = getSkyGradientColors(skyLayers);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
    skyGrad.addColorStop(0, sky.top);
    skyGrad.addColorStop(1, sky.bottom);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    // Camera Shake offset
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0) {
      const mag = this.shakeIntensity * (this.shakeTime / 0.28);
      shakeX = (Math.random() - 0.5) * 2 * mag;
      shakeY = (Math.random() - 0.5) * 2 * mag;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 2. Twinkling stars at high altitude
    if (sky.nightFactor > 0.02) {
      for (const s of this.stars) {
        const twinkle = 0.45 + 0.55 * Math.sin(this.elapsedTime * 2.5 + s.phase);
        ctx.fillStyle = `rgba(255, 250, 235, ${sky.nightFactor * twinkle * 0.85})`;
        const sx = (0.5 + s.x) * this.viewWidth;
        const sy = s.y * this.viewHeight;
        ctx.beginPath();
        ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Soft drifting clouds
    this.drawClouds(ctx, sky.nightFactor);

    // 4. Subtle altitude milestone markers
    this.drawAltitudeMarkers(ctx, sky.nightFactor);

    // 5. Patisserie counter & cake stand
    this.drawBakeryGround(ctx);

    // 6. Subtle vertical alignment shadow when dropping or swinging (very subtle rim shadow on top cake)
    this.drawAlignmentHint(ctx);

    // 7. Stacked cake tiers
    for (let i = 0; i < this.stack.length; i++) {
      const tier = this.stack[i];
      const screenY = this.worldToScreenY(tier.y);
      if (screenY > this.viewHeight + 80 || screenY < -100) continue;
      this.drawCakeTier(
        ctx,
        tier.x,
        tier.y + tier.height * 0.5,
        tier.width,
        tier.height,
        tier.flavor,
        0,
        tier.scaleX,
        tier.scaleY
      );
    }

    // 8. Dropping gold bar (+ magnetic auto-guide beam)
    if (this.dropping) {
      const d = this.dropping;
      if (d.autoGuided && d.targetX !== undefined && !d.missed) {
        const targetY =
          this.stack.length === 0
            ? STAND_TOP_Y
            : this.stack[this.stack.length - 1].y + CAKE_HEIGHT;
        const beamX = this.worldToScreenX(d.targetX);
        const beamTopY = this.worldToScreenY(d.y);
        const beamBotY = this.worldToScreenY(targetY);
        const beamW = d.width * this.scale;

        ctx.save();
        ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
        ctx.fillRect(beamX - beamW * 0.5, beamTopY, beamW, Math.max(0, beamBotY - beamTopY));
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
        ctx.setLineDash([5 * this.scale, 4 * this.scale]);
        ctx.lineWidth = 1.5 * this.scale;
        ctx.beginPath();
        ctx.moveTo(beamX, beamTopY);
        ctx.lineTo(beamX, beamBotY);
        ctx.stroke();
        ctx.restore();
      }

      this.drawCakeTier(
        ctx,
        d.x,
        d.y,
        d.width,
        d.height,
        d.flavor,
        d.rotation,
        1,
        1
      );
    }

    // 8b. Active protective shield dome on top of the stack
    if (this.shieldActive && (this.gameState === 'PLAYING' || this.gameState === 'PAUSED')) {
      const topY =
        this.stack.length === 0
          ? STAND_TOP_Y
          : this.stack[this.stack.length - 1].y + CAKE_HEIGHT;
      const topX = this.stack.length === 0 ? 0 : this.stack[this.stack.length - 1].x;
      const topW = this.stack.length === 0 ? STAND_WIDTH : this.stack[this.stack.length - 1].width;

      const sx = this.worldToScreenX(topX);
      const sy = this.worldToScreenY(topY);
      const radiusX = (topW * 0.5 + 24) * this.scale;
      const radiusY = 28 * this.scale;
      const pulse = 0.65 + 0.35 * Math.sin(this.elapsedTime * 5);

      ctx.save();
      ctx.strokeStyle = `rgba(14, 165, 233, ${0.72 * pulse})`;
      ctx.lineWidth = 2.6 * this.scale;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * this.scale, radiusX, radiusY, 0, Math.PI, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(56, 189, 248, ${0.14 * pulse})`;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 2 * this.scale, radiusX, radiusY, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 9. Sliced overhanging pieces tumbling down
    for (const piece of this.slicedPieces) {
      this.drawSlicedPiece(ctx, piece);
    }

    // 10. Swinging pendulum rope & next cake
    if (
      (this.gameState === 'PLAYING' || this.gameState === 'TITLE_MENU' || this.gameState === 'PAUSED') &&
      this.dropping === null &&
      this.pendingGameOverTimer < 0
    ) {
      this.drawPendulumAndCake(ctx);
    }

    // 11. Particles & perfect burst rings
    this.drawParticles(ctx);

    // 12. Floating callout texts
    this.drawCallouts(ctx);

    // 13. Subtle golden screen edge glow on Perfect hit
    if (this.perfectFlashAlpha > 0.01) {
      ctx.fillStyle = `rgba(251, 191, 36, ${this.perfectFlashAlpha * 0.14})`;
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }

    ctx.restore();
    ctx.restore();
  }

  private drawClouds(ctx: CanvasRenderingContext2D, nightFactor: number): void {
    const cloudAlphaScale = 1 - nightFactor * 0.72;
    for (const c of this.clouds) {
      const sy = this.worldToScreenY(c.y);
      if (sy < -80 || sy > this.viewHeight + 80) continue;
      const sx = this.worldToScreenX(c.x);
      const r = c.w * 0.28 * this.scale;

      ctx.fillStyle = `rgba(255, 255, 255, ${c.alpha * cloudAlphaScale})`;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.arc(sx - r * 0.9, sy + r * 0.22, r * 0.72, 0, Math.PI * 2);
      ctx.arc(sx + r * 0.95, sy + r * 0.2, r * 0.78, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawAltitudeMarkers(ctx: CanvasRenderingContext2D, nightFactor: number): void {
    if (this.gameState === 'TITLE_MENU') return;
    const textColor =
      nightFactor > 0.45 ? 'rgba(255, 245, 235, 0.35)' : 'rgba(92, 61, 51, 0.28)';
    const lineColor =
      nightFactor > 0.45 ? 'rgba(255, 245, 235, 0.14)' : 'rgba(92, 61, 51, 0.12)';

    ctx.save();
    ctx.font = `700 ${Math.max(10, Math.round(11 * this.scale))}px "Outfit", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let floor = 5; floor <= this.score + 12; floor += 5) {
      const wy = STAND_TOP_Y + floor * CAKE_HEIGHT;
      const sy = this.worldToScreenY(wy);
      if (sy < 60 || sy > this.viewHeight - 40) continue;

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.viewWidth - 44, sy);
      ctx.lineTo(this.viewWidth - 12, sy);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.fillText(`${floor}F`, this.viewWidth - 48, sy);
    }
    ctx.restore();
  }

  private drawBakeryGround(ctx: CanvasRenderingContext2D): void {
    const counterTopSY = this.worldToScreenY(0);
    if (counterTopSY > this.viewHeight + 60) return;

    // Subtle architectural treasury paneling behind pedestal
    const wallTopSY = this.worldToScreenY(280);
    if (counterTopSY > 0) {
      const panelW = 56 * this.scale;
      const count = Math.ceil(this.viewWidth / panelW) + 2;
      const startX = ((this.viewWidth * 0.5) % panelW) - panelW;
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(148, 163, 184, 0.12)' : 'rgba(255, 255, 255, 0.08)';
        const top = Math.max(0, wallTopSY);
        ctx.fillRect(startX + i * panelW, top, panelW, Math.max(0, counterTopSY - top));
      }
      if (wallTopSY > -20 && wallTopSY < this.viewHeight) {
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.fillRect(0, wallTopSY, this.viewWidth, 4 * this.scale);
      }
    }

    // Dark slate vault floor
    const floorHeight = Math.max(0, this.viewHeight - counterTopSY + 40);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, counterTopSY, this.viewWidth, floorHeight);

    // Brushed steel floor bevel
    ctx.fillStyle = '#64748B';
    ctx.fillRect(0, counterTopSY, this.viewWidth, 6 * this.scale);

    // Gold trim line
    ctx.fillStyle = '#D97706';
    ctx.fillRect(0, counterTopSY + 6 * this.scale, this.viewWidth, 2.5 * this.scale);

    // Heavy Bullion Vault Pedestal
    const standCenterX = this.worldToScreenX(0);
    const standTopSY = this.worldToScreenY(STAND_TOP_Y);
    const standPlateW = STAND_WIDTH * this.scale;
    const standPlateH = 14 * this.scale;

    // Pedestal shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.beginPath();
    ctx.ellipse(
      standCenterX,
      counterTopSY + 2 * this.scale,
      standPlateW * 0.42,
      5 * this.scale,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Steel plinth base
    const stemTopY = standTopSY + standPlateH;
    const stemH = counterTopSY - stemTopY;
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(standCenterX - standPlateW * 0.36, stemTopY);
    ctx.lineTo(standCenterX + standPlateW * 0.36, stemTopY);
    ctx.lineTo(standCenterX + standPlateW * 0.43, counterTopSY);
    ctx.lineTo(standCenterX - standPlateW * 0.43, counterTopSY);
    ctx.closePath();
    ctx.fill();

    // Brushed metal highlight stripe on plinth
    ctx.fillStyle = '#64748B';
    ctx.fillRect(
      standCenterX - standPlateW * 0.25,
      stemTopY + 2 * this.scale,
      standPlateW * 0.14,
      Math.max(0, stemH - 4 * this.scale)
    );

    // Top brushed brass/steel pallet plate
    ctx.fillStyle = '#1E293B';
    this.roundRect(
      ctx,
      standCenterX - standPlateW * 0.5,
      standTopSY,
      standPlateW,
      standPlateH,
      4 * this.scale
    );
    ctx.fill();

    // Brass rim highlight
    ctx.fillStyle = '#F59E0B';
    this.roundRect(
      ctx,
      standCenterX - standPlateW * 0.49,
      standTopSY + 1.5 * this.scale,
      standPlateW * 0.98,
      3.5 * this.scale,
      2 * this.scale
    );
    ctx.fill();
  }

  private drawAlignmentHint(ctx: CanvasRenderingContext2D): void {
    if (this.gameState !== 'PLAYING' || this.stack.length === 0) return;

    const topTier = this.stack[this.stack.length - 1];
    const sourceCake = this.dropping ?? {
      x: this.getPendulumPose().cakeX,
      width: this.activeWidth,
    };

    const topLeft = topTier.x - topTier.width * 0.5;
    const topRight = topTier.x + topTier.width * 0.5;
    const dropLeft = sourceCake.x - sourceCake.width * 0.5;
    const dropRight = sourceCake.x + sourceCake.width * 0.5;

    const oLeft = Math.max(topLeft, dropLeft);
    const oRight = Math.min(topRight, dropRight);
    if (oRight <= oLeft) return;

    const sy = this.worldToScreenY(topTier.y + topTier.height);
    const sx = this.worldToScreenX(oLeft);
    const sw = (oRight - oLeft) * this.scale;

    ctx.fillStyle = 'rgba(113, 63, 18, 0.22)';
    ctx.fillRect(sx, sy - 1.5 * this.scale, sw, 3 * this.scale);
  }

  private drawPendulumAndCake(ctx: CanvasRenderingContext2D): void {
    const { anchorX, anchorY, hookX, hookY, cakeX, cakeY, theta } = this.getPendulumPose();

    const ax = this.worldToScreenX(anchorX);
    const ay = this.worldToScreenY(anchorY);
    const hx = this.worldToScreenX(hookX);
    const hy = this.worldToScreenY(hookY);

    // Steel hoist cable
    ctx.save();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = Math.max(2.2, 2.8 * this.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(hx, hy);
    ctx.stroke();

    // Overhead crane pulley pivot
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(ax, ay, 6 * this.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(ax, ay, 2.6 * this.scale, 0, Math.PI * 2);
    ctx.fill();

    // Hanging gold bar
    this.drawCakeTier(
      ctx,
      cakeX,
      cakeY,
      this.activeWidth,
      CAKE_HEIGHT,
      this.activeFlavor,
      theta * 0.14,
      1,
      1
    );

    // Magnetic / brass hoist clamp at hook point
    ctx.translate(hx, hy);
    ctx.rotate(-theta * 0.14);
    ctx.fillStyle = '#334155';
    this.roundRect(ctx, -9 * this.scale, -5 * this.scale, 18 * this.scale, 7 * this.scale, 2.5 * this.scale);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, -3.5 * this.scale, 2.5 * this.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawCakeTier(
    ctx: CanvasRenderingContext2D,
    wx: number,
    wyCenter: number,
    wWidth: number,
    wHeight: number,
    flavor: CakeFlavor,
    rotation: number,
    scaleX: number,
    scaleY: number
  ): void {
    const sx = this.worldToScreenX(wx);
    const sy = this.worldToScreenY(wyCenter);
    const pw = wWidth * this.scale * scaleX;
    const ph = wHeight * this.scale * scaleY;

    ctx.save();
    ctx.translate(sx, sy);
    if (rotation !== 0) {
      ctx.rotate(-rotation);
    }

    const left = -pw * 0.5;
    const top = -ph * 0.5;
    const radius = Math.min(3.5 * this.scale, pw * 0.2);

    // 1. Metallic bullion body gradient
    const bodyGrad = ctx.createLinearGradient(left, top, left + pw, top + ph);
    bodyGrad.addColorStop(0, flavor.frosting);
    bodyGrad.addColorStop(0.35, flavor.sponge);
    bodyGrad.addColorStop(0.75, flavor.spongeShade);
    bodyGrad.addColorStop(1, flavor.sponge);

    ctx.fillStyle = bodyGrad;
    this.roundRect(ctx, left, top, pw, ph, radius);
    ctx.fill();

    // 2. Top bright chamfer bevel
    const bevelH = ph * 0.2;
    ctx.fillStyle = flavor.frostingHighlight;
    ctx.globalAlpha = 0.72;
    this.roundRect(ctx, left + 1, top + 1, Math.max(0, pw - 2), bevelH, Math.min(radius, 2.5 * this.scale));
    ctx.fill();
    ctx.globalAlpha = 1;

    // 3. Bottom metallic shadow bevel
    ctx.fillStyle = flavor.accent;
    ctx.globalAlpha = 0.42;
    this.roundRect(
      ctx,
      left + 1,
      top + ph - bevelH,
      Math.max(0, pw - 2),
      bevelH - 1,
      Math.min(radius, 2.5 * this.scale)
    );
    ctx.fill();
    ctx.globalAlpha = 1;

    // 4. Inner recessed bullion face & diagonal sheen
    if (pw > 18 * this.scale) {
      const insetX = Math.min(9 * this.scale, pw * 0.14);
      const insetY = ph * 0.23;
      const innerW = pw - insetX * 2;
      const innerH = ph - insetY * 2;

      ctx.fillStyle = flavor.filling;
      ctx.globalAlpha = 0.35;
      this.roundRect(ctx, left + insetX, top + insetY, innerW, innerH, 2 * this.scale);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = flavor.accent;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(1, 1.1 * this.scale);
      this.roundRect(ctx, left + insetX, top + insetY, innerW, innerH, 2 * this.scale);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Diagonal gleaming light reflection clipped inside bullion bar
      ctx.save();
      this.roundRect(ctx, left + 1, top + 1, Math.max(0, pw - 2), ph - 2, radius);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
      const sheenX = left + pw * 0.22;
      const sheenW = Math.min(18 * this.scale, pw * 0.18);
      ctx.beginPath();
      ctx.moveTo(sheenX, top);
      ctx.lineTo(sheenX + sheenW, top);
      ctx.lineTo(sheenX + sheenW - 10 * this.scale, top + ph);
      ctx.lineTo(sheenX - 10 * this.scale, top + ph);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Engraved "999.9" bullion stamp when bar is wide enough
      if (pw > 66 * this.scale) {
        ctx.fillStyle = flavor.accent;
        ctx.globalAlpha = 0.65;
        ctx.font = `800 ${Math.max(8, Math.round(9.5 * this.scale))}px "Outfit", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('999.9', 0, 0.5 * this.scale);
        ctx.globalAlpha = 1;
      }
    }

    // 5. Crisp outer metallic edge contour
    ctx.strokeStyle = 'rgba(113, 63, 18, 0.42)';
    ctx.lineWidth = Math.max(1, 1.2 * this.scale);
    this.roundRect(ctx, left, top, pw, ph, radius);
    ctx.stroke();

    ctx.restore();
  }

  private drawSlicedPiece(ctx: CanvasRenderingContext2D, piece: SlicedPiece): void {
    const sx = this.worldToScreenX(piece.x);
    const sy = this.worldToScreenY(piece.y);
    const pw = Math.max(2, piece.width * this.scale);
    const ph = piece.height * this.scale;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(-piece.rotation);

    const left = -pw * 0.5;
    const top = -ph * 0.5;

    ctx.fillStyle = piece.flavor.sponge;
    ctx.fillRect(left, top, pw, ph);

    ctx.fillStyle = piece.flavor.frostingHighlight;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(left, top, pw, ph * 0.22);
    ctx.globalAlpha = 1;

    ctx.fillStyle = piece.flavor.spongeShade;
    ctx.fillRect(left, top + ph * 0.78, pw, ph * 0.22);

    // Bright sheared metal cut edge facing the stack
    ctx.fillStyle = '#FFFBEB';
    const cutX = piece.side === 'right' ? left : left + pw - Math.min(2.5 * this.scale, pw * 0.35);
    ctx.fillRect(cutX, top, Math.min(2.5 * this.scale, pw * 0.35), ph);

    ctx.strokeStyle = 'rgba(113, 63, 18, 0.42)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, pw, ph);

    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const pt of this.particles) {
      const sx = this.worldToScreenX(pt.x);
      const sy = this.worldToScreenY(pt.y);

      if (pt.kind === 'ring' || pt.kind === 'shieldRing') {
        const progress = pt.life / pt.maxLife;
        const radius = pt.size * this.scale * (0.7 + progress * 0.85);
        ctx.save();
        ctx.strokeStyle =
          pt.kind === 'shieldRing'
            ? `rgba(14, 165, 233, ${pt.alpha * 0.88})`
            : `rgba(245, 158, 11, ${pt.alpha * 0.8})`;
        ctx.lineWidth = Math.max(1.5, (1 - progress) * 4.5 * this.scale);
        ctx.beginPath();
        ctx.ellipse(sx, sy, radius, radius * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      ctx.save();
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      if (pt.kind === 'spark') {
        const r = pt.size * this.scale;
        ctx.moveTo(sx, sy - r);
        ctx.lineTo(sx + r * 0.7, sy);
        ctx.lineTo(sx, sy + r);
        ctx.lineTo(sx - r * 0.7, sy);
        ctx.closePath();
      } else {
        ctx.arc(sx, sy, pt.size * this.scale, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }

  private drawCallouts(ctx: CanvasRenderingContext2D): void {
    for (const c of this.callouts) {
      const sx = this.worldToScreenX(c.x);
      const sy = this.worldToScreenY(c.y);

      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const mainSize = Math.round(18 * this.scale * c.scale);
      ctx.font = `800 ${mainSize}px "Outfit", "Noto Sans TC", sans-serif`;

      // Crisp light halo behind text so it stays readable over any sky
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255, 250, 245, 0.92)';
      ctx.strokeText(c.text, sx, sy);

      ctx.fillStyle = c.color;
      ctx.fillText(c.text, sx, sy);

      if (c.subtext) {
        const subSize = Math.round(13 * this.scale);
        ctx.font = `700 ${subSize}px "Plus Jakarta Sans", "Noto Sans TC", sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeText(c.subtext, sx, sy + mainSize * 1.05);
        ctx.fillStyle = '#9A3412';
        ctx.fillText(c.subtext, sx, sy + mainSize * 1.05);
      }

      ctx.restore();
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    const radius = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
