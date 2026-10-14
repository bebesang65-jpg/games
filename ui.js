/**
 * IRON FIST LEAGUE — UI Manager
 *
 * Updates the HTML HUD, menus, overlays.
 * Does NOT do canvas rendering — that's game.js + stages.js.
 * Canvas effects (sparks, VFX) are drawn by game.js directly.
 */

/**
 * Update the health bar DOM element.
 * @param {string} fillId  - element id of fill div
 * @param {number} current
 * @param {number} max
 */
export function updateHealthBar(fillId, current, max) {
  const el = document.getElementById(fillId);
  if (!el) return;
  const pct = Math.max(0, (current / max) * 100);
  el.style.width = pct + '%';

  // Danger coloring
  el.classList.remove('danger', 'warning');
  if (pct <= 20) {
    el.classList.add('danger');
  } else if (pct <= 50) {
    el.classList.add('warning');
  }
}

/**
 * Update the Iron Meter bar.
 */
export function updateMeterBar(fillId, current, max) {
  const el = document.getElementById(fillId);
  if (!el) return;
  el.style.width = Math.min(100, (current / max) * 100) + '%';
}

/**
 * Update the timer display.
 */
export function updateTimer(seconds) {
  const el = document.getElementById('hud-timer');
  if (!el) return;
  el.textContent = seconds < 0 ? '0' : Math.ceil(seconds).toString();
  el.classList.toggle('urgent', seconds <= 10 && seconds >= 0);
}

/**
 * Update round label.
 */
export function updateRoundLabel(round) {
  const el = document.getElementById('hud-round-label');
  if (el) el.textContent = `ROUND ${round}`;
}

/**
 * Update round win pips.
 * @param {number[]} p1Wins - array of booleans per round
 * @param {number[]} p2Wins
 */
export function updateRoundPips(p1Wins, p2Wins) {
  const p1El = document.getElementById('p1-pips');
  const p2El = document.getElementById('p2-pips');
  if (!p1El || !p2El) return;

  const makePips = (winsArr, maxRounds, el) => {
    el.innerHTML = '';
    for (let i = 0; i < maxRounds; i++) {
      const pip = document.createElement('div');
      pip.className = 'round-pip' + (winsArr[i] ? ' won' : '');
      el.appendChild(pip);
    }
  };

  makePips(p1Wins, 3, p1El);
  makePips(p2Wins, 3, p2El);
}

/**
 * Show / update combo display.
 */
export function showCombo(hits, damage) {
  const el     = document.getElementById('hud-combo');
  const hitsEl = document.getElementById('combo-hits');
  const dmgEl  = document.getElementById('combo-damage');
  if (!el || !hitsEl || !dmgEl) return;

  if (hits <= 1) {
    el.style.display = 'none';
    return;
  }

  el.style.display = 'flex';
  hitsEl.textContent = hits;
  dmgEl.textContent  = damage + ' DMG';

  // Re-trigger animation
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = 'comboIn 0.15s ease';
}

export function hideCombo() {
  const el = document.getElementById('hud-combo');
  if (el) el.style.display = 'none';
}

/**
 * Show round announcement overlay.
 * @param {string} text
 * @param {string} cssClass - 'fight' | 'ko' | 'win' | ''
 * @param {number} duration - ms before hiding
 * @param {Function} [onDone]
 */
export function showAnnouncement(text, cssClass = '', duration = 1200, onDone = null) {
  const overlay = document.getElementById('round-announce');
  const textEl  = document.getElementById('announce-text');
  if (!overlay || !textEl) return;

  textEl.textContent = text;
  textEl.className   = 'announce-text' + (cssClass ? ' ' + cssClass : '');
  overlay.style.display = 'flex';

  if (duration > 0) {
    setTimeout(() => {
      overlay.style.display = 'none';
      if (onDone) onDone();
    }, duration);
  }
}

export function hideAnnouncement() {
  const el = document.getElementById('round-announce');
  if (el) el.style.display = 'none';
}

/**
 * Show/hide pause overlay.
 */
export function showPause() {
  const el = document.getElementById('pause-overlay');
  if (el) el.style.display = 'flex';
}

export function hidePause() {
  const el = document.getElementById('pause-overlay');
  if (el) el.style.display = 'none';
}

/**
 * Populate result screen with match data.
 */
export function populateResult(winner, stats) {
  const nameEl = document.getElementById('result-winner-name');
  const nickEl = document.getElementById('result-winner-nick');
  const statsEl = document.getElementById('result-stats');

  if (nameEl) nameEl.textContent = winner.charData.name;
  if (nickEl) nickEl.textContent = winner.charData.nickname;

  if (statsEl && stats) {
    statsEl.innerHTML = `
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.p1Rounds}</div>
        <div class="result-stat-label">P1 ROUNDS</div>
      </div>
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.p2Rounds}</div>
        <div class="result-stat-label">CPU ROUNDS</div>
      </div>
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.maxCombo}</div>
        <div class="result-stat-label">BEST COMBO</div>
      </div>
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.totalDamage}</div>
        <div class="result-stat-label">TOTAL DMG</div>
      </div>
    `;
  }
}

/**
 * Build stat bar HTML for character select.
 * @param {Object} stats - { health, damage, speed, defense, mobility, difficulty }
 * @returns {string} HTML
 */
export function buildStatBars(stats) {
  const LABELS = ['HEALTH', 'DAMAGE', 'SPEED', 'DEFENSE', 'MOBILITY'];
  const KEYS   = ['health', 'damage', 'speed', 'defense', 'mobility'];
  const COLOR_CLASS = (v) => v >= 8 ? '' : v >= 5 ? 'warning' : 'danger';

  return LABELS.map((lbl, i) => {
    const key = KEYS[i];
    const val = stats[key] || 0;
    const pct = (val / 10) * 100;
    const cc  = COLOR_CLASS(val);
    return `
      <div class="stat-row">
        <div class="stat-label">${lbl}</div>
        <div class="stat-bar-wrap">
          <div class="stat-bar-fill ${cc}" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

/**
 * Draw a character portrait into a canvas element by ID.
 */
export function renderPortraitCanvas(canvasId, characterId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  // Import on demand to avoid circular deps — called from main.js
  import('./animation.js').then(({ drawPortrait }) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPortrait(ctx, characterId);
  });
}
