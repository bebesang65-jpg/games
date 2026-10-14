/**
 * IRON FIST LEAGUE — Combat System  (Phase 2)
 *
 * Upgrades over Phase 1:
 *  - Proper GRABBED → THROWN state sequence with position lock & anim sync
 *  - Vesper PHANTOM FLURRY multi-hit (6 discrete sub-hits)
 *  - Cancel window enforcement (cancelInto move list)
 *  - Counter-hit detection (hit during opponent's startup / active)
 *  - Ground vs air hitstun distinction
 *  - Wakeup invincibility respected (hits pass through invincibleTimer > 0)
 *  - Combo window uses defender-side tracking to handle multi-attacker scenarios
 *  - Wall splat gives true stun extension and visual pin
 *  - Armor absorption fires attacker interrupt (attacker vx slowed, no stun)
 */

import { boxOverlap, getHitbox, getHurtbox, resolvePushboxes } from './collision.js';
import { STATE } from './player.js';

// ── Damage scaling table (index = combo hits already landed) ──
const DAMAGE_SCALE = [1.0, 0.95, 0.90, 0.85, 0.80, 0.75, 0.70, 0.65, 0.60, 0.55];
function getDamageScale(idx) {
  return DAMAGE_SCALE[Math.min(idx, DAMAGE_SCALE.length - 1)];
}

// ── Counter-hit bonus ──
const COUNTER_HIT_DAMAGE_MULT = 1.25;
const COUNTER_HIT_STUN_BONUS  = 8;   // extra hitstun frames on counter-hit

// ── Grab throw duration (frames the throw animation plays before impact) ──
const GRAB_THROW_FRAMES = 28;

export class CombatSystem {
  constructor() {
    // ── Combo tracking (per attacker) ──
    this._p1Combo    = 0;
    this._p2Combo    = 0;
    this._p1ComboDmg = 0;
    this._p2ComboDmg = 0;
    this._comboTimeout = 0; // frames until combo window closes

    // ── Per-attack hit flags ── prevents same swing hitting twice
    this._p1HitThisAttack = false;
    this._p2HitThisAttack = false;

    // ── Vesper multi-hit sub-frame tracking ──
    // Tracks how many sub-hits of Vesper's special have landed this activation
    this._p1SpecialSubHits = 0;
    this._p2SpecialSubHits = 0;
    this._p1SubHitCooldown = 0;  // frames before next sub-hit can land
    this._p2SubHitCooldown = 0;

    // ── Grab sequence state ──
    // While a grab sequence is in progress, normal hit detection is suspended
    // for the grabbed player and the attacker locks position.
    this._grabSequence = null; // { attacker, defender, timer, phase }

    // ── Event callbacks (assigned by game.js) ──
    this.onComboUpdate  = null; // (attacker, hits, totalDamage)
    this.onScreenShake  = null; // (intensity)
    this.onGroundCrack  = null; // (x, y)
    this.onHitEffect    = null; // (x, y, type, isCounterHit)
    this.onKO           = null; // (loser)
    this.onCounterHit   = null; // (attacker, defender)
  }

  // ══════════════════════════════════════════════════
  //  PER-FRAME UPDATE
  // ══════════════════════════════════════════════════

  /**
   * @param {import('./player.js').Player} p1
   * @param {import('./player.js').Player} p2
   * @param {number} stageLeft
   * @param {number} stageRight
   * @param {number} dt  milliseconds
   */
  update(p1, p2, stageLeft, stageRight, dt) {
    const ft = dt / (1000 / 60); // normalized frame time

    // ── Combo window tick ──
    if (this._comboTimeout > 0) {
      this._comboTimeout -= ft;
      if (this._comboTimeout <= 0) this._resetCombos();
    }

    // ── Multi-hit sub-cooldown tick ──
    if (this._p1SubHitCooldown > 0) this._p1SubHitCooldown -= ft;
    if (this._p2SubHitCooldown > 0) this._p2SubHitCooldown -= ft;

    // ── Grab sequence update ── highest priority
    if (this._grabSequence) {
      this._updateGrabSequence(ft, stageLeft, stageRight);
      // Do NOT run normal hit detection while grab sequence is active
      resolvePushboxes(p1, p2, stageLeft, stageRight);
      p1.faceOpponent(p2);
      p2.faceOpponent(p1);
      return;
    }

    // ── Reset per-attack hit flag when attack window closes ──
    if (!p1.attackActive) {
      this._p1HitThisAttack  = false;
      this._p1SpecialSubHits = 0;
      this._p1SubHitCooldown = 0;
    }
    if (!p2.attackActive) {
      this._p2HitThisAttack  = false;
      this._p2SpecialSubHits = 0;
      this._p2SubHitCooldown = 0;
    }

    // ── Hit detection: P1 → P2, then P2 → P1 ──
    this._checkHit(p1, p2, stageLeft, stageRight,
      '_p1HitThisAttack', '_p1Combo', '_p1ComboDmg',
      '_p1SpecialSubHits', '_p1SubHitCooldown');

    this._checkHit(p2, p1, stageLeft, stageRight,
      '_p2HitThisAttack', '_p2Combo', '_p2ComboDmg',
      '_p2SpecialSubHits', '_p2SubHitCooldown');

    // ── Physical separation ──
    resolvePushboxes(p1, p2, stageLeft, stageRight);

    // ── Auto-face ──
    p1.faceOpponent(p2);
    p2.faceOpponent(p1);
  }

  // ══════════════════════════════════════════════════
  //  HIT DETECTION & RESOLUTION
  // ══════════════════════════════════════════════════

  _checkHit(
    attacker, defender,
    stageLeft, stageRight,
    hitFlagKey, comboKey, comboDmgKey,
    subHitKey, subCooldownKey
  ) {
    if (!attacker.attackActive)          return;
    if (defender.state === STATE.DEAD)   return;

    // Respect invincibility frames (wakeup, etc.)
    if (defender.invincibleTimer > 0)    return;

    const moveDef = attacker.currentMoveDef;
    if (!moveDef)                        return;

    // ── Multi-hit special (Vesper Phantom Flurry) ──
    const isMultiHit = moveDef.hits > 1;
    if (isMultiHit) {
      // Each sub-hit has a minimum gap of (active frames / hits) frames
      if (this[subCooldownKey] > 0)      return;
      if (this[subHitKey] >= moveDef.hits) return;
    } else {
      // Single-hit attack: only connects once per activation
      if (this[hitFlagKey])              return;
    }

    // ── Geometry check ──
    const hitbox  = getHitbox(attacker);
    const hurtbox = getHurtbox(defender);
    if (!hitbox)                         return;
    if (!boxOverlap(hitbox, hurtbox))    return;

    // ── Hit confirmed ──
    if (isMultiHit) {
      this[subHitKey]++;
      // Sub-hit cooldown = active window / total hits
      const subGap = (moveDef.active / moveDef.hits);
      this[subCooldownKey] = subGap;
    } else {
      this[hitFlagKey] = true;
    }

    // ── Grab: start a cooperative throw sequence instead of direct damage ──
    if (moveDef.isGrab) {
      // Marcus EX special: route through SpecialSystem for multi-phase cinematics
      if (attacker.specialSystem && attacker.state === STATE.SPECIAL) {
        attacker.specialSystem.activateSeismicSlam(attacker, defender, moveDef);
      } else {
        this._startGrabSequence(attacker, defender, moveDef, comboKey, comboDmgKey);
        // Throw tech window for techable grabs
        if (moveDef.techable) {
          defender.startTechWindow();
        }
      }
      return;
    }

    // ── Armor check (defender has armor, move is not a grab) ──
    if (defender.hasArmor) {
      defender.armorFlash   = 10;
      // Attacker loses 30% of their current vx (arm gets deflected)
      attacker.vx *= 0.7;
      if (this.onHitEffect) {
        const hx = hitbox.x + hitbox.w / 2;
        const hy = hitbox.y + hitbox.h / 2;
        this.onHitEffect(hx, hy, 'armor', false);
      }
      return;
    }

    // ── Counter-hit detection ──
    // A counter-hit occurs when the defender is hit during their own startup or active frames
    const attackerStates = [STATE.LIGHT, STATE.HEAVY, STATE.KICK, STATE.SPECIAL];
    const isCounterHit = attackerStates.includes(defender.state) && defender.attackActive;

    // ── Blocking check ──
    const wasBlocked = this._isBlocking(defender, attacker);

    // ── Damage calculation ──
    const comboIdx   = this[comboKey];
    const scale      = getDamageScale(isMultiHit ? this[subHitKey] - 1 : comboIdx);
    let rawDamage    = Math.floor(moveDef.damage * attacker.charData.damageMultiplier * scale);

    if (isCounterHit && !wasBlocked) {
      rawDamage = Math.floor(rawDamage * COUNTER_HIT_DAMAGE_MULT);
    }

    // ── Apply hit ──
    defender.receiveHit(rawDamage, moveDef, attacker.facing, wasBlocked, isCounterHit);

    if (!wasBlocked) {
      // Attacker gains meter
      attacker.gainMeterOnHit(rawDamage);
      attacker.totalDamageDealt += rawDamage;

      // Combo increment
      this[comboKey]++;
      this[comboDmgKey] += rawDamage;
      this._comboTimeout = 90; // 1.5 s

      if (this.onComboUpdate) {
        this.onComboUpdate(attacker, this[comboKey], this[comboDmgKey]);
      }

      // Counter-hit callback
      if (isCounterHit && this.onCounterHit) {
        this.onCounterHit(attacker, defender);
      }

      // Wall splat
      const nearLeft  = defender.x <= stageLeft  + 55;
      const nearRight = defender.x >= stageRight - 55;
      if ((nearLeft || nearRight) && moveDef.knockbackX >= 4) {
        defender.wallSplat(55);
        if (this.onHitEffect) {
          this.onHitEffect(defender.x, defender.y - 90, 'wallSplat', false);
        }
        if (this.onScreenShake) this.onScreenShake(5);
      }

      // Special VFX
      if (moveDef.screenShake && this.onScreenShake) {
        this.onScreenShake(moveDef.isGrab ? 12 : moveDef.damage > 50 ? 7 : 4);
      }
      if (moveDef.groundCrack && this.onGroundCrack) {
        this.onGroundCrack(defender.x, defender.y);
      }

      // Hit spark
      if (this.onHitEffect) {
        const hx   = hitbox.x + hitbox.w / 2;
        const hy   = hitbox.y + hitbox.h / 2;
        const type = moveDef.damage > 50 ? 'heavy' : 'light';
        this.onHitEffect(hx, hy, type, isCounterHit);
      }

      // KO
      if (defender.health <= 0 && this.onKO) {
        this.onKO(defender);
      }
    }
  }

  // ══════════════════════════════════════════════════
  //  GRAB SEQUENCE
  //
  //  Phases:
  //    'startup'  — attacker plays grab anim, defender enters GRABBED state,
  //                 both freeze their x positions relative to each other
  //    'throw'    — short throw animation window
  //    'impact'   — damage applied, defender sent to THROWN state (airborne KB)
  // ══════════════════════════════════════════════════

  _startGrabSequence(attacker, defender, moveDef, comboKey, comboDmgKey) {
    // Cannot grab certain states
    const ungrabableStates = [STATE.DEAD, STATE.KNOCKDOWN, STATE.THROWN, STATE.GRABBED, STATE.WAKEUP];
    if (ungrabableStates.includes(defender.state)) return;

    // Transition defender to GRABBED
    defender.setState(STATE.GRABBED);
    defender.animator.play('grabbed');
    defender.vx = 0;
    defender.vy = 0;

    // Lock grab sequence
    this._grabSequence = {
      attacker,
      defender,
      moveDef,
      comboKey,
      comboDmgKey,
      timer:     GRAB_THROW_FRAMES,
      phase:     'throw',
      offsetX:   defender.x - attacker.x, // maintain relative position
    };

    // VFX: grab start
    if (this.onHitEffect) {
      this.onHitEffect(attacker.x + attacker.facing * 40, attacker.y - 100, 'grab', false);
    }
    if (this.onScreenShake) {
      this.onScreenShake(4);
    }
  }

  _updateGrabSequence(ft, stageLeft, stageRight) {
    const gs = this._grabSequence;
    if (!gs) return;

    const { attacker, defender, moveDef } = gs;

    // If either fighter died externally during the sequence, abort
    if (attacker.state === STATE.DEAD || defender.state === STATE.DEAD) {
      this._grabSequence = null;
      return;
    }

    // Keep defender locked to attacker position
    defender.x = attacker.x + gs.offsetX;
    defender.vx = 0;
    defender.vy = 0;

    gs.timer -= ft;

    if (gs.timer <= 0) {
      // ── IMPACT ── apply damage and throw
      const scale    = getDamageScale(this[gs.comboKey]);
      const rawDmg   = Math.floor(moveDef.damage * attacker.charData.damageMultiplier * scale);

      // Damage health directly (no receiveHit blocking logic — grabs bypass block)
      if (!defender._settings?.infiniteHealth) {
        defender.health = Math.max(0, defender.health - rawDmg);
      }
      defender._gainMeter(12);
      attacker.gainMeterOnHit(rawDmg);
      attacker.totalDamageDealt += rawDmg;

      // Combo tracking
      this[gs.comboKey]++;
      this[gs.comboDmgKey] += rawDmg;
      this._comboTimeout = 90;

      if (this.onComboUpdate) {
        this.onComboUpdate(attacker, this[gs.comboKey], this[gs.comboDmgKey]);
      }

      // Throw physics — send defender airborne
      const throwDir = attacker.facing;
      defender.vx = throwDir * (moveDef.knockbackX || 0);
      defender.vy = moveDef.knockbackY || -10;
      defender.onGround = false;
      defender.setState(STATE.THROWN);
      defender.animator.play('thrown');

      // Special VFX
      if (this.onHitEffect) {
        this.onHitEffect(defender.x, defender.y - 60, 'slam', false);
      }
      if (moveDef.screenShake && this.onScreenShake) {
        this.onScreenShake(12);
      }
      if (moveDef.groundCrack && this.onGroundCrack) {
        this.onGroundCrack(defender.x, defender.y);
      }

      // KO
      if (defender.health <= 0 && this.onKO) {
        this.onKO(defender);
      }

      this._grabSequence = null;
    }
  }

  // ══════════════════════════════════════════════════
  //  CANCEL WINDOW ENFORCEMENT
  // ══════════════════════════════════════════════════

  /**
   * Called by Player._processInput to check whether a new attack
   * can cancel the current one.
   *
   * A cancel is allowed if:
   *   1. Player is in an attack state (not idle / walk etc.)
   *   2. The current move has been active at least 1 frame (hitbox went live)
   *   3. The target move is listed in currentMoveDef.cancelInto
   *   4. (Optional) a hit has already connected — "hit-cancel" style
   *
   * @param {Object} player
   * @param {string} targetMoveKey  e.g. 'heavyAttack', 'kick'
   * @param {boolean} requireHitConfirm  if true, only cancel after hit lands
   * @returns {boolean}
   */
  canCancel(player, targetMoveKey, requireHitConfirm = false) {
    const attackStates = [STATE.LIGHT, STATE.HEAVY, STATE.KICK];
    if (!attackStates.includes(player.state)) return false;

    const moveDef = player.currentMoveDef;
    if (!moveDef) return false;

    const allowedCancels = moveDef.cancelInto || [];
    if (!allowedCancels.includes(targetMoveKey)) return false;

    // Must be at or past startup (can only cancel from active/recovery)
    if (player.attackFrame < moveDef.startup) return false;

    // Hit-confirm cancel: only allow if this attack connected
    if (requireHitConfirm && !player.hitConnected) return false;

    return true;
  }

  // ══════════════════════════════════════════════════
  //  BLOCKING CHECK
  // ══════════════════════════════════════════════════

  /**
   * Returns true if the defender is successfully blocking the incoming attack.
   * Grabs bypass block entirely — handled upstream before this is called.
   */
  _isBlocking(defender, attacker) {
    if (!defender.isBlocking)               return false;
    if (defender.state !== STATE.BLOCK)     return false;
    if (defender.isAirborne())              return false;
    // Must face the attacker (can't block from behind)
    const facingAttacker = defender.facing !== attacker.facing;
    return facingAttacker;
  }

  // ══════════════════════════════════════════════════
  //  RESET
  // ══════════════════════════════════════════════════

  _resetCombos() {
    this._p1Combo    = 0;
    this._p1ComboDmg = 0;
    this._p2Combo    = 0;
    this._p2ComboDmg = 0;
  }

  resetRound() {
    this._resetCombos();
    this._comboTimeout        = 0;
    this._p1HitThisAttack     = false;
    this._p2HitThisAttack     = false;
    this._p1SpecialSubHits    = 0;
    this._p2SpecialSubHits    = 0;
    this._p1SubHitCooldown    = 0;
    this._p2SubHitCooldown    = 0;
    this._grabSequence        = null;
  }

  getComboForPlayer(idx) {
    return idx === 0
      ? { hits: this._p1Combo, damage: this._p1ComboDmg }
      : { hits: this._p2Combo, damage: this._p2ComboDmg };
  }

  /** Whether a cooperative grab sequence is currently running */
  isGrabSequenceActive() {
    return this._grabSequence !== null;
  }
}
