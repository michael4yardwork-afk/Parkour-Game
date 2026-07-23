class AudioSynth {
  private ctx: AudioContext | null = null;
  private settings = { sfxVolume: 0.5 };

  constructor() {
    // Lazy initialized on first user interaction
  }

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  setVolume(vol: number) {
    this.settings.sfxVolume = vol;
  }

  playJump() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(320, t + 0.12);

      gain.gain.setValueAtTime(0.1 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) {
      console.warn('Audio synthesis failed', e);
    }
  }

  playLand() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(100, t);
      osc.frequency.setValueAtTime(60, t + 0.08);

      gain.gain.setValueAtTime(0.15 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.08);
    } catch (e) {
      // safe ignore
    }
  }

  playSlide() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.setValueAtTime(40, t + 0.2);

      gain.gain.setValueAtTime(0.05 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.25);
    } catch (e) {
      // safe ignore
    }
  }

  playWallrun() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.setValueAtTime(160, t + 0.1);

      gain.gain.setValueAtTime(0.12 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.12);
    } catch (e) {
      // safe ignore
    }
  }

  playCheckpoint() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.frequency.setValueAtTime(261.63, t); // C4
      osc1.frequency.setValueAtTime(329.63, t + 0.08); // E4
      osc1.frequency.setValueAtTime(392.00, t + 0.16); // G4
      osc1.frequency.setValueAtTime(523.25, t + 0.24); // C5

      gain.gain.setValueAtTime(0.15 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

      osc1.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc1.stop(t + 0.35);
    } catch (e) {
      // safe ignore
    }
  }

  playBoost() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(700, t + 0.2);

      gain.gain.setValueAtTime(0.12 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.22);
    } catch (e) {
      // safe ignore
    }
  }

  playDeath() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);

      gain.gain.setValueAtTime(0.125 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.32);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {
      // safe ignore
    }
  }

  playFinish() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, t); // C5
      osc1.frequency.setValueAtTime(659.25, t + 0.1); // E5
      osc1.frequency.setValueAtTime(783.99, t + 0.2); // G5
      osc1.frequency.setValueAtTime(1046.50, t + 0.3); // C6

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(261.63, t); // C4
      osc2.frequency.setValueAtTime(329.63, t + 0.1); // E4
      osc2.frequency.setValueAtTime(392.00, t + 0.2); // G4
      osc2.frequency.setValueAtTime(523.25, t + 0.3); // C5

      gain.gain.setValueAtTime(0.25 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc1.stop(t + 0.5);
      osc2.start(t);
      osc2.stop(t + 0.5);
    } catch (e) {
      // safe ignore
    }
  }

  playTick() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, t);
      gain.gain.setValueAtTime(0.05 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {}
  }

  playCountdownTick() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      gain.gain.setValueAtTime(0.12 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    } catch (e) {}
  }

  playCountdownGo() {
    this.init();
    if (!this.ctx || this.settings.sfxVolume === 0) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, t); // E5
      gain.gain.setValueAtTime(0.18 * this.settings.sfxVolume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {}
  }
}

export const synths = new AudioSynth();
