const MUTE_STORAGE_KEY = 'patisserie_stack_muted';
const BGM_STORAGE_KEY = 'gold_stack_bgm_enabled';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private bgmEnabled: boolean = true;

  // Money BGM scheduler state
  private bgmPlaying: boolean = false;
  private bgmTimerId: number | null = null;
  private bgmGain: GainNode | null = null;
  private nextStepTime: number = 0;
  private currentStep: number = 0;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_STORAGE_KEY) === '1';
      const savedBgm = localStorage.getItem(BGM_STORAGE_KEY);
      this.bgmEnabled = savedBgm === null ? true : savedBgm === '1';
    } catch {
      this.muted = false;
      this.bgmEnabled = true;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isBgmEnabled(): boolean {
    return this.bgmEnabled;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
    this.syncBgmGain();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public toggleBgm(): boolean {
    this.bgmEnabled = !this.bgmEnabled;
    try {
      localStorage.setItem(BGM_STORAGE_KEY, this.bgmEnabled ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
    if (!this.bgmEnabled) {
      this.stopBgm();
    } else if (this.bgmPlaying) {
      this.startBgm();
    }
    return this.bgmEnabled;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureContextAlways(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private syncBgmGain(): void {
    if (!this.bgmGain || !this.ctx) return;
    const target = this.muted || !this.bgmEnabled || !this.bgmPlaying ? 0 : 0.16;
    this.bgmGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
  }

  public unlock(): void {
    const ctx = this.ensureContextAlways();
    if (ctx && this.bgmPlaying && this.bgmEnabled && !this.muted) {
      this.syncBgmGain();
    }
  }

  // Upbeat "Money / Vault Swing" procedural BGM loop (116 BPM, 16 eighth-note steps per 2 bars, 32-step cycle)
  public startBgm(): void {
    this.bgmPlaying = true;
    if (!this.bgmEnabled || this.muted) {
      this.syncBgmGain();
      return;
    }

    const ctx = this.ensureContextAlways();
    if (!ctx) return;

    if (!this.bgmGain) {
      this.bgmGain = ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.16, ctx.currentTime);
      this.bgmGain.connect(ctx.destination);
    }

    this.syncBgmGain();

    if (this.bgmTimerId !== null) return;

    this.currentStep = 0;
    this.nextStepTime = ctx.currentTime + 0.06;

    const stepDuration = 60 / 116 / 2; // eighth note ~0.2586s

    this.bgmTimerId = window.setInterval(() => {
      if (!this.ctx || !this.bgmPlaying || !this.bgmEnabled || this.muted) return;
      if (this.ctx.state === 'suspended') return;

      while (this.nextStepTime < this.ctx.currentTime + 0.2) {
        const swingOffset = this.currentStep % 2 === 1 ? stepDuration * 0.16 : 0;
        this.scheduleBgmStep(this.currentStep, this.nextStepTime + swingOffset);
        this.nextStepTime += stepDuration;
        this.currentStep = (this.currentStep + 1) % 32;
      }
    }, 65);
  }

  public stopBgm(): void {
    this.bgmPlaying = false;
    if (this.bgmTimerId !== null) {
      clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
    this.syncBgmGain();
  }

  public pauseBgm(): void {
    this.stopBgm();
  }

  private scheduleBgmStep(step: number, time: number): void {
    if (!this.ctx || !this.bgmGain) return;
    const ctx = this.ctx;
    const out = this.bgmGain;

    // 32-step Gm7 -> Cm7 -> D7 -> Gm7 "Money Groove" walking bassline (Hz)
    const bassPattern: (number | null)[] = [
      // Bar 1: Gm7
      98.0, null, 116.54, null, 146.83, null, 174.61, 146.83,
      // Bar 2: Cm7
      130.81, null, 155.56, null, 196.0, null, 174.61, 155.56,
      // Bar 3: D7 -> Eb7 flavor
      146.83, null, 185.0, null, 220.0, null, 196.0, 185.0,
      // Bar 4: Gm7 turnaround
      98.0, null, 146.83, null, 116.54, 130.81, 146.83, null,
    ];

    const bassFreq = bassPattern[step];
    if (bassFreq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(bassFreq, time);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(0.55, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

      osc.connect(gain);
      gain.connect(out);
      osc.start(time);
      osc.stop(time + 0.24);
    }

    // Syncopated jazz-vault chord stabs
    const chordSteps: Record<number, number[]> = {
      2: [293.66, 349.23, 466.16], // Gm7
      6: [293.66, 349.23, 466.16],
      10: [261.63, 311.13, 392.0], // Cm7
      14: [261.63, 311.13, 392.0],
      18: [293.66, 369.99, 440.0], // D7
      22: [311.13, 392.0, 466.16], // EbMaj
      26: [293.66, 349.23, 466.16], // Gm7
      30: [369.99, 440.0, 523.25], // D7 turnaround
    };

    const chord = chordSteps[step];
    if (chord) {
      for (const freq of chord) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(0.14, time + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);
        osc.connect(gain);
        gain.connect(out);
        osc.start(time);
        osc.stop(time + 0.18);
      }
    }

    // Cash-coin / vibraphone sparkle motif ("Cha-ching" money hook!)
    const coinMelody: Record<number, number> = {
      0: 783.99,  // G5
      3: 932.33,  // Bb5
      4: 1174.66, // D6
      8: 1046.5,  // C6
      11: 932.33, // Bb5
      12: 783.99, // G5
      16: 880.0,  // A5
      19: 1108.73,// C#6/Db6 subtle jazz color -> use F#5 739.99 / A5
      20: 1174.66,// D6
      24: 1567.98,// G6 cash register sparkle!
      25: 1975.53,// B6/Bb6 -> let's use G6 -> D6 coin double-ring:
      28: 1174.66,
      30: 1567.98,
    };
    // Keep strictly diatonic/harmonic for step 19 & 25
    coinMelody[19] = 932.33;
    coinMelody[25] = 2093.0; // C7/G6 double coin ping -> 1567.98 + 2349.32 (G6 + D7!)
    if (step === 25) coinMelody[25] = 2349.32;

    const melFreq = coinMelody[step];
    if (melFreq) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(melFreq, time);
      const isCoinPing = step === 24 || step === 25;
      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(isCoinPing ? 0.24 : 0.18, time + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, time + (isCoinPing ? 0.3 : 0.22));
      osc.connect(gain);
      gain.connect(out);
      osc.start(time);
      osc.stop(time + 0.32);
    }

    // Crisp hi-hat groove tick using high-frequency short filtered burst
    if (step % 2 === 1 || step % 4 === 0) {
      const hatOsc = ctx.createOscillator();
      const hatFilter = ctx.createBiquadFilter();
      const hatGain = ctx.createGain();
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(step % 4 === 2 ? 6200 : 8400, time);
      hatFilter.type = 'highpass';
      hatFilter.frequency.setValueAtTime(5500, time);

      hatGain.gain.setValueAtTime(step % 4 === 2 ? 0.06 : 0.03, time);
      hatGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);

      hatOsc.connect(hatFilter);
      hatFilter.connect(hatGain);
      hatGain.connect(out);
      hatOsc.start(time);
      hatOsc.stop(time + 0.04);
    }
  }

  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playDrop(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.11);

    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playLand(wasSliced: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(195, now);
    thump.frequency.exponentialRampToValueAtTime(72, now + 0.11);
    thumpGain.gain.setValueAtTime(0.24, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    thump.connect(thumpGain);
    thumpGain.connect(ctx.destination);
    thump.start(now);
    thump.stop(now + 0.14);

    const clink = ctx.createOscillator();
    const clinkGain = ctx.createGain();
    clink.type = 'sine';
    clink.frequency.setValueAtTime(1480, now);
    clink.frequency.exponentialRampToValueAtTime(1220, now + 0.14);
    clinkGain.gain.setValueAtTime(0.08, now);
    clinkGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    clink.connect(clinkGain);
    clinkGain.connect(ctx.destination);
    clink.start(now);
    clink.stop(now + 0.16);

    if (wasSliced) {
      const shear = ctx.createOscillator();
      const shearGain = ctx.createGain();
      shear.type = 'sawtooth';
      shear.frequency.setValueAtTime(1950, now + 0.01);
      shear.frequency.exponentialRampToValueAtTime(720, now + 0.11);

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200, now);
      filter.Q.setValueAtTime(3.2, now);

      shearGain.gain.setValueAtTime(0.08, now + 0.01);
      shearGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      shear.connect(filter);
      filter.connect(shearGain);
      shearGain.connect(ctx.destination);
      shear.start(now + 0.01);
      shear.stop(now + 0.13);
    }
  }

  public playPerfect(combo: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const semitones = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const idx = Math.min(semitones.length - 1, Math.max(0, combo - 1));
    const freq = 523.25 * Math.pow(2, semitones[idx] / 12);

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 1.5, now);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  public playExpand(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
  }

  public playAutoAlign(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.14);
    gain.gain.setValueAtTime(0.13, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playShieldActivate(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [392.0, 587.33, 783.99].forEach((freq, i) => {
      const start = now + i * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.11, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.26);
    });
  }

  public playShieldSave(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.18);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [349.23, 311.13, 261.63];
    notes.forEach((freq, i) => {
      const start = now + i * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.92, start + 0.24);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }
}

export const soundEngine = new SoundEngine();
