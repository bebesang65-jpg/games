/**
 * IRON FIST LEAGUE — Player / Fighter Class  (Phase 2)
 *
 * Phase 2 additions over Phase 1:
 *  - GRABBED / THROWN state handling (landing from throw → knockdown)
 *  - Cancel window enforcement (via CombatSystem.canCancel)
 *  - Throw tech window (mash grab during opponent's startup to escape)
 *  - Wakeup invincibility frames
 *  - Counter-hit flag exposed on player (set by combat, read for display)
 *  - Crouch-state pushbox fix
 *  - Air hitstun distinction (longer hang-time in air combos)
 *  - Defense multiplier applied correctly (lower def = more knockback received)
 *  - Block chip damage updated (now 4% and cannot kill)
 *  - Infinite health setting respected in receiveHit
 */

import { Animator }          from './animation.js';
import { KEYMAP_P1 }         from './input.js';

// ── Exported state constants ──
export const STATE = {
  IDLE:       'idle',
  WALK:       'walk',
  CROUCH:     'crouch',
  JUMP:       'jump',
  FALL:       'fall',
  LIGHT:      'lightAttack',
  HEAVY:      'heavyAttack',
  KICK:       'kick',
  BLOCK:      'block',
  HIT:        'hit',
  STUN:       'stun',
  KNOCKDOWN:  'knockdown',
  WAKEUP:     'getup',
  GRAB:       'grab',
  GRABBED:    'grabbed',
  THROWN:     'thrown',
  SPECIAL:    'special',
  DEAD:       'dead',
};

// ── States the player can act from ──
const NEUTRAL_STATES = new Set([
  STATE.IDLE, STATE.WALK, STATE.CROUCH, STATE.JUMP, STATE.FALL,
]);

// ── States that lock facing direction ──
const LOCK_FACING_STATES = new Set([
  STATE.GRAB, STATE.GRABBED, STATE.THROWN,
  STATE.LIGHT, STATE.HEAVY, STATE.KICK, STATE.SPECIAL,
]);

// ── Physics ──
const GROUND_FRICTION = 0.75;
const AIR_FRICTION    = 0.95;
const MAX_FALL_SPEED  = 22;

// ── Throw tech window (frames from grab startup during which defender can escape) ──
const THROW_TECH_WINDOW = 8;

// ── Wakeup invincibility (frames where the rising fighter cannot be hit) ──
const WAKEUP_INVINCIBLE_FRAMES = 14;

// ── Counter-hit stun bonus (extra hitstun frames on a counter-hit) ──
const COUNTER_HIT_STUN_BONUS = 8;

export class Player {
  /**
   * @param {Object}  charData  - from CHARACTER_DATA
   * @param {number}  startX
   * @param {number}  startY    - floor Y (feet position)
   * @param {number}  facing    - 1 = right, -1 = left
   * @param {boolean} isHuman
   * @param {Object}  keymap    - KEYMAP_P1 or KEYMAP_P2
   * @param {Object}  [combatSystem] - CombatSystem ref for cancel checks
   */
  constructor(charData, startX, startY, facing, isHuman, keymap = KEYMAP_P1, combatSystem = null) {
    this.charData      = charData;
    this.x             = startX;
    this.y             = startY;
    this.floorY        = startY;
    this.facing        = facing;
    this.isHuman       = isHuman;
    this.keymap        = keymap;
    this.combatSystem  = combatSystem; // set after construction via player.combatSystem = cs

    // ── Health & Meter ──
    this.maxHealth = charData.maxHealth;
    this.health    = charData.maxHealth;
    this.maxMeter  = 100;
    this.meter     = 0;

    // ── Physics ──
    this.vx       = 0;
    this.vy       = 0;
    this.onGround = true;

    // ── State machine ──
    this.state          = STATE.IDLE;
    this.stateTimer     = 0;
    this.attackFrame    = 0;   // float, 60fps-normalized
    this.attackActive   = false;
    this.currentMoveDef = null;
    this.hitConnected   = false; // true after this attack has hit once (for cancel confirm)

    // ── Stun / hitstun ──
    this.hitstunTimer   = 0;
    this.blockstunTimer = 0;
    this.knockdownTimer = 0;
    this.grabCooldown   = 0;

    // ── Phase 2: invincibility ──
    this.invincibleTimer = 0;  // > 0 = cannot be hit

    // ── Phase 2: throw tech ──
    this._techWindow  = 0; // frames remaining to tech a throw

    // ── Phase 2: counter-hit indicator ──
    this.lastHitWasCounter = false;

    // ── Wall splat ──
    this.wallSplatTimer = 0;

    // ── Block ──
    this.isBlocking = false;

    // ── Flash effects ──
    this.hitFlash   = 0;
    this.armorFlash = 0;

    // ── Afterimages (Vesper special) ──
    this.afterimages = [];

    // ── Round stats ──
    this.totalDamageDealt = 0;
    this.comboCount       = 0;
    this.maxCombo         = 0;
    this.specialsUsed     = 0;
    this.roundsWon        = 0;

    // ── Animation ──
    this.animator = new Animator(charData.id);
    this.animator.play('idle');

    // ── Armor (set per-frame by _updateAttackState) ──
    this.hasArmor = false;

    // ── AI input slot ──
    this._aiInput = {};

    // ── Settings (set per-frame from game) ──
    this._settings = {};

    // ── Special system refs (set by game.js after construction) ──
    this.specialSystem = null;
    this._pendingFlurryActivation = false;
    this._lastOpponent = null; // updated each update() call
  }

  // ══════════════════════════════════════════════════
  //  STATE HELPERS
  // ══════════════════════════════════════════════════

  /** Set state + reset attack tracking ── only call for full state transitions */
  setState(newState, duration = 0) {
    this.state         = newState;
    this.stateTimer    = duration;
    this.attackFrame   = 0;
    this.attackActive  = false;
    this.hasArmor      = false;
    this.hitConnected  = false;
  }

  canAct()     { return NEUTRAL_STATES.has(this.state); }
  isAirborne() { return !this.onGround || this.state === STATE.JUMP || this.state === STATE.FALL; }

  // ══════════════════════════════════════════════════
  //  MAIN UPDATE
  // ══════════════════════════════════════════════════

  update(input, dt, stageLeft, stageRight, opponent, settings = {}) {
    this._settings = settings;
    this._lastOpponent = opponent;
    const ft = dt / (1000 / 60);

    // ── Safety watchdog: prevent permanent freezing ──
    // If a character has been in a non-looping, non-terminal state
    // for too long, force them back to idle
    this._stuckTimer = (this._stuckTimer || 0) + dt;
    const STUCK_THRESHOLD_MS = 5000; // 5 seconds max in any state
    const SAFE_STATES = new Set([
      STATE.IDLE, STATE.WALK, STATE.JUMP, STATE.FALL,
      STATE.DEAD, STATE.KNOCKDOWN, STATE.WAKEUP, STATE.GRABBED,
      STATE.BLOCK, STATE.SPECIAL, STATE.GRAB,
    ]);
    if (this._stuckTimer > STUCK_THRESHOLD_MS && !SAFE_STATES.has(this.state)) {
      console.warn(`[IFL] Character ${this.charData.id} stuck in ${this.state} — forcing reset`);
      this.hitstunTimer   = 0;
      this.blockstunTimer = 0;
      this.isBlocking     = false;
      this.currentMoveDef = null;
      this.setState(STATE.IDLE);
      this.animator.play('idle');
      this._stuckTimer = 0;
    }
    // Reset watchdog when in a safe/normal state
    if (SAFE_STATES.has(this.state)) {
      this._stuckTimer = 0;
    }

    // ── Tick flash timers ──
    if (this.hitFlash    > 0) this.hitFlash--;
    if (this.armorFlash  > 0) this.armorFlash--;
    if (this.grabCooldown > 0) this.grabCooldown -= ft;
    if (this.wallSplatTimer > 0) this.wallSplatTimer -= ft;
    if (this.invincibleTimer > 0) this.invincibleTimer -= ft;

    // ── Throw tech window ──
    if (this._techWindow > 0) {
      this._techWindow -= ft;
      // If player presses grab during tech window, attempt tech escape
      if (this._techWindow > 0 && input.grab && this.state === STATE.GRABBED) {
        this._throwTech();
        inputManager_consume(input); // clear the grab press
        return;
      }
    }

    // ── Hitstun ──
    if (this.hitstunTimer > 0) {
      this.hitstunTimer -= ft;
      if (this.hitstunTimer <= 0) {
        this.hitstunTimer = 0;
        if (this.state === STATE.HIT || this.state === STATE.STUN) {
          this.setState(STATE.IDLE);
          this.animator.play('idle');
        }
      }
    }

    // ── Blockstun ──
    if (this.blockstunTimer > 0) {
      this.blockstunTimer -= ft;
      if (this.blockstunTimer <= 0) {
        this.blockstunTimer = 0;
        if (this.state === STATE.BLOCK) {
          this.setState(STATE.IDLE);
          this.animator.play('idle');
          this.isBlocking = false;
        }
        // Always clear isBlocking when blockstun expires to prevent stuck state
        this.isBlocking = false;
      }
    }

    // ── Knockdown → wakeup ──
    if (this.state === STATE.KNOCKDOWN) {
      this.knockdownTimer -= ft;
      if (this.knockdownTimer <= 0) {
        this.setState(STATE.WAKEUP, 30);
        this.animator.play('getup');
        this.invincibleTimer = WAKEUP_INVINCIBLE_FRAMES; // wakeup invincibility
      }
    }

    // ── Wakeup → idle ──
    if (this.state === STATE.WAKEUP) {
      this.stateTimer -= ft;
      if (this.stateTimer <= 0) {
        this.setState(STATE.IDLE);
        this.animator.play('idle');
      }
    }

    // ── GRABBED state — position locked by CombatSystem, just tick anim ──
    // NOTE: timers still need to tick even in GRABBED state for throw tech to work
    if (this.state === STATE.GRABBED) {
      this._updateAnimation(dt);
      return;
    }

    // ── DEAD — only physics + animation ──
    if (this.state === STATE.DEAD) {
      this._applyPhysics(ft, stageLeft, stageRight);
      this._updateAnimation(dt);
      return;
    }

    // ── Attack frame machine ──
    this._updateAttackState(ft);

    // ── Input → state transitions ──
    this._processInput(input, opponent, settings);

    // ── Physics ──
    this._applyPhysics(ft, stageLeft, stageRight);

    // ── Animations ──
    this._updateAnimation(dt);

    // ── Afterimages (dash specials) ──
    if (this.charData.moves?.special?.isDash) {
      this._updateAfterimages(dt);
    }

    // ── Debug: force infinite meter ──
    if (settings.infiniteMeter) this.meter = this.maxMeter;
  }

  // ══════════════════════════════════════════════════
  //  ATTACK STATE MACHINE
  // ══════════════════════════════════════════════════

  _updateAttackState(ft) {
    const ATTACK_STATES = [STATE.LIGHT, STATE.HEAVY, STATE.KICK, STATE.GRAB, STATE.SPECIAL];
    if (!ATTACK_STATES.includes(this.state)) return;

    // During super-flash: completely freeze ALL attack state machines
    if (this.specialSystem && this.specialSystem.superFlashActive) {
      return; // full freeze — nothing advances
    }

    // If the special system is actively running a sequence for this player,
    // suppress the normal attack state machine — the special owns timing.
    if (this.specialSystem && this.specialSystem.isActive()) {
      const seqChar = this.specialSystem.getActiveCharId();
      if (seqChar === this.charData.id) return;
    }

    const md = this.currentMoveDef;
    if (!md) return;

    this.attackFrame += ft;
    const f = this.attackFrame;

    if (f < md.startup) {
      // ── Startup ──
      this.attackActive = false;

    } else if (f < md.startup + md.active) {
      // ── Active ──
      this.attackActive = true;

      // Armor window
      if (md.armorStart > 0 && md.armorEnd > 0) {
        this.hasArmor = (f >= md.armorStart && f <= md.armorEnd);
      } else {
        this.hasArmor = false;
      }

      // ── Vesper Phantom Flurry: fire the dash on first active frame ──
      if (this._pendingFlurryActivation && this.specialSystem && this._lastOpponent) {
        this._pendingFlurryActivation = false;
        // Grant invincibility for the dash
        if (md.invincible) {
          this.invincibleTimer = md.invincibleFrames || 20;
        }
        this.specialSystem.activatePhantomFlurry(this, this._lastOpponent, md);
      }

    } else if (f < md.startup + md.active + md.recovery) {
      // ── Recovery ──
      this.attackActive = false;
      this.hasArmor     = false;

    } else {
      // ── Done ──
      this.attackActive   = false;
      this.hasArmor       = false;
      this.currentMoveDef = null;
      this.setState(STATE.IDLE);
      this.animator.play('idle');
    }
  }

  // ══════════════════════════════════════════════════
  //  INPUT PROCESSING
  // ══════════════════════════════════════════════════

  _processInput(input, opponent, settings) {
    const moves = this.charData.moves;
    const cs    = this.combatSystem;

    // ── Cancel window (from attack states into another attack) ──
    if (!this.canAct()) {
      // Check each attack for a valid cancel
      const tryCancel = (inputKey, moveKey, stateKey) => {
        if (!input[inputKey]) return false;
        if (!cs || !cs.canCancel(this, moveKey)) return false;
        this._executeMove(stateKey, moves[moveKey]);
        return true;
      };
      if (tryCancel('heavyAttack', 'heavyAttack', STATE.HEAVY)) return;
      if (tryCancel('kick',        'kick',        STATE.KICK))  return;
      if (tryCancel('lightAttack', 'lightAttack', STATE.LIGHT)) return;
      return; // no other actions allowed while locked in a non-cancel state
    }

    // ── From neutral / movement states ──

    // Special (meter-gated)
    if (input.special) {
      const cost = moves.special.meterCost || 50;
      if (this.meter >= cost || settings.infiniteMeter) {
        this._executeMove(STATE.SPECIAL, moves.special);
        this.specialsUsed++;
        if (!settings.infiniteMeter) this.meter -= cost;
        return;
      }
    }

    // Grab
    if (input.grab && this.grabCooldown <= 0) {
      this._executeMove(STATE.GRAB, moves.grab);
      return;
    }

    // Block (hold — only when grounded)
    if (input.block && this.onGround) {
      if (this.state !== STATE.BLOCK) {
        this.setState(STATE.BLOCK);
        this.animator.play('block');
      }
      this.isBlocking = true;
      return;
    } else if (this.state === STATE.BLOCK && !input.block) {
      this.isBlocking = false;
      this.setState(STATE.IDLE);
      this.animator.play('idle');
      return;
    } else if (this.state === STATE.BLOCK) {
      this.isBlocking = true;
      return;
    }
    this.isBlocking = false;

    // Attacks
    if (input.heavyAttack) { this._executeMove(STATE.HEAVY, moves.heavyAttack); return; }
    if (input.kick)         { this._executeMove(STATE.KICK,  moves.kick);        return; }
    if (input.lightAttack)  { this._executeMove(STATE.LIGHT, moves.lightAttack); return; }

    // Jump
    if (input.jump && this.onGround) {
      this.vy       = this.charData.jumpForce;
      this.onGround = false;
      this.setState(STATE.JUMP);
      this.animator.play('jump');
      return;
    }

    // Crouch
    if (input.crouch && this.onGround) {
      if (this.state !== STATE.CROUCH) {
        this.setState(STATE.CROUCH);
        this.animator.play('crouch');
      }
      this.vx *= 0.7;
      return;
    }

    // Horizontal walk
    if (input.moveLeft) {
      this.vx = -this.charData.speed;
      if (this.onGround && this.state !== STATE.WALK) {
        this.setState(STATE.WALK);
        this.animator.play('walk');
      }
    } else if (input.moveRight) {
      this.vx = this.charData.speed;
      if (this.onGround && this.state !== STATE.WALK) {
        this.setState(STATE.WALK);
        this.animator.play('walk');
      }
    } else {
      if (this.onGround && this.state === STATE.WALK) {
        this.setState(STATE.IDLE);
        this.animator.play('idle');
      }
      if (this.onGround && this.state === STATE.CROUCH) {
        this.setState(STATE.IDLE);
        this.animator.play('idle');
      }
      this.vx *= GROUND_FRICTION;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }
  }

  _executeMove(stateKey, moveDef) {
    this.setState(stateKey);
    this.stateTimer     = moveDef.startup + moveDef.active + moveDef.recovery;
    this.currentMoveDef = moveDef;
    this.attackFrame    = 0;
    this.attackActive   = false;
    this.hasArmor       = false;
    this.hitConnected   = false;

    const animKey = {
      [STATE.LIGHT]:   'lightAttack',
      [STATE.HEAVY]:   'heavyAttack',
      [STATE.KICK]:    'kick',
      [STATE.GRAB]:    'grab',
      [STATE.SPECIAL]: 'special',
    };
    this.animator.play(animKey[stateKey] || 'lightAttack');

    // Grab cooldown even on whiff (prevents spam)
    if (moveDef.isGrab) {
      this.grabCooldown = moveDef.missRecovery || 30;
    }

    // ── Vesper: Phantom Flurry — activate dash immediately on execution ──
    // The SpecialSystem owns positioning during the dash; the player state machine
    // still tracks startup/active/recovery for the hitbox window.
    if (stateKey === STATE.SPECIAL && moveDef.isDash && this.specialSystem) {
      // We need the opponent reference — stored after construction by game.js
      // game.js calls p1.update(input, dt, ..., p2, ...), so we store opponent each frame
      // Activation is deferred to the first frame of active (when attackActive becomes true)
      this._pendingFlurryActivation = true;
    }
  }

  // ══════════════════════════════════════════════════
  //  PHYSICS
  // ══════════════════════════════════════════════════

  _applyPhysics(ft, stageLeft, stageRight) {
    if (!this.onGround) {
      this.vy += this.charData.gravity * ft;
      if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

      // Jump → fall
      if (this.vy > 0 && this.state === STATE.JUMP) {
        this.setState(STATE.FALL);
        this.animator.play('fall');
      }

      this.vx *= AIR_FRICTION;
    }

    this.x += this.vx * ft;
    this.y += this.vy * ft;

    // Floor landing
    if (this.y >= this.floorY) {
      this.y        = this.floorY;
      this.vy       = 0;
      this.onGround = true;

      // Only trigger knockdown on landing if the character was thrown or hit airborne
      if (this.state === STATE.THROWN) {
        this._startKnockdown();
      } else if (this.state === STATE.FALL || this.state === STATE.JUMP) {
        // Normal landing — just return to idle
        if (this.hitstunTimer > 0) {
          // Was hit airborne — knockdown on landing
          this._startKnockdown();
        } else {
          this.setState(STATE.IDLE);
          this.animator.play('idle');
        }
      } else if (this.state === STATE.HIT && this.hitstunTimer <= 0) {
        this.setState(STATE.IDLE);
        this.animator.play('idle');
      }
    }

    // Stage walls — heavy characters get wider pushbox
    const HEAVY = new Set(['marcus', 'rook', 'titan']);
    const halfW = HEAVY.has(this.charData.id) ? 24 : 18;
    if (this.x - halfW < stageLeft) {
      this.x  = stageLeft + halfW;
      this.vx = 0;
    }
    if (this.x + halfW > stageRight) {
      this.x  = stageRight - halfW;
      this.vx = 0;
    }
  }

  // ══════════════════════════════════════════════════
  //  RECEIVE HIT
  // ══════════════════════════════════════════════════

  /**
   * @param {number}  damage
   * @param {Object}  moveDef
   * @param {number}  attackerFacing
   * @param {boolean} wasBlocked
   * @param {boolean} isCounterHit
   */
  receiveHit(damage, moveDef, attackerFacing, wasBlocked, isCounterHit = false) {
    if (this.state === STATE.DEAD) return;
    if (this.invincibleTimer > 0)  return; // wakeup / other i-frames

    this.lastHitWasCounter = isCounterHit;

    if (wasBlocked) {
      // ── Blocked ──
      const chipDmg = Math.floor(damage * 0.04);
      // Chip damage cannot kill (leaves at 1 HP minimum)
      if (!this._settings.infiniteHealth) {
        this.health = Math.max(1, this.health - chipDmg);
      }
      this.blockstunTimer = moveDef.blockstun || 8;
      this.setState(STATE.BLOCK);
      this.animator.play('block');
      this.isBlocking = true;
      this._gainMeter(4);
      this.hitFlash = 2;

    } else {
      // ── Hit ──
      if (!this._settings.infiniteHealth) {
        this.health = Math.max(0, this.health - damage);
      }
      this._gainMeter(8);

      // Direction of knockback is always away from the attacker
      const kbDir = -attackerFacing;

      // Defense modifier: higher defense → less knockback received
      const defMod = this.charData.defense || 1.0;
      // defMod > 1 = tougher (Marcus 1.2 = takes less KB), < 1 = lighter (Vesper 0.85 = takes more KB)
      // We invert: multiplier on KB = 1 / defMod  (so Marcus KB = ÷1.2, Vesper = ÷0.85)
      const kbScale = 1.0 / Math.max(0.5, defMod);

      const kbX = (moveDef.knockbackX || 5)  * kbScale;
      const kbY = (moveDef.knockbackY || -2) * kbScale;

      this.vx = kbDir * kbX;
      this.vy = kbY;

      if (this.onGround) this.onGround = (kbY >= 0);

      // Hitstun — airborne hits have longer hang-time
      let hitstun = isCounterHit
        ? (moveDef.hitstun || 12) + COUNTER_HIT_STUN_BONUS
        : (moveDef.hitstun || 12);

      if (!this.onGround) {
        // Air hitstun: 40% longer, keeps them floating for juggle
        hitstun = Math.floor(hitstun * 1.4);
      }

      // Knockdown or hitstun?
      if (moveDef.isGrab || Math.abs(kbY) > 8 || this.state === STATE.KNOCKDOWN) {
        // _startKnockdown will be called from physics landing if airborne
        if (this.onGround) {
          this._startKnockdown();
        } else {
          // Airborne: let them fall, physics will call _startKnockdown on landing
          this.setState(STATE.FALL);
          this.animator.play('fall');
        }
      } else {
        this.hitstunTimer = hitstun;
        this.setState(STATE.HIT);
        this.animator.play('hit');
      }

      this.hitFlash = 3;
    }

    if (this.health <= 0) {
      this.health = 0;
      this._die();
    }
  }

  // ══════════════════════════════════════════════════
  //  KNOCKDOWN / WAKEUP / DEATH
  // ══════════════════════════════════════════════════

  _startKnockdown() {
    this.setState(STATE.KNOCKDOWN);
    this.knockdownTimer = 62; // frames on ground
    this.animator.play('knockdown');
    this.onGround = true;
    this.vy = 0;
    // Slide a little on landing
    if (Math.abs(this.vx) > 0) {
      this.vx *= 0.4; // landing friction
    }
  }

  _die() {
    this.setState(STATE.DEAD);
    this.animator.play('defeat');
    this.vx = 0;
    this.vy = 0;
    this.isBlocking = false;
  }

  // ══════════════════════════════════════════════════
  //  WALL SPLAT
  // ══════════════════════════════════════════════════

  /**
   * Called by CombatSystem when the defender is hit near a wall.
   * Extends hitstun and pins X velocity.
   */
  wallSplat(duration = 55) {
    this.wallSplatTimer  = duration;
    this.vx              = 0;
    // Extend hitstun to at least the splat duration so the pin feels solid
    this.hitstunTimer    = Math.max(this.hitstunTimer, duration);
  }

  // ══════════════════════════════════════════════════
  //  THROW TECH
  // ══════════════════════════════════════════════════

  /**
   * Called during the throw tech window when the grabbed player presses Grab.
   * Breaks out of GRABBED state into HIT with small bounce.
   */
  _throwTech() {
    this._techWindow  = 0;
    this.hitstunTimer = 16;
    this.setState(STATE.HIT);
    this.animator.play('hit');
    this.vx = this.facing * 2; // small bounce back
    this.vy = -3;
    this.onGround = false;
  }

  /**
   * Start the throw tech window. Called by CombatSystem at grab startup.
   */
  startTechWindow() {
    this._techWindow = THROW_TECH_WINDOW;
  }

  // ══════════════════════════════════════════════════
  //  METER
  // ══════════════════════════════════════════════════

  _gainMeter(amount) {
    this.meter = Math.min(this.maxMeter, this.meter + amount);
  }

  gainMeterOnHit(damage) {
    this._gainMeter(Math.max(1, Math.floor(damage * 0.12)));
  }

  // ══════════════════════════════════════════════════
  //  ANIMATION
  // ══════════════════════════════════════════════════

  _updateAnimation(dt) {
    this.animator.update(dt);
  }

  _updateAfterimages(dt) {
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      this.afterimages[i].alpha -= 0.07;
      if (this.afterimages[i].alpha <= 0) this.afterimages.splice(i, 1);
    }
    // Spawn during special active phase
    if (this.state === STATE.SPECIAL && this.attackActive) {
      this.afterimages.push({
        x: this.x, y: this.y,
        facing: this.facing,
        alpha: 0.55,
      });
    }
  }

  // ══════════════════════════════════════════════════
  //  FACING
  // ══════════════════════════════════════════════════

  faceOpponent(opponent) {
    if (LOCK_FACING_STATES.has(this.state)) return;
    if (this.state === STATE.BLOCK) return; // don't flip while holding block
    this.facing = this.x < opponent.x ? 1 : -1;
  }

  // ══════════════════════════════════════════════════
  //  ROUND RESET
  // ══════════════════════════════════════════════════

  resetForRound(startX, startY, facing) {
    this.x        = startX;
    this.y        = startY;
    this.floorY   = startY;
    this.facing   = facing;
    this.health   = this.maxHealth;
    this.meter    = 0;
    this.vx       = 0;
    this.vy       = 0;
    this.onGround = true;

    this.hitstunTimer    = 0;
    this.blockstunTimer  = 0;
    this.knockdownTimer  = 0;
    this.grabCooldown    = 0;
    this.wallSplatTimer  = 0;
    this.invincibleTimer = 0;
    this._techWindow     = 0;
    this.hitFlash        = 0;
    this.armorFlash      = 0;
    this.hasArmor        = false;
    this.attackActive    = false;
    this.currentMoveDef  = null;
    this.afterimages     = [];
    this.isBlocking      = false;
    this.lastHitWasCounter = false;
    this._pendingFlurryActivation = false;

    this.totalDamageDealt = 0;
    this.comboCount       = 0;
    this.specialsUsed     = 0;

    this.setState(STATE.IDLE);
    this.animator.play('idle');
  }

  // ══════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════

  draw(ctx, debugMode = false, showFrameData = false) {
    // Afterimages first (behind character)
    for (const ai of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = ai.alpha * 0.65;
      this.animator.draw(ctx, ai.x, ai.y, ai.facing, { alpha: ai.alpha });
      ctx.restore();
    }

    // Main character
    this.animator.draw(ctx, this.x, this.y, this.facing, {
      alpha:      this.state === STATE.DEAD ? 0.5 : 1,
      hitFlash:   this.hitFlash > 0,
      armorFlash: this.armorFlash > 0,
      isAirborne: !this.onGround,
    });

    // Counter-hit burst (brief overlay flash)
    if (this.lastHitWasCounter && this.hitFlash > 3) {
      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 90, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Invincibility shimmer
    if (this.invincibleTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.1 * Math.sin(performance.now() * 0.05);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 88, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Debug boxes
    if (debugMode && window._ifl_collision && window._ifl_collision.drawDebugBoxes) {
      window._ifl_collision.drawDebugBoxes(ctx, this, showFrameData);
    }
  }
}

// ── Helper used in _processInput for throw tech input consumption ──
function inputManager_consume(input) {
  // Mark grab as consumed for this frame — just clear the flag in the object
  input.grab = false;
}
