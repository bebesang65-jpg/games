/**
 * IRON FIST LEAGUE — AI System
 *
 * CPU logic for Easy / Normal / Hard difficulty.
 * The AI uses the same input interface as the human player —
 * it produces an { action: boolean } input object each frame.
 * No cheating: same speed, same damage, same rules.
 */

import { STATE } from './player.js';

// Reaction delay in milliseconds per difficulty
const REACTION_MS = {
  easy:   500,
  normal: 220,
  hard:   80,
};

// How often the AI "thinks" (re-evaluates) per difficulty
const THINK_INTERVAL_MS = {
  easy:   600,
  normal: 280,
  hard:   100,
};

export class AIController {
  /**
   * @param {string} difficulty - 'easy' | 'normal' | 'hard'
   * @param {Object} charData   - character data for this fighter
   */
  constructor(difficulty, charData) {
    this.difficulty  = difficulty;
    this.charData    = charData;
    this.aiBehavior  = charData.ai;

    this._thinkTimer    = 0;
    this._reactionTimer = 0;
    this._currentPlan   = null;  // current decision
    this._input         = {};

    // Combo sequence tracking
    this._comboQueue  = [];
    this._comboTimer  = 0;
  }

  /**
   * @param {Object} self      - own player instance
   * @param {Object} opponent  - opponent player instance
   * @param {number} dt        - delta time ms
   * @returns {Object}         - input map (same shape as human input)
   */
  update(self, opponent, dt) {
    this._thinkTimer    -= dt;
    this._reactionTimer -= dt;
    this._comboTimer    -= dt;

    // Re-evaluate decision on think interval
    if (this._thinkTimer <= 0) {
      this._thinkTimer = THINK_INTERVAL_MS[this.difficulty] + this._rand(0, 60);
      this._decide(self, opponent);
    }

    // Delay actual execution by reaction time
    const input = this._reactionTimer <= 0 ? this._currentPlan || {} : {};

    return this._buildInputFromPlan(input, self, opponent);
  }

  // ══════════════════════════════════════════════════
  //  DECISION MAKING
  // ══════════════════════════════════════════════════

  _decide(self, opponent) {
    // Don't make new decisions while locked in an action
    const LOCKED_STATES = [
      STATE.DEAD, STATE.KNOCKDOWN, STATE.GRABBED,
      STATE.THROWN, STATE.WAKEUP,
    ];
    if (LOCKED_STATES.includes(self.state)) {
      this._currentPlan = {};
      return;
    }

    // Also don't override attack states — let the current attack finish
    const ATTACK_STATES = [STATE.LIGHT, STATE.HEAVY, STATE.KICK, STATE.GRAB, STATE.SPECIAL];
    if (ATTACK_STATES.includes(self.state)) {
      // Keep current plan but don't re-decide
      return;
    }

    const dist     = Math.abs(self.x - opponent.x);
    const hpRatio  = self.health / self.charData.maxHealth;
    const ai       = this.aiBehavior;
    const facing   = self.x < opponent.x ? 1 : -1;

    let plan = {};

    // ── RETREAT if very low health ──
    if (hpRatio < ai.retreatThreshold) {
      plan.moveLeft  = facing === 1;
      plan.moveRight = facing === -1;
      plan.block     = this._roll(0.5);
      this._setPlan(plan);
      return;
    }

    // ── CLOSE THE GAP ──
    if (dist > 200) {
      plan.moveRight = facing === 1;
      plan.moveLeft  = facing === -1;
      if (this.difficulty === 'hard' && this._roll(0.2)) {
        plan.jump = true;
      }
      this._setPlan(plan);
      return;
    }

    // ── IN ATTACK RANGE ──
    if (dist < 120) {

      // Block sometimes when opponent is attacking
      if (opponent.attackActive && this._roll(ai.blockFrequency)) {
        plan.block = true;
        this._setPlan(plan);
        return;
      }

      // Grab attempt
      if (this._roll(ai.grabFrequency) && dist < (this.charData.grabRange || 80)) {
        plan.grab = true;
        this._setPlan(plan);
        return;
      }

      // Special move
      if (self.meter >= 50 && this._roll(0.25)) {
        plan.special = true;
        this._setPlan(plan);
        return;
      }

      // Attack — pick one randomly weighted by archetype
      const r = Math.random();
      if (r < 0.45) {
        plan.lightAttack = true;
      } else if (r < 0.75) {
        plan.kick = true;
      } else {
        plan.heavyAttack = true;
      }
    }

    // ── MEDIUM RANGE — approach or poke ──
    else {
      if (this._roll(ai.dashFrequency)) {
        plan.moveRight = facing === 1;
        plan.moveLeft  = facing === -1;
      } else if (this._roll(0.35)) {
        plan.kick = true;
      } else if (this._roll(0.2)) {
        plan.jump = true;
      }
    }

    this._setPlan(plan);
  }

  _setPlan(plan) {
    this._currentPlan   = plan;
    this._reactionTimer = REACTION_MS[this.difficulty];
  }

  _pickCombo() {
    const c = this.charData.id;
    if (c === 'marcus') {
      return this._randomFrom([
        { lightAttack: true },
        { lightAttack: true },  // jab ×2
        { heavyAttack: true },
        { kick: true },
      ]);
    } else {
      return this._randomFrom([
        { lightAttack: true },
        { lightAttack: true },
        { lightAttack: true },  // rapid light chain
        { kick: true },
        { heavyAttack: true },
      ]);
    }
  }

  // ══════════════════════════════════════════════════
  //  BUILD ACTUAL INPUT FRAME
  // ══════════════════════════════════════════════════

  _buildInputFromPlan(plan, self, opponent) {
    // Don't pass attack inputs while in locked states
    const LOCKED = [STATE.DEAD, STATE.KNOCKDOWN, STATE.GRABBED, STATE.THROWN, STATE.WAKEUP, STATE.HIT];
    if (LOCKED.includes(self.state)) {
      return { moveLeft: false, moveRight: false, jump: false, crouch: false,
               lightAttack: false, heavyAttack: false, kick: false,
               special: false, grab: false, block: false };
    }

    return {
      moveLeft:    !!plan.moveLeft,
      moveRight:   !!plan.moveRight,
      jump:        !!plan.jump,
      crouch:      !!plan.crouch,
      lightAttack: !!plan.lightAttack,
      heavyAttack: !!plan.heavyAttack,
      kick:        !!plan.kick,
      special:     !!plan.special,
      grab:        !!plan.grab,
      block:       !!plan.block,
    };
  }

  // ══════════════════════════════════════════════════
  //  UTILITIES
  // ══════════════════════════════════════════════════

  _roll(probability) {
    return Math.random() < probability;
  }

  _rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  _randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  reset() {
    this._thinkTimer    = 0;
    this._reactionTimer = 0;
    this._currentPlan   = null;
    this._comboQueue    = [];
    this._comboTimer    = 0;
  }
}
