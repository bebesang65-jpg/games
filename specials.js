/**
 * IRON FIST LEAGUE — Special Moves System
 *
 * Manages the unique gameplay logic for signature moves.
 * Each special has dedicated phases, physics, and VFX that go beyond
 * what the generic combat loop can express.
 *
 * Marcus  – SEISMIC SLAM EX
 *   Phase 1 SUPERFLASH  : brief game freeze + flash (cinematic activation)
 *   Phase 2 GRAB         : hitbox active, grabs defender into GRABBED state
 *   Phase 3 LIFT         : Marcus holds opponent overhead (liftFrames duration)
 *   Phase 4 SLAM         : drives them into the ground (slamFrames duration)
 *   Phase 5 IMPACT       : damage, ground crack, shockwave ring, double shake
 *   Phase 6 RECOVERY     : Marcus recovers, defender in KNOCKDOWN
 *
 * Vesper – PHANTOM FLURRY
 *   Phase 1 SUPERFLASH  : (very short) activation flash
 *   Phase 2 DASH        : Vesper dashes through opponent with invincibility,
 *                         spawning afterimages, dealing sub-hits 1-5
 *   Phase 3 FINISHER    : Vesper reappears behind with explosive strike
 *   Phase 4 RECOVERY    : Vesper lands, opponent launched
 *
 * All configurable values come from the move definition in characters.js.
 * This module registers its own callbacks on the CombatSystem.
 */

import { STATE }   from './player.js';
import { getHurtbox } from './collision.js';

// ── Super-flash duration override (ms) — short but visible ──
const SUPERFLASH_FALLBACK_MS = 200;

// ─────────────────────────────────────────────────────────────
//  MARCUS — SEISMIC SLAM EX
// ─────────────────────────────────────────────────────────────

/**
 * Phase enum for Marcus's special.
 * Stored on the active sequence object.
 */
const SEISMIC_PHASE = {
  SUPERFLASH: 'superflash',
  GRAB:       'grab',      // hitbox active (handled by CombatSystem)
  LIFT:       'lift',      // holding opponent overhead
  SLAM:       'slam',      // driving down
  IMPACT:     'impact',    // impact frame — VFX burst
  DONE:       'done',
};

/**
 * Vesper dash phase enum.
 */
const FLURRY_PHASE = {
  SUPERFLASH: 'superflash',
  DASH:       'dash',      // moving through opponent
  FINISHER:   'finisher',  // final hit behind opponent
  RECOVERY:   'recovery',
  DONE:       'done',
};

export class SpecialSystem {
  /**
   * @param {Object} vfx - reference to GameEngine's VFX methods:
   *   { addHitEffect, addGroundCrack, triggerShake, addEffect, addShockwave,
   *     addSpeedLines, freezeGame, unfreezeGame, addDustCloud }
   * @param {Object} audio - audioManager reference
   */
  constructor(vfx, audio) {
    this._vfx   = vfx;
    this._audio = audio;

    // Active special sequence state (one at a time — only one special fires at once)
    this._sequence   = null;

    // Super-flash state (game engine checks this each frame)
    this.superFlashActive = false;
    this._superFlashTimer = 0;
  }

  // ══════════════════════════════════════════════════
  //  PER-FRAME UPDATE
  // ══════════════════════════════════════════════════

  /**
   * Called from game.js _update() before combat.update().
   * @param {number} dt - delta time ms
   * @returns {boolean} true if a sequence is in progress (game should not process normal combat)
   */
  update(dt) {
    const ft = dt / (1000 / 60);

    // ── Super-flash tick ──
    if (this.superFlashActive) {
      this._superFlashTimer -= dt;
      if (this._superFlashTimer <= 0) {
        this.superFlashActive = false;
        if (this._sequence) this._sequence.phase = this._sequence.postFlashPhase;
      }
      return true; // freeze everything
    }

    if (!this._sequence) return false;

    const seq = this._sequence;

    if (seq.charId === 'marcus') {
      return this._updateSeismicSlam(seq, ft, dt);
    } else if (seq.charId === 'vesper') {
      return this._updatePhantomFlurry(seq, ft, dt);
    }

    return false;
  }

  // ══════════════════════════════════════════════════
  //  ACTIVATION ENTRY POINTS
  //  Called by CombatSystem when special hitbox connects (for grab)
  //  or by Player when special is executed (for dash).
  // ══════════════════════════════════════════════════

  /**
   * Activate Marcus Seismic Slam EX grab sequence.
   * Called by CombatSystem._startGrabSequence when moveDef has isSpecial flag.
   */
  activateSeismicSlam(attacker, defender, moveDef) {
    if (this._sequence) return; // already in a sequence

    const sfms = moveDef.superFlashMs || SUPERFLASH_FALLBACK_MS;

    // Defender enters GRABBED — frozen
    defender.setState(STATE.GRABBED);
    defender.animator.play('grabbed');
    defender.vx = 0;
    defender.vy = 0;

    // Attacker gains invincibility during lift+slam
    if (moveDef.invincible) {
      attacker.invincibleTimer = moveDef.invincibleFrames || 24;
    }

    this._sequence = {
      charId:   'marcus',
      attacker, defender, moveDef,
      phase:    SEISMIC_PHASE.SUPERFLASH,
      postFlashPhase: SEISMIC_PHASE.LIFT,
      timer:    moveDef.liftFrames || 18,
      offsetX:  defender.x - attacker.x,  // relative horizontal lock
    };

    // Super-flash
    this._startSuperFlash(sfms);

    // VFX: activation burst
    this._vfx.addHitEffect(
      attacker.x + attacker.facing * 50,
      attacker.y - 100,
      'seismicActivate', false
    );
    this._audio.play(moveDef.sfxActivate || 'specialActivate');
  }

  /**
   * Activate Vesper Phantom Flurry.
   * Called from Player._executeMove when the special is initiated.
   */
  activatePhantomFlurry(attacker, opponent, moveDef) {
    if (this._sequence) return;

    const sfms = 120; // shorter super-flash for speed character

    // Vesper gains invincibility for the dash
    if (moveDef.invincible) {
      attacker.invincibleTimer = moveDef.invincibleFrames || 20;
    }

    const dashDir = attacker.facing;
    const subHitInterval = (moveDef.active || 22) / ((moveDef.hits || 6) - 1);

    this._sequence = {
      charId:    'vesper',
      attacker, opponent, moveDef,
      phase:     FLURRY_PHASE.SUPERFLASH,
      postFlashPhase: FLURRY_PHASE.DASH,
      timer:     moveDef.active || 22,
      subHitsLanded: 0,

      // Dash trajectory: start at attacker, move to and past opponent
      dashDir,
      dashStartX:  attacker.x,
      dashTargetX: opponent.x + dashDir * (moveDef.dashOvershoot || 55),
      dashProgress: 0,

      // Sub-hit intervals — first sub-hit lands after 1 full interval
      subHitInterval,
      nextSubHitTimer: subHitInterval,

      finisherDone: false,
    };

    this._startSuperFlash(sfms);

    // VFX: activation flash
    this._vfx.addHitEffect(
      attacker.x + attacker.facing * 30,
      attacker.y - 90,
      'vesperActivate', false
    );
    this._audio.play(moveDef.sfxActivate || 'specialActivate');
  }

  // ══════════════════════════════════════════════════
  //  MARCUS — SEISMIC SLAM EX PHASES
  // ══════════════════════════════════════════════════

  _updateSeismicSlam(seq, ft, dt) {
    const { attacker, defender, moveDef } = seq;

    switch (seq.phase) {

      case SEISMIC_PHASE.LIFT: {
        // Lock defender above Marcus's head
        const liftHeight = moveDef.liftHeight || 205;
        defender.x  = attacker.x + seq.offsetX;
        defender.y  = attacker.y - liftHeight;
        defender.vx = 0;
        defender.vy = 0;
        defender.onGround = false;

        // Disable normal hitbox — SpecialSystem owns all damage resolution
        attacker.attackActive = false;

        // Play overhead-hold pose for Marcus
        if (attacker.animator.currentAnim !== 'special') {
          attacker.animator.play('special');
        }

        seq.timer -= ft;
        if (seq.timer <= 0) {
          seq.phase = SEISMIC_PHASE.SLAM;
          seq.timer = moveDef.slamFrames || 10;
          this._vfx.triggerShake(5);
        }
        return true;
      }

      case SEISMIC_PHASE.SLAM: {
        // Interpolate downward: defender descends from overhead to floor
        const slamProgress = 1 - (seq.timer / (moveDef.slamFrames || 10));
        const liftH  = moveDef.liftHeight || 205;
        const startY = attacker.y - liftH;
        const endY   = defender.floorY;
        defender.x  = attacker.x + seq.offsetX;
        defender.y  = startY + (endY - startY) * this._easeInQuad(slamProgress);
        defender.vx = 0;
        defender.vy = 0;
        attacker.attackActive = false;

        seq.timer -= ft;
        if (seq.timer <= 0) {
          seq.phase = SEISMIC_PHASE.IMPACT;
        }
        return true;
      }

      case SEISMIC_PHASE.IMPACT: {
        // ── ONE FRAME OF IMPACT ──
        seq.phase = SEISMIC_PHASE.DONE;

        const scale   = 1.0; // first hit of combo
        const rawDmg  = Math.floor(moveDef.damage * attacker.charData.damageMultiplier * scale);

        // Health
        if (!defender._settings?.infiniteHealth) {
          defender.health = Math.max(0, defender.health - rawDmg);
        }
        defender._gainMeter(15);
        attacker.gainMeterOnHit(rawDmg);
        attacker.totalDamageDealt += rawDmg;

        // Landing physics — pin defender at floor
        defender.x        = attacker.x + seq.offsetX;
        defender.y        = defender.floorY;
        defender.vx       = 0;
        defender.vy       = 0;
        defender.onGround = true;

        // Hard knockdown
        defender.setState(STATE.KNOCKDOWN);
        defender.knockdownTimer = 80; // extra-long knockdown after EX slam
        defender.animator.play('knockdown');

        // ── VFX BURST ──
        const ix = defender.x;
        const iy = defender.floorY;

        // Massive spark burst at ground
        this._vfx.addHitEffect(ix, iy - 20, 'seismicImpact', false);

        // Ground crack
        this._vfx.addGroundCrack(ix, iy);

        // Shockwave ring
        if (moveDef.shockwaveRing !== false) {
          this._vfx.addShockwave(ix, iy);
        }

        // Dust clouds on either side
        if (moveDef.dustClouds !== false) {
          this._vfx.addDustCloud(ix - 60, iy);
          this._vfx.addDustCloud(ix + 60, iy);
        }

        // Wave-1 shake: immediate, violent
        this._vfx.triggerShake(18);

        // Wave-2 shake: delayed bounce
        if (moveDef.screenShakeWave2) {
          setTimeout(() => this._vfx.triggerShake(10), 120);
          setTimeout(() => this._vfx.triggerShake(6),  260);
        }

        // Audio
        this._audio.play(moveDef.sfxImpact || 'slam');

        // KO check
        if (defender.health <= 0 && this._vfx.onKO) {
          this._vfx.onKO(defender);
        }

        // Combo tracking callback
        if (this._vfx.onComboUpdate) {
          this._vfx.onComboUpdate(attacker, 1, rawDmg);
        }

        return true;
      }

      case SEISMIC_PHASE.DONE: {
        this._sequence = null;
        // Marcus enters recovery — restore attack state machine control
        // (attackFrame will continue ticking in _updateAttackState)
        return false;
      }

      default:
        return false;
    }
  }

  // ══════════════════════════════════════════════════
  //  VESPER — PHANTOM FLURRY PHASES
  // ══════════════════════════════════════════════════

  _updatePhantomFlurry(seq, ft, dt) {
    const { attacker, opponent, moveDef } = seq;

    switch (seq.phase) {

      case FLURRY_PHASE.DASH: {
        // ── Advance dash progress ──
        const totalFrames = moveDef.active || 22;
        const speed       = ft / totalFrames; // 0..1 per frame
        seq.dashProgress  = Math.min(1, seq.dashProgress + speed);

        // Interpolate Vesper's position through and past the opponent
        const startX  = seq.dashStartX;
        const targetX = seq.dashTargetX;
        attacker.x = startX + (targetX - startX) * this._easeInOutCubic(seq.dashProgress);

        // Face opponent throughout dash
        attacker.facing = seq.dashDir;
        attacker.vx = 0; // physics overridden

        // ── Spawn afterimage at current position each frame ──
        if (moveDef.afterimage !== false) {
          attacker.afterimages.push({
            x:      attacker.x,
            y:      attacker.y,
            facing: attacker.facing,
            alpha:  moveDef.afterimageAlpha || 0.65,
          });
        }

        // ── Speed lines (horizontal streaks) ──
        if (Math.random() < 0.6) {
          this._vfx.addSpeedLine(attacker.x, attacker.y, seq.dashDir, moveDef);
        }

        // ── Sub-hit registration ──
        seq.nextSubHitTimer -= ft;
        const maxSubHits = (moveDef.hits || 6) - 1; // last hit is finisher

        if (seq.nextSubHitTimer <= 0 && seq.subHitsLanded < maxSubHits) {
          seq.nextSubHitTimer = seq.subHitInterval;

          // Check if opponent is in range
          const hurtbox = getHurtbox(opponent);
          const hitX    = attacker.x + attacker.facing * 30;
          if (hitX > hurtbox.x && hitX < hurtbox.x + hurtbox.w) {
            this._applySubHit(seq, false);
          }
        }

        // ── Transition to finisher when at target ──
        if (seq.dashProgress >= 1) {
          seq.phase = FLURRY_PHASE.FINISHER;
          seq.timer = 8; // brief pause at finisher position
          attacker.facing = -seq.dashDir; // now facing the opponent from behind
        }

        return true;
      }

      case FLURRY_PHASE.FINISHER: {
        seq.timer -= ft;

        if (seq.timer <= 0 && !seq.finisherDone) {
          seq.finisherDone = true;

          // ── Final sub-hit (the explosive finisher) ──
          this._applySubHit(seq, true);

          seq.phase = FLURRY_PHASE.RECOVERY;
          seq.timer = 8;
        }
        return true;
      }

      case FLURRY_PHASE.RECOVERY: {
        seq.timer -= ft;
        // Re-enable physics for Vesper
        attacker.vx = 0;
        if (seq.timer <= 0) {
          seq.phase = FLURRY_PHASE.DONE;
        }
        return true;
      }

      case FLURRY_PHASE.DONE: {
        this._sequence = null;
        // Player's _updateAttackState will handle the remaining recovery frames
        return false;
      }

      default:
        return false;
    }
  }

  _applySubHit(seq, isFinalHit) {
    const { attacker, opponent, moveDef } = seq;

    if (opponent.state === STATE.DEAD) return;
    if (opponent.invincibleTimer > 0) return;

    // Damage scaling — each sub-hit walks down the scale table
    const scaleTable = [1.0, 0.95, 0.90, 0.85, 0.80, 0.75];
    const scaleIdx   = Math.min(seq.subHitsLanded, scaleTable.length - 1);
    const scale      = scaleTable[scaleIdx];

    let   dmg       = isFinalHit
      ? (moveDef.finalHitDamage || moveDef.damage * 1.5)
      : moveDef.damage;
    dmg = Math.floor(dmg * attacker.charData.damageMultiplier * scale);

    const kbX = isFinalHit
      ? (moveDef.finalHitKnockbackX || moveDef.knockbackX * 3)
      : (moveDef.knockbackX || 1.5);
    const kbY = isFinalHit
      ? (moveDef.finalHitKnockbackY || moveDef.knockbackY * 2)
      : (moveDef.knockbackY || 0);

    // Apply damage
    opponent.receiveHit(dmg, {
      ...moveDef,
      knockbackX: kbX,
      knockbackY: kbY,
      hitstun:    isFinalHit ? 22 : (moveDef.hitstun || 7),
      isGrab:     false,
      damage:     dmg,
    }, attacker.facing, false, false);

    attacker.gainMeterOnHit(dmg);
    attacker.totalDamageDealt += dmg;
    seq.subHitsLanded++;

    // ── VFX per sub-hit ──
    const hitX = opponent.x;
    const hitY = opponent.y - 100 + Math.random() * 60;

    if (isFinalHit) {
      this._vfx.addHitEffect(hitX, hitY, 'vesperFinisher', false);
      const shakeIntensity = moveDef.finalHitShake || 8;
      this._vfx.triggerShake(shakeIntensity);
      this._audio.play(moveDef.sfxFinalHit || 'heavyHit');
    } else {
      this._vfx.addHitEffect(hitX, hitY, 'vesperSlash', false);
      this._audio.play(moveDef.sfxSubHit || 'lightHit');
    }

    // Combo callback (each sub-hit counts)
    if (this._vfx.onComboUpdate) {
      this._vfx.onComboUpdate(attacker, seq.subHitsLanded, attacker.totalDamageDealt);
    }

    // KO check
    if (opponent.health <= 0 && this._vfx.onKO) {
      this._vfx.onKO(opponent);
    }
  }

  // ══════════════════════════════════════════════════
  //  SUPER-FLASH
  // ══════════════════════════════════════════════════

  _startSuperFlash(durationMs) {
    this.superFlashActive = true;
    this._superFlashTimer = durationMs;
    // The game engine reads superFlashActive and skips _update() while true
    // but still calls _render() so we see the flash frame
  }

  // ══════════════════════════════════════════════════
  //  EASING FUNCTIONS
  // ══════════════════════════════════════════════════

  _easeInQuad(t)    { return t * t; }
  _easeOutQuad(t)   { return t * (2 - t); }
  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // ══════════════════════════════════════════════════
  //  STATE QUERIES
  // ══════════════════════════════════════════════════

  /** True if a special sequence is running (game.js should skip normal combat) */
  isActive() { return this._sequence !== null || this.superFlashActive; }

  /** Current sequence character id, or null */
  getActiveCharId() { return this._sequence ? this._sequence.charId : null; }

  reset() {
    this._sequence       = null;
    this.superFlashActive = false;
    this._superFlashTimer = 0;
  }
}
