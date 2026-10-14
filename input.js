/**
 * IRON FIST LEAGUE — Input Manager
 * Centralised keyboard state. Controls are configurable via KEYMAP.
 * All game code reads from InputManager, never from raw KeyboardEvent.
 */

// ── Default keybind map (action → KeyboardEvent.code) ──
export const KEYMAP_P1 = {
  moveLeft:     'KeyA',
  moveRight:    'KeyD',
  jump:         'KeyW',
  crouch:       'KeyS',
  lightAttack:  'KeyJ',
  heavyAttack:  'KeyK',
  kick:         'KeyL',
  special:      'KeyU',
  grab:         'KeyI',
  block:        'KeyO',
  pause:        'Escape',
};

// P2 / CPU placeholder (not used in Phase 1 CPU, but wired for Versus mode)
export const KEYMAP_P2 = {
  moveLeft:     'ArrowLeft',
  moveRight:    'ArrowRight',
  jump:         'ArrowUp',
  crouch:       'ArrowDown',
  lightAttack:  'Numpad1',
  heavyAttack:  'Numpad2',
  kick:         'Numpad3',
  special:      'Numpad4',
  grab:         'Numpad5',
  block:        'Numpad6',
  pause:        'Escape',
};

class InputManager {
  constructor() {
    /** Raw key state: code → boolean */
    this._keys = {};

    /** Edge-triggered press (true for exactly one frame) */
    this._justPressed = {};

    /** Edge-triggered release */
    this._justReleased = {};

    /** Input buffer: array of { action, timestamp } */
    this._buffer = [];
    this._bufferWindow = 200; // ms

    this._active = false;
    this._boundKeyDown = this._onKeyDown.bind(this);
    this._boundKeyUp   = this._onKeyUp.bind(this);
  }

  enable() {
    if (this._active) return;
    window.addEventListener('keydown', this._boundKeyDown);
    window.addEventListener('keyup',   this._boundKeyUp);
    this._active = true;
  }

  disable() {
    window.removeEventListener('keydown', this._boundKeyDown);
    window.removeEventListener('keyup',   this._boundKeyUp);
    this._active = false;
    this._keys = {};
    this._justPressed = {};
    this._justReleased = {};
  }

  _onKeyDown(e) {
    // Prevent browser default for game keys
    const gameCodes = new Set(Object.values(KEYMAP_P1).concat(Object.values(KEYMAP_P2)));
    if (gameCodes.has(e.code)) e.preventDefault();

    if (!this._keys[e.code]) {
      this._justPressed[e.code] = true;
      // push to buffer
      this._buffer.push({ code: e.code, time: performance.now() });
    }
    this._keys[e.code] = true;
  }

  _onKeyUp(e) {
    this._keys[e.code] = false;
    this._justReleased[e.code] = true;
  }

  /**
   * Call once per frame AFTER processing, to clear edge triggers.
   */
  flush() {
    this._justPressed  = {};
    this._justReleased = {};
    // expire old buffer entries
    const now = performance.now();
    this._buffer = this._buffer.filter(e => now - e.time < this._bufferWindow);
  }

  // ── Query helpers ──

  isDown(code)      { return !!this._keys[code]; }
  wasPressed(code)  { return !!this._justPressed[code]; }
  wasReleased(code) { return !!this._justReleased[code]; }

  /** Check action for a specific player keymap */
  actionDown(action, keymap)    { return this.isDown(keymap[action]); }
  actionPressed(action, keymap) { return this.wasPressed(keymap[action]); }

  /**
   * Check if an action was pressed within the buffer window.
   * Useful for leniency in combo inputs.
   */
  buffered(code) {
    return this._buffer.some(e => e.code === code);
  }

  /**
   * Consume a buffered input (remove it so it doesn't fire twice)
   */
  consume(code) {
    this._buffer = this._buffer.filter(e => e.code !== code);
    this._justPressed[code] = false;
  }
}

// Singleton
export const inputManager = new InputManager();
