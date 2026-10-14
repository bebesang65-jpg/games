/**
 * IRON FIST LEAGUE — Game Engine
 *
 * Owns the Canvas, game loop, VFX, screen shake, round management.
 * Called by main.js once characters and stage are chosen.
 */

import { Player, STATE }    from './player.js';
import { CombatSystem }     from './combat.js';
import { SpecialSystem }    from './specials.js';
import { AIController }     from './ai.js';
import { StageRenderer }    from './stages.js';
import { inputManager, KEYMAP_P1 } from './input.js';
import { drawDebugBoxes }   from './collision.js';
import {
  updateHealthBar, updateMeterBar, updateTimer,
  updateRoundLabel, updateRoundPips,
  showCombo, hideCombo,
  showAnnouncement, hideAnnouncement,
  showPause, hidePause,
} from './ui.js';
import { audioManager } from './audio.js';
import { KEYMAP_P2 } from './input.js';

// ── Round configuration (defaults — overridden by settings) ──
const ROUND_TIME        = 99;   // seconds per round (overridden by settings.timerSetting)
const INTRO_DURATION    = 2000; // ms for "ROUND X" display
const FIGHT_ANNOUNCE_MS = 1200; // ms for "FIGHT!" display
const KO_DISPLAY_MS     = 1800;
const RESULT_DELAY_MS   = 1000;

// ── Game States ──
export const GAME_STATE = {
  INTRO:       'INTRO',
  FIGHT:       'FIGHT',
  ROUND_END:   'ROUND_END',
  MATCH_END:   'MATCH_END',
  PAUSED:      'PAUSED',
};

export class GameEngine {
  /**
   * @param {Object} p1CharData   - from CHARACTER_DATA
   * @param {Object} p2CharData
   * @param {string} stageId
   * @param {Object} settings     - { difficulty, timerSetting, debugMode, infiniteHealth, infiniteMeter }
   * @param {Function} onMatchEnd - callback(winner, stats)
   */
  constructor(p1CharData, p2CharData, stageId, settings, onMatchEnd) {
    this.settings     = settings;
    this.onMatchEnd   = onMatchEnd;
    this.onRoundEnd   = null;   // set via setRoundResultCallback() by main.js

    // Round-win threshold — respect settings (default 2)
    this._roundsToWin = settings.roundsToWin || 2;

    // ── Canvas ──
    this.canvas = document.getElementById('game-canvas');
    this.ctx    = this.canvas.getContext('2d');
    this._resizeCanvas();
    this._resizeHandler = this._resizeCanvas.bind(this);
    window.addEventListener('resize', this._resizeHandler);

    // ── Stage ──
    this.stageRenderer = new StageRenderer();
    this.stageRenderer.setStage(stageId);

    const W = this.canvas.width;
    const H = this.canvas.height;
    this.groundY     = Math.floor(H * 0.82);
    this.stageLeft   = Math.floor(W * 0.03);
    this.stageRight  = Math.floor(W * 0.97);

    // ── Spawn positions ──
    const p1X = Math.floor(W * 0.3);
    const p2X = Math.floor(W * 0.7);

    // ── Players ──
    const isVersus = settings.isVersusMode === true;
    this.p1 = new Player(p1CharData, p1X, this.groundY, 1,  true,  KEYMAP_P1);
    this.p2 = new Player(p2CharData, p2X, this.groundY, -1, isVersus, isVersus ? KEYMAP_P2 : {});

    // ── AI (only in non-versus mode) ──
    this.ai = new AIController(settings.difficulty || 'normal', p2CharData);
    this._isVersus = isVersus;

    // ── Combat ──
    this.combat = new CombatSystem();
    this.combat.onComboUpdate  = this._onComboUpdate.bind(this);
    this.combat.onScreenShake  = this._triggerShake.bind(this);
    this.combat.onGroundCrack  = this._addGroundCrack.bind(this);
    this.combat.onHitEffect    = this._addHitEffect.bind(this);
    this.combat.onKO           = this._onKO.bind(this);
    this.combat.onCounterHit   = this._onCounterHit.bind(this);

    // Give players a reference to the combat system (for cancel checks)
    this.p1.combatSystem = this.combat;
    this.p2.combatSystem = this.combat;

    // ── Special Moves System ──
    // Build the VFX interface the SpecialSystem needs
    const specialVfx = {
      addHitEffect:  this._addHitEffect.bind(this),
      addGroundCrack:this._addGroundCrack.bind(this),
      triggerShake:  this._triggerShake.bind(this),
      addShockwave:  this._addShockwave.bind(this),
      addDustCloud:  this._addDustCloud.bind(this),
      addSpeedLine:  this._addSpeedLine.bind(this),
      onKO:          this._onKO.bind(this),
      onComboUpdate: this._onComboUpdate.bind(this),
    };
    this.specials = new SpecialSystem(specialVfx, audioManager);

    // Tell players about the special system (so they can activate it)
    this.p1.specialSystem = this.specials;
    this.p2.specialSystem = this.specials;

    // ── Round tracking ──
    this.currentRound = 1;
    this.p1RoundWins  = 0;
    this.p2RoundWins  = 0;
    this.p1RoundArr   = [false, false, false]; // pip display
    this.p2RoundArr   = [false, false, false];
    this.roundTimer   = this._getTimerSetting();
    this.gameState    = GAME_STATE.INTRO;
    this._prevState   = null;

    // ── Timing ──
    this._lastTimestamp = 0;
    this._roundTimerMs  = this.roundTimer * 1000;
    this._timerActive   = false;
    this._rafId         = null;

    // ── VFX ──
    this._effects     = [];
    this._shakeTimer  = 0;
    this._shakeIntensity = 0;
    this._groundCracks = [];
    this._counterHitDisplay = null;
    this._specialBanner = null;   // { text, color, glow, timer, maxTimer }

    // ── Debug overlay ──
    this._debugEl = null;
    if (settings.debugMode) this._setupDebug();

    // ── Pause input ──
    this._pauseHandler = this._onPauseKey.bind(this);
    window.addEventListener('keydown', this._pauseHandler);
    this._setupPauseButtons();

    // Expose collision module for Player debug drawing
    window._ifl_collision = { drawDebugBoxes };

    // Start with intro
    this._beginRound(1);
  }

  // ══════════════════════════════════════════════════
  //  CANVAS SIZING
  // ══════════════════════════════════════════════════

  _resizeCanvas() {
    const screen = document.getElementById('screen-gameplay');
    if (!screen || !this.canvas) return;
    const W = screen.clientWidth  || window.innerWidth;
    const H = screen.clientHeight || window.innerHeight;
    this.canvas.width  = W;
    this.canvas.height = H;
    if (this.groundY !== undefined) {
      // Recalculate layout after resize
      this.groundY    = Math.floor(H * 0.82);
      this.stageLeft  = Math.floor(W * 0.03);
      this.stageRight = Math.floor(W * 0.97);
      if (this.p1) this.p1.floorY = this.groundY;
      if (this.p2) this.p2.floorY = this.groundY;
    }
  }

  // ══════════════════════════════════════════════════
  //  ROUND MANAGEMENT
  // ══════════════════════════════════════════════════

  _getTimerSetting() {
    const s = this.settings.timerSetting;
    if (s === 'infinite') return Infinity;
    return parseInt(s) || 99;
  }

  _beginRound(roundNum) {
    this.currentRound    = roundNum;
    this._roundTimerMs   = this.roundTimer === Infinity ? Infinity : this.roundTimer * 1000;
    this._timerActive    = false;
    this.gameState       = GAME_STATE.INTRO;

    const W = this.canvas.width;
    const H = this.canvas.height;
    const p1X = Math.floor(W * 0.3);
    const p2X = Math.floor(W * 0.7);

    this.p1.resetForRound(p1X, this.groundY, 1);
    this.p2.resetForRound(p2X, this.groundY, -1);
    // Ensure combat system reference is current after reset
    this.p1.combatSystem = this.combat;
    this.p2.combatSystem = this.combat;
    this.p1.specialSystem = this.specials;
    this.p2.specialSystem = this.specials;
    this.combat.resetRound();
    this.specials.reset();
    this.ai.reset();
    this._effects     = [];
    this._groundCracks = [];

    updateRoundLabel(roundNum);
    updateRoundPips(this.p1RoundArr, this.p2RoundArr);
    hideCombo();

    // Start game loop if not already running
    if (!this._rafId) {
      this._lastTimestamp = performance.now();
      this._rafId = requestAnimationFrame(this._loop.bind(this));
    }

    // Show round intro announcement
    showAnnouncement(`ROUND ${roundNum}`, '', INTRO_DURATION, () => {
      showAnnouncement('FIGHT!', 'fight', FIGHT_ANNOUNCE_MS, () => {
        hideAnnouncement();
        this.gameState    = GAME_STATE.FIGHT;
        this._timerActive = true;
        audioManager.play('roundStart');
      });
    });
  }

  _onKO(loser) {
    if (this.gameState !== GAME_STATE.FIGHT) return;
    this.gameState    = GAME_STATE.ROUND_END;
    this._timerActive = false;

    const winner = loser === this.p1 ? this.p2 : this.p1;
    audioManager.play('ko');
    this._triggerShake(18);

    showAnnouncement('K.O.', 'ko', KO_DISPLAY_MS, () => {
      this._endRound(loser === this.p1 ? 2 : 1);
    });
  }

  _endRound(winnerIndex) {
    if (winnerIndex === 1) {
      this.p1RoundWins++;
      this.p1RoundArr[this.currentRound - 1] = true;
    } else {
      this.p2RoundWins++;
      this.p2RoundArr[this.currentRound - 1] = true;
    }

    updateRoundPips(this.p1RoundArr, this.p2RoundArr);
    audioManager.play('roundWin');

    const winnerName = winnerIndex === 1
      ? this.p1.charData.name
      : this.p2.charData.name;

    showAnnouncement(`${winnerName} WINS`, 'win', 1800, () => {
      hideAnnouncement();

      // Show the Round Result overlay between rounds
      const isLastRound = (this.p1RoundWins >= this._roundsToWin) || (this.p2RoundWins >= this._roundsToWin);

      if (!isLastRound) {
        // More rounds to play — show the panel then start next round
        if (this.onRoundEnd) {
          this.onRoundEnd(
            this.currentRound,
            winnerName,
            this.p1RoundArr,
            this.p2RoundArr,
            () => {
              this._beginRound(this.currentRound + 1);
            }
          );
        } else {
          // Fallback: no callback registered
          this._beginRound(this.currentRound + 1);
        }
      } else {
        // Match over
        if (this.p1RoundWins >= this._roundsToWin) {
          this._endMatch(this.p1);
        } else {
          this._endMatch(this.p2);
        }
      }
    });
  }

  _handleTimeUp() {
    if (this.gameState !== GAME_STATE.FIGHT) return;
    this.gameState    = GAME_STATE.ROUND_END;
    this._timerActive = false;

    // Winner is the one with more health
    const p1HpPct = this.p1.health / this.p1.maxHealth;
    const p2HpPct = this.p2.health / this.p2.maxHealth;

    showAnnouncement('TIME!', '', 1000, () => {
      if (p1HpPct > p2HpPct) {
        this._endRound(1);
      } else if (p2HpPct > p1HpPct) {
        this._endRound(2);
      } else {
        // Draw — nobody wins the round, try again or favor P2
        this._endRound(2); // CPU wins draws
      }
    });
  }

  _endMatch(winner) {
    this.gameState = GAME_STATE.MATCH_END;
    this.stopLoop();

    const stats = {
      p1Rounds:     this.p1RoundWins,
      p2Rounds:     this.p2RoundWins,
      p1RoundArr:   [...this.p1RoundArr],
      p2RoundArr:   [...this.p2RoundArr],
      maxCombo:     Math.max(this.p1.maxCombo, this.p2.maxCombo),
      totalDamage:  this.p1.totalDamageDealt + this.p2.totalDamageDealt,
      // Per-player breakdown
      p1TotalDmg:   this.p1.totalDamageDealt,
      p2TotalDmg:   this.p2.totalDamageDealt,
      p1MaxCombo:   this.p1.maxCombo,
      p2MaxCombo:   this.p2.maxCombo,
      p1Specials:   this.p1.specialsUsed,
      p2Specials:   this.p2.specialsUsed,
    };

    setTimeout(() => {
      if (this.onMatchEnd) this.onMatchEnd(winner, stats);
    }, RESULT_DELAY_MS);
  }

  // ══════════════════════════════════════════════════
  //  MAIN GAME LOOP
  // ══════════════════════════════════════════════════

  _loop(timestamp) {
    this._rafId = requestAnimationFrame(this._loop.bind(this));

    const dt = Math.min(timestamp - this._lastTimestamp, 50); // cap at 50ms
    this._lastTimestamp = timestamp;

    if (this.gameState === GAME_STATE.PAUSED) {
      // Still render, don't update
      this._render();
      return;
    }

    this._update(dt);
    this._render();
  }

  _update(dt) {
    // ── Read P1 Input ──
    const p1Input = this._readP1Input();

    // ── P2 input: human in versus mode, AI otherwise ──
    const p2Input = this._isVersus
      ? this._readP2Input()
      : this.ai.update(this.p2, this.p1, dt);

    // ── Round Timer ──
    if (this._timerActive && this._roundTimerMs !== Infinity) {
      this._roundTimerMs -= dt;
      if (this._roundTimerMs <= 0) {
        this._roundTimerMs = 0;
        this._handleTimeUp();
      }
      updateTimer(this._roundTimerMs / 1000);
    }

    // ── Players ──
    const settings = {
      infiniteHealth: this.settings.infiniteHealth,
      infiniteMeter:  this.settings.infiniteMeter,
    };

    if (this.gameState === GAME_STATE.FIGHT) {

      // ── Special system runs first at highest priority ──
      // Returns true while a special is in progress (super-flash or active sequence).
      // During super-flash the game completely freezes — no player or combat updates.
      const specialActive = this.specials.update(dt);

      if (!specialActive) {
        // Normal combat processing
        this.p1.update(p1Input, dt, this.stageLeft, this.stageRight, this.p2, settings);
        this.p2.update(p2Input, dt, this.stageLeft, this.stageRight, this.p1, settings);
        this.combat.update(this.p1, this.p2, this.stageLeft, this.stageRight, dt);
      } else if (!this.specials.superFlashActive) {
        // Special sequence is active but super-flash is done:
        // players still need physics applied (gravity, THROWN landing etc.)
        // but no input or hit detection.
        const frozen = {};
        this.p1.update(frozen, dt, this.stageLeft, this.stageRight, this.p2, settings);
        this.p2.update(frozen, dt, this.stageLeft, this.stageRight, this.p1, settings);
        // Skip combat.update() — special system owns hit resolution
      }
      // If superFlashActive: total freeze, nothing updates

    } else if (this.gameState === GAME_STATE.ROUND_END || this.gameState === GAME_STATE.INTRO) {
      const frozen = {};
      this.p1.update(frozen, dt, this.stageLeft, this.stageRight, this.p2, settings);
      this.p2.update(frozen, dt, this.stageLeft, this.stageRight, this.p1, settings);
    }

    // ── HUD ──
    updateHealthBar('hud-health-fill-p1', this.p1.health, this.p1.maxHealth);
    updateHealthBar('hud-health-fill-p2', this.p2.health, this.p2.maxHealth);
    updateMeterBar('hud-meter-fill-p1', this.p1.meter, this.p1.maxMeter);
    updateMeterBar('hud-meter-fill-p2', this.p2.meter, this.p2.maxMeter);

    // ── VFX ──
    this._updateEffects(dt);

    // ── Screen shake ──
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt / (1000 / 60);
    }

    // ── Stage ──
    this.stageRenderer.update(dt);

    // ── Input flush ──
    inputManager.flush();

    // ── Debug ──
    if (this.settings.debugMode) this._updateDebug();
  }

  _readP1Input() {
    const km = KEYMAP_P1;
    return {
      moveLeft:    inputManager.actionDown('moveLeft', km),
      moveRight:   inputManager.actionDown('moveRight', km),
      jump:        inputManager.actionPressed('jump', km),
      crouch:      inputManager.actionDown('crouch', km),
      lightAttack: inputManager.actionPressed('lightAttack', km),
      heavyAttack: inputManager.actionPressed('heavyAttack', km),
      kick:        inputManager.actionPressed('kick', km),
      special:     inputManager.actionPressed('special', km),
      grab:        inputManager.actionPressed('grab', km),
      block:       inputManager.actionDown('block', km),
    };
  }

  _readP2Input() {
    const km = KEYMAP_P2;
    return {
      moveLeft:    inputManager.actionDown('moveLeft', km),
      moveRight:   inputManager.actionDown('moveRight', km),
      jump:        inputManager.actionPressed('jump', km),
      crouch:      inputManager.actionDown('crouch', km),
      lightAttack: inputManager.actionPressed('lightAttack', km),
      heavyAttack: inputManager.actionPressed('heavyAttack', km),
      kick:        inputManager.actionPressed('kick', km),
      special:     inputManager.actionPressed('special', km),
      grab:        inputManager.actionPressed('grab', km),
      block:       inputManager.actionDown('block', km),
    };
  }

  // ══════════════════════════════════════════════════
  //  RENDERING
  // ══════════════════════════════════════════════════

  _render() {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    // Camera shake offset
    let shakeX = 0, shakeY = 0;
    if (this._shakeTimer > 0) {
      const s = this._shakeIntensity * (this._shakeTimer / 10);
      shakeX = (Math.random() - 0.5) * s;
      shakeY = (Math.random() - 0.5) * s * 0.5;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ── Background ──
    this.stageRenderer.draw(ctx, W, H, this.groundY);

    // ── Ground cracks ──
    this._drawGroundCracks(ctx);

    // ── Characters ──
    const dbg       = this.settings.debugMode || this.settings.showHitboxes;
    const frameData = this.settings.debugMode; // frame data only in full debug
    this.p1.draw(ctx, dbg, frameData);
    this.p2.draw(ctx, dbg, frameData);

    // ── Hit effects ──
    this._drawEffects(ctx);

    // ── Counter-hit label ──
    if (this._counterHitDisplay && this._counterHitDisplay.timer > 0) {
      const ch = this._counterHitDisplay;
      ch.timer--;
      const alpha = Math.min(1, ch.timer / 20);
      const yOff  = (90 - ch.timer) * 0.5;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font        = 'bold 18px Orbitron, monospace';
      ctx.fillStyle   = '#ff8800';
      ctx.textAlign   = 'center';
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur  = 12;
      ctx.fillText('COUNTER HIT!', ch.x, ch.y - yOff);
      ctx.restore();
    }

    ctx.restore(); // end shake transform

    // ── Super-flash overlay (drawn outside shake so it fills the screen cleanly) ──
    if (this.specials.superFlashActive) {
      this._drawSuperFlash(ctx, W, H);
    }

    // ── Special move name banner ──
    if (this._specialBanner && this._specialBanner.timer > 0) {
      this._drawSpecialBanner(ctx, W, H);
    }

    // ── FPS counter (debug only) ──
    if (this.settings.debugMode && this._fpsDisplay) {
      ctx.fillStyle = '#0f0';
      ctx.font = '12px monospace';
      ctx.fillText(this._fpsDisplay, 8, H - 10);
    }
  }

  _drawSuperFlash(ctx, W, H) {
    const t = this.specials._superFlashTimer;
    const activeChar = this.specials.getActiveCharId();
    // Flash color: white for Marcus (power), dark-red for Vesper (speed)
    const flashColor = activeChar === 'marcus' ? 'rgba(255,255,255,' : 'rgba(200,40,40,';
    const alpha = Math.min(0.85, t / 80);
    ctx.fillStyle = flashColor + alpha + ')';
    ctx.fillRect(0, 0, W, H);

    // Move name text
    const moveName = activeChar === 'marcus' ? 'SEISMIC SLAM EX' : 'PHANTOM FLURRY';
    const textColor = activeChar === 'marcus' ? '#ff8800' : '#cc2a2a';
    const glowColor = activeChar === 'marcus' ? '#ffaa00' : '#ff4444';
    ctx.save();
    ctx.font        = `bold ${Math.floor(W * 0.06)}px Orbitron, sans-serif`;
    ctx.fillStyle   = textColor;
    ctx.textAlign   = 'center';
    ctx.shadowColor = glowColor;
    ctx.shadowBlur  = 30;
    ctx.globalAlpha = Math.min(1, t / 60);
    ctx.fillText(moveName, W / 2, H / 2);
    ctx.restore();
  }

  _drawSpecialBanner(ctx, W, H) {
    const b = this._specialBanner;
    b.timer--;
    const alpha = Math.min(1, b.timer / 20);
    const yOff  = (b.maxTimer - b.timer) * 0.3;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font        = `bold ${Math.floor(W * 0.04)}px Orbitron, sans-serif`;
    ctx.fillStyle   = b.color || '#ffd700';
    ctx.textAlign   = 'center';
    ctx.shadowColor = b.glow || '#ff8800';
    ctx.shadowBlur  = 20;
    ctx.fillText(b.text, W / 2, H * 0.25 - yOff);
    ctx.restore();
  }

  // ══════════════════════════════════════════════════
  //  VFX
  // ══════════════════════════════════════════════════

  _addHitEffect(x, y, type, isCounterHit = false) {
    // ── Color palettes per effect type ──
    const palettes = {
      light:           ['#ffffff', '#ffdd88'],
      heavy:           ['#ffffff', '#ff8844', '#ffaa00'],
      slam:            ['#ffffff', '#ff4422', '#ffaa00', '#ff6644'],
      grab:            ['#ffaa00', '#ff6622', '#ffffff'],
      wallSplat:       ['#ffffff', '#aaddff', '#66aaff'],
      armor:           ['#ffd700', '#ffaa00', '#ffffff'],
      // Marcus Seismic Slam EX specials
      seismicActivate: ['#ff8800', '#ffcc00', '#ffffff', '#ff4400'],
      seismicImpact:   ['#ff6600', '#ffaa00', '#ffffff', '#ff3300', '#ffdd00'],
      // Vesper Phantom Flurry specials
      vesperActivate:  ['#cc2a2a', '#ff6666', '#ffffff', '#8acce8'],
      vesperSlash:     ['#8acce8', '#ffffff', '#cceeff', '#4488cc'],
      vesperFinisher:  ['#cc2a2a', '#ff4444', '#ffffff', '#ff8888', '#8acce8'],
    };

    let baseColors = palettes[type] || palettes.light;
    if (isCounterHit) baseColors = ['#ff8800', '#ffcc00', '#ffffff', '#ff4400'];

    // Particle counts and speeds per type
    const counts = {
      seismicImpact: 30, seismicActivate: 20,
      vesperFinisher: 20, vesperSlash: 6, vesperActivate: 14,
      slam: 18, grab: 18, heavy: 12,
    };
    const speeds = {
      seismicImpact: 6, seismicActivate: 5,
      vesperFinisher: 5, slam: 4.5, grab: 4.5, heavy: 3,
    };

    const count     = counts[type]  ?? (isCounterHit ? 10 : 7);
    const baseSpeed = speeds[type]  ?? (isCounterHit ? 3.5 : 2.5);
    const isBig     = ['seismicImpact', 'slam', 'grab', 'vesperFinisher'].includes(type);

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.6;
      const speed = baseSpeed + Math.random() * 2;
      this._effects.push({
        type:     'spark',
        x, y,
        vx:       Math.cos(angle) * speed,
        vy:       Math.sin(angle) * speed - (isBig ? 2.5 : 1),
        timer:    18 + Math.random() * 10,
        maxTimer: 28,
        color:    baseColors[Math.floor(Math.random() * baseColors.length)],
        size:     (isCounterHit ? 3.5 : isBig ? 3 : 2) + Math.random() * (isBig ? 6 : 3),
      });
    }

    // Impact flash
    const flashRadii = {
      seismicImpact: 100, seismicActivate: 60,
      vesperFinisher: 65, vesperActivate: 40,
      slam: 70, grab: 70, heavy: 45,
    };
    this._effects.push({
      type:     'flash',
      x, y,
      timer:    6,
      maxTimer: 6,
      radius:   flashRadii[type] ?? (isCounterHit ? 35 : 25),
      color:    isCounterHit ? '#ff8800' : baseColors[0],
    });

    // Show special move name banner for signature moves
    if (type === 'seismicActivate') {
      this._specialBanner = { text: 'SEISMIC SLAM EX', color: '#ff8800', glow: '#ffaa00', timer: 90, maxTimer: 90 };
    } else if (type === 'vesperActivate') {
      this._specialBanner = { text: 'PHANTOM FLURRY', color: '#cc2a2a', glow: '#ff4444', timer: 90, maxTimer: 90 };
    }

    // Audio
    const sfxMap = {
      light: 'lightHit', heavy: 'heavyHit', kick: 'kickHit',
      slam: 'slam', grab: 'grab', wallSplat: 'wallImpact', armor: 'armorAbsorb',
      seismicActivate: 'specialActivate', seismicImpact: 'seismicImpact',
      vesperActivate: 'specialActivate', vesperSlash: 'flurrySlash', vesperFinisher: 'flurryFinish',
    };
    audioManager.play(sfxMap[type] || 'lightHit');
  }

  // ── New special VFX: expanding shockwave ring ──
  _addShockwave(x, y) {
    this._effects.push({
      type:     'shockwave',
      x, y,
      timer:    30,
      maxTimer: 30,
      radius:   0,
      maxRadius: 200,
    });
  }

  // ── New special VFX: dust cloud puff ──
  _addDustCloud(x, y) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI + (Math.random() - 0.5) * Math.PI; // upward hemisphere
      const speed = 1.5 + Math.random() * 2.5;
      this._effects.push({
        type:     'dust',
        x:        x + (Math.random() - 0.5) * 30,
        y,
        vx:       Math.cos(angle) * speed,
        vy:       Math.sin(angle) * speed - 1,
        timer:    35 + Math.random() * 20,
        maxTimer: 55,
        size:     8 + Math.random() * 18,
      });
    }
  }

  // ── New special VFX: speed lines for Vesper dash ──
  _addSpeedLine(x, y, dir, moveDef) {
    const color = (moveDef && moveDef.speedLineColor) || '#cc2a2a';
    const len   = 60 + Math.random() * 80;
    this._effects.push({
      type:   'speedline',
      x,
      y:      y - 160 + Math.random() * 180, // scattered vertically across body
      dir,
      len,
      timer:    6 + Math.random() * 4,
      maxTimer: 10,
      color,
    });
  }

  _addGroundCrack(x, y) {
    this._groundCracks.push({ x, y, timer: 180, maxTimer: 180 });
  }

  _updateEffects(dt) {
    const frameTime = dt / (1000 / 60);
    for (let i = this._effects.length - 1; i >= 0; i--) {
      const e = this._effects[i];
      e.timer -= frameTime;
      if (e.timer <= 0) {
        this._effects.splice(i, 1);
        continue;
      }
      if (e.type === 'spark') {
        e.x  += e.vx * frameTime;
        e.y  += e.vy * frameTime;
        e.vy += 0.3 * frameTime; // gravity on sparks
      } else if (e.type === 'dust') {
        e.x  += e.vx * frameTime;
        e.y  += e.vy * frameTime;
        e.vy += 0.08 * frameTime;
        e.vx *= 0.96;
      } else if (e.type === 'shockwave') {
        e.radius = e.maxRadius * (1 - e.timer / e.maxTimer);
      }
      // speedline & flash: no position update
    }

    for (let i = this._groundCracks.length - 1; i >= 0; i--) {
      this._groundCracks[i].timer -= frameTime;
      if (this._groundCracks[i].timer <= 0) {
        this._groundCracks.splice(i, 1);
      }
    }
  }

  _drawEffects(ctx) {
    for (const e of this._effects) {
      const progress = e.timer / e.maxTimer;

      if (e.type === 'spark') {
        ctx.save();
        ctx.globalAlpha = progress;
        ctx.fillStyle   = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, Math.max(0.5, e.size * progress), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (e.type === 'flash') {
        ctx.save();
        ctx.globalAlpha = progress * 0.65;
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius * (2 - progress));
        grad.addColorStop(0, e.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * (2 - progress), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (e.type === 'shockwave') {
        ctx.save();
        ctx.globalAlpha  = progress * 0.75;
        ctx.strokeStyle  = '#ff8844';
        ctx.lineWidth    = Math.max(1, 6 * progress);
        ctx.shadowColor  = '#ff6600';
        ctx.shadowBlur   = 14;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha  = progress * 0.3;
        ctx.lineWidth    = Math.max(0.5, 2.5 * progress);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

      } else if (e.type === 'dust') {
        ctx.save();
        ctx.globalAlpha = progress * 0.5;
        ctx.fillStyle   = '#c8a070';
        const r = e.size * (1 + (1 - progress) * 0.4);
        ctx.beginPath();
        ctx.arc(e.x, e.y, Math.max(1, r), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

      } else if (e.type === 'speedline') {
        ctx.save();
        ctx.globalAlpha = progress * 0.75;
        ctx.strokeStyle = e.color;
        ctx.lineWidth   = 1.5;
        const x1 = e.dir > 0 ? e.x - e.len : e.x;
        const x2 = e.dir > 0 ? e.x : e.x + e.len;
        ctx.beginPath();
        ctx.moveTo(x1, e.y);
        ctx.lineTo(x2, e.y);
        ctx.stroke();
        ctx.globalAlpha = progress * 0.35;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth   = 0.6;
        ctx.beginPath();
        ctx.moveTo(x1, e.y);
        ctx.lineTo(x2, e.y);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  _drawGroundCracks(ctx) {
    for (const crack of this._groundCracks) {
      const progress = crack.timer / crack.maxTimer;
      ctx.save();
      ctx.globalAlpha = progress * 0.8;
      ctx.strokeStyle = '#ff6622';
      ctx.lineWidth = 2;

      // Radiating crack lines
      const numCracks = 7;
      for (let i = 0; i < numCracks; i++) {
        const angle = (Math.PI * 2 / numCracks) * i + 0.3;
        const len   = (30 + i * 12) * progress;
        ctx.beginPath();
        ctx.moveTo(crack.x, crack.y);
        ctx.lineTo(
          crack.x + Math.cos(angle) * len,
          crack.y + Math.sin(angle) * len * 0.4
        );
        ctx.stroke();
      }

      // Central glow
      ctx.globalAlpha = progress * 0.4;
      const grd = ctx.createRadialGradient(crack.x, crack.y, 0, crack.x, crack.y, 35);
      grd.addColorStop(0, '#ff8844');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(crack.x, crack.y, 35, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ══════════════════════════════════════════════════
  //  SCREEN SHAKE
  // ══════════════════════════════════════════════════

  _triggerShake(intensity) {
    this._shakeIntensity = intensity;
    this._shakeTimer     = Math.min(intensity, 15);
  }

  // ══════════════════════════════════════════════════
  //  COMBO CALLBACK
  // ══════════════════════════════════════════════════

  _onComboUpdate(attacker, hits, totalDamage) {
    if (hits > attacker.maxCombo) attacker.maxCombo = hits;
    attacker.comboCount = hits;
    showCombo(hits, totalDamage);

    // Auto-hide combo after a delay
    clearTimeout(this._comboHideTimeout);
    this._comboHideTimeout = setTimeout(() => hideCombo(), 2000);
  }

  // ── Counter-hit display ──
  _onCounterHit(attacker, defender) {
    // Flash a "COUNTER HIT" label briefly on the canvas
    this._counterHitDisplay = { timer: 90, x: defender.x, y: defender.y - 200 };
    audioManager.play('heavyHit'); // slightly different sound cue
  }

  // ══════════════════════════════════════════════════
  //  PAUSE
  // ══════════════════════════════════════════════════

  _onPauseKey(e) {
    if (e.code === 'Escape') {
      if (this.gameState === GAME_STATE.PAUSED) {
        this._resume();
      } else if (this.gameState === GAME_STATE.FIGHT) {
        this._pause();
      }
      return;
    }
    // F1 = toggle debug mode in-game
    if (e.code === 'F1') {
      this.settings.debugMode = !this.settings.debugMode;
      if (this.settings.debugMode && !this._debugEl) this._setupDebug();
      if (!this.settings.debugMode && this._debugEl) {
        this._debugEl.style.display = 'none';
      } else if (this.settings.debugMode && this._debugEl) {
        this._debugEl.style.display = '';
      }
      e.preventDefault();
    }
    // F2 = toggle hitbox visualization only (no frame data text)
    if (e.code === 'F2') {
      this.settings.showHitboxes = !this.settings.showHitboxes;
      e.preventDefault();
    }
  }

  _pause() {
    this.gameState = GAME_STATE.PAUSED;
    showPause();
  }

  _resume() {
    if (this.gameState !== GAME_STATE.PAUSED) return;
    this.gameState = GAME_STATE.FIGHT;
    hidePause();
    this._lastTimestamp = performance.now();
  }

  _setupPauseButtons() {
    const resumeBtn  = document.getElementById('pause-resume');
    const restartBtn = document.getElementById('pause-restart');
    const quitBtn    = document.getElementById('pause-quit');

    if (resumeBtn)  resumeBtn.onclick  = () => this._resume();
    if (restartBtn) restartBtn.onclick = () => {
      hidePause();
      this.gameState = GAME_STATE.FIGHT;
      this._beginRound(1);
      this.p1RoundWins = 0;
      this.p2RoundWins = 0;
      this.p1RoundArr  = [false, false, false];
      this.p2RoundArr  = [false, false, false];
    };
    if (quitBtn) quitBtn.onclick = () => {
      hidePause();
      this.destroy();
      if (this.onMatchEnd) this.onMatchEnd(null, null); // null = quit
    };

    // Pause menu keyboard nav
    const btns = [resumeBtn, restartBtn, quitBtn].filter(Boolean);
    let activeIdx = 0;
    const updateActive = () => btns.forEach((b, i) => b.classList.toggle('active', i === activeIdx));

    document.addEventListener('keydown', (e) => {
      if (this.gameState !== GAME_STATE.PAUSED) return;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        activeIdx = (activeIdx + 1) % btns.length;
        updateActive();
        e.preventDefault();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        activeIdx = (activeIdx - 1 + btns.length) % btns.length;
        updateActive();
        e.preventDefault();
      } else if (e.code === 'Enter') {
        btns[activeIdx]?.click();
        e.preventDefault();
      }
    });
  }

  // ══════════════════════════════════════════════════
  //  DEBUG
  // ══════════════════════════════════════════════════

  _setupDebug() {
    let el = document.getElementById('debug-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'debug-overlay';
      el.style.cssText = [
        'position:absolute', 'top:80px', 'left:8px',
        'z-index:100', 'pointer-events:none',
        'font:11px/1.5 monospace', 'color:#00ff88',
        'background:rgba(0,0,0,0.72)', 'padding:8px 10px',
        'white-space:pre', 'border-left:2px solid #00ff88',
        'max-width:380px',
      ].join(';');
      document.getElementById('screen-gameplay')?.appendChild(el);
    }
    this._debugEl    = el;
    this._frameCount = 0;
    this._fpsTimer   = 0;
    this._fps        = 0;
  }

  _updateDebug() {
    if (!this._debugEl) return;
    this._frameCount++;
    this._fpsTimer += 16;
    if (this._fpsTimer >= 1000) {
      this._fps        = this._frameCount;
      this._frameCount = 0;
      this._fpsTimer   = 0;
      this._fpsDisplay = `FPS: ${this._fps}`;
    }

    const _fmtPlayer = (p, label) => {
      const md  = p.currentMoveDef;
      const af  = Math.floor(p.attackFrame);
      let phase = '-';
      if (md) {
        if (af < md.startup)                  phase = `startup(${md.startup - af})`;
        else if (af < md.startup + md.active) phase = `ACTIVE(${md.startup + md.active - af})`;
        else                                   phase = `recovery(${md.startup + md.active + md.recovery - af})`;
      }
      return (
        `${label} [${p.charData.id}]  x:${Math.round(p.x)}  y:${Math.round(p.y)}\n` +
        `  vx:${p.vx.toFixed(1)}  vy:${p.vy.toFixed(1)}  onGnd:${p.onGround ? 'Y' : 'N'}\n` +
        `  state:${p.state.padEnd(12)}  hp:${p.health}/${p.maxHealth}  meter:${Math.round(p.meter)}\n` +
        `  anim:${p.animator.currentAnim}[${p.animator.currentFrame}]` +
        `  move:${md ? md.name : '-'}  frame:${af}  phase:${phase}\n` +
        `  hitstun:${p.hitstunTimer.toFixed(0)}  blkstun:${p.blockstunTimer.toFixed(0)}` +
        `  invuln:${p.invincibleTimer.toFixed(0)}  armor:${p.hasArmor ? 'ON' : 'off'}\n` +
        `  wallSplat:${p.wallSplatTimer.toFixed(0)}  grabCD:${p.grabCooldown.toFixed(0)}\n`
      );
    };

    this._debugEl.textContent =
      `FPS:${this._fps}  [F1]=full debug  [F2]=hitboxes only\n` +
      `Round:${this.currentRound}  P1W:${this.p1RoundWins}  P2W:${this.p2RoundWins}  ` +
      `Timer:${this._roundTimerMs === Infinity ? '∞' : (this._roundTimerMs / 1000).toFixed(1)}s\n` +
      `Grab sequence: ${this.combat.isGrabSequenceActive() ? 'ACTIVE' : 'none'}\n` +
      `─────────────────────────────────────────\n` +
      _fmtPlayer(this.p1, 'P1') +
      `─────────────────────────────────────────\n` +
      _fmtPlayer(this.p2, 'P2');
  }

  // ══════════════════════════════════════════════════
  //  LIFECYCLE
  // ══════════════════════════════════════════════════

  stopLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  destroy() {
    this.stopLoop();
    window.removeEventListener('resize',  this._resizeHandler);
    window.removeEventListener('keydown', this._pauseHandler);

    const debugEl = document.getElementById('debug-overlay');
    if (debugEl) debugEl.remove();

    if (this.specials) this.specials.reset();
    window._ifl_collision = null;
    clearTimeout(this._comboHideTimeout);
  }
}
