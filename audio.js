/**
 * IRON FIST LEAGUE — Audio System
 *
 * Phase 1: Web Audio API procedural sound generation.
 * All sounds are synthesized — no external files needed.
 * When real assets are available, replace AudioManager._loadSFX() / _loadMusic().
 */

class AudioManager {
  constructor() {
    this._ctx      = null;
    this._enabled  = true;
    this._sfxVol   = 0.5;
    this._musicVol = 0.25;
    this._bgmGain  = null;
    this._bgmSource = null;
  }

  /** Must be called after a user gesture to unlock AudioContext. */
  init() {
    if (this._ctx) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('[Audio] Web Audio API not available:', e);
    }
  }

  // ══════════════════════════════════════════════════
  //  SFX GENERATION
  // ══════════════════════════════════════════════════

  _playTone({ type = 'sine', freq = 440, freq2 = null, duration = 0.1,
              volume = 0.4, attack = 0.005, decay = 0.05, distort = false }) {
    if (!this._ctx || !this._enabled) return;

    const now   = this._ctx.currentTime;
    const gain  = this._ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * this._sfxVol, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const osc = this._ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, now + duration);

    if (distort) {
      const distNode = this._ctx.createWaveShaper();
      distNode.curve = this._makeDistCurve(300);
      osc.connect(distNode);
      distNode.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this._ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  _makeDistCurve(amount) {
    const n = 256;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((Math.PI + amount) * x) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  _playNoise({ duration = 0.1, volume = 0.3, lowpass = 800 }) {
    if (!this._ctx || !this._enabled) return;
    const bufSize = Math.floor(this._ctx.sampleRate * duration);
    const buf     = this._ctx.createBuffer(1, bufSize, this._ctx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src    = this._ctx.createBufferSource();
    src.buffer   = buf;

    const filter = this._ctx.createBiquadFilter();
    filter.type  = 'lowpass';
    filter.frequency.value = lowpass;

    const gain   = this._ctx.createGain();
    const now    = this._ctx.currentTime;
    gain.gain.setValueAtTime(volume * this._sfxVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._ctx.destination);
    src.start(now);
  }

  // ══════════════════════════════════════════════════
  //  NAMED SOUND EFFECTS
  // ══════════════════════════════════════════════════

  play(name) {
    if (!this._ctx) return;
    switch (name) {
      case 'lightHit':
        this._playNoise({ duration: 0.07, volume: 0.35, lowpass: 1200 });
        this._playTone({ type: 'square', freq: 180, freq2: 120, duration: 0.06, volume: 0.15 });
        break;

      case 'heavyHit':
        this._playNoise({ duration: 0.14, volume: 0.6, lowpass: 600 });
        this._playTone({ type: 'sawtooth', freq: 90, freq2: 50, duration: 0.15, volume: 0.3, distort: true });
        break;

      case 'kickHit':
        this._playNoise({ duration: 0.1, volume: 0.5, lowpass: 900 });
        this._playTone({ type: 'square', freq: 140, freq2: 80, duration: 0.1, volume: 0.2 });
        break;

      case 'block':
        this._playNoise({ duration: 0.06, volume: 0.2, lowpass: 3000 });
        this._playTone({ type: 'triangle', freq: 800, freq2: 600, duration: 0.05, volume: 0.15 });
        break;

      case 'grab':
        this._playNoise({ duration: 0.2, volume: 0.5, lowpass: 400 });
        break;

      case 'slam':
        this._playNoise({ duration: 0.3, volume: 0.8, lowpass: 300 });
        this._playTone({ type: 'sawtooth', freq: 60, freq2: 30, duration: 0.3, volume: 0.5, distort: true });
        break;

      case 'wallImpact':
        this._playNoise({ duration: 0.15, volume: 0.55, lowpass: 500 });
        this._playTone({ type: 'square', freq: 70, freq2: 40, duration: 0.2, volume: 0.4 });
        break;

      case 'ko':
        this._playNoise({ duration: 0.4, volume: 0.9, lowpass: 400 });
        this._playTone({ type: 'sawtooth', freq: 55, freq2: 22, duration: 0.5, volume: 0.7, distort: true });
        break;

      case 'special':
        this._playTone({ type: 'sine', freq: 600, freq2: 1200, duration: 0.2, volume: 0.3 });
        this._playNoise({ duration: 0.25, volume: 0.4, lowpass: 2000 });
        break;

      case 'menuMove':
        this._playTone({ type: 'sine', freq: 440, freq2: 480, duration: 0.06, volume: 0.15 });
        break;

      case 'menuSelect':
        this._playTone({ type: 'sine', freq: 660, freq2: 880, duration: 0.12, volume: 0.3 });
        break;

      case 'roundStart':
        this._playTone({ type: 'sine', freq: 550, freq2: 1100, duration: 0.3, volume: 0.5 });
        break;

      case 'roundWin':
        this._playTone({ type: 'sine', freq: 440, duration: 0.15, volume: 0.4 });
        setTimeout(() => this._playTone({ type: 'sine', freq: 550, duration: 0.15, volume: 0.4 }), 150);
        setTimeout(() => this._playTone({ type: 'sine', freq: 660, duration: 0.3,  volume: 0.5 }), 300);
        break;

      case 'armorAbsorb':
        this._playNoise({ duration: 0.08, volume: 0.3, lowpass: 5000 });
        this._playTone({ type: 'triangle', freq: 1000, freq2: 1400, duration: 0.1, volume: 0.25 });
        break;

      // ── Special moves ──
      case 'specialActivate':
        // Power chord: low rumble + rising high tone
        this._playNoise({ duration: 0.08, volume: 0.35, lowpass: 2000 });
        this._playTone({ type: 'sawtooth', freq: 80, freq2: 160, duration: 0.12, volume: 0.3, distort: true });
        setTimeout(() => this._playTone({ type: 'sine', freq: 700, freq2: 1100, duration: 0.18, volume: 0.25 }), 60);
        break;

      case 'seismicLift':
        // Heavy strain — grinding low note
        this._playNoise({ duration: 0.25, volume: 0.5, lowpass: 350 });
        this._playTone({ type: 'sawtooth', freq: 55, freq2: 45, duration: 0.3, volume: 0.4, distort: true });
        break;

      case 'seismicImpact':
        // Earth-shattering slam — sub-bass + white noise burst
        this._playNoise({ duration: 0.55, volume: 1.0, lowpass: 250 });
        this._playTone({ type: 'sawtooth', freq: 42, freq2: 22, duration: 0.6, volume: 0.8, distort: true });
        setTimeout(() => this._playNoise({ duration: 0.2, volume: 0.5, lowpass: 600 }), 80);
        break;

      case 'flurrySlash':
        // Fast light blade swipe
        this._playNoise({ duration: 0.05, volume: 0.28, lowpass: 3500 });
        this._playTone({ type: 'triangle', freq: 900, freq2: 1300, duration: 0.05, volume: 0.15 });
        break;

      case 'flurryFinish':
        // Explosive final hit — crack + high whine
        this._playNoise({ duration: 0.14, volume: 0.65, lowpass: 1800 });
        this._playTone({ type: 'sawtooth', freq: 200, freq2: 80, duration: 0.2, volume: 0.4, distort: true });
        setTimeout(() => this._playTone({ type: 'sine', freq: 1200, freq2: 600, duration: 0.15, volume: 0.2 }), 40);
        break;
    }
  }

  setEnabled(v) { this._enabled = !!v; }
  setSFXVolume(v) { this._sfxVol = Math.max(0, Math.min(1, v)); }
  setMusicVolume(v) { this._musicVol = Math.max(0, Math.min(1, v)); }
}

export const audioManager = new AudioManager();
