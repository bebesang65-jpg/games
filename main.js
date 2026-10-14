/**
 * IRON FIST LEAGUE — Main Controller  (v2 — Full UI/UX)
 *
 * Owns: screen management, all menu navigation, game flow orchestration.
 * Connects:
 *   Main Menu → Character Select → Stage Select → Match Intro → Gameplay → Results
 *   Main Menu → Training Setup → Gameplay (training mode)
 *   Main Menu → Settings
 *
 * Every navigation element is wired to real game state.
 * Selected character + stage propagate into GameEngine.
 */

import { CHARACTER_DATA, STAGE_DATA } from '../data/characters.js';
import { GameEngine }      from './game.js';
import { inputManager }    from './input.js';
import { audioManager }    from './audio.js';
import { buildStatBars }   from './ui.js';
import { drawPortrait, preloadCharacterSprites } from './animation.js';
import { drawStagePreview } from './stages.js';
import { authService } from './auth-professional.js';
import { authUIManager } from './auth-ui-manager.js';
import { getCurrentUser, isCharacterUnlocked, getCharacterRequirements, isGuest } from './auth.js'; // Keep old ones temporarily for compatibility
import { initDashboard, showDashboard } from './dashboard.js';

// ══════════════════════════════════════════════════
//  SCREEN IDs
// ══════════════════════════════════════════════════
const SCREENS = {
  WELCOME:      'screen-welcome',
  LOGIN:        'screen-login',
  MAIN_MENU:    'screen-main-menu',
  DASHBOARD:    'screen-dashboard',
  CHAR_SELECT:  'screen-char-select',
  STAGE_SELECT: 'screen-stage-select',
  MATCH_INTRO:  'screen-match-intro',
  GAMEPLAY:     'screen-gameplay',
  RESULT:       'screen-result',
  SETTINGS:     'screen-settings',
  TRAINING:     'screen-training',
};

// ══════════════════════════════════════════════════
//  APPLICATION STATE  (single source of truth)
// ══════════════════════════════════════════════════
const appState = {
  currentScreen:  'MAIN_MENU',
  prevScreen:     null,

  // Match selections
  selectedP1Char: 'marcus',
  selectedP2Char: 'vesper',
  selectedStage:  'underground',
  gameMode:       'arcade',    // 'arcade' | 'versus' | 'training'

  // Training-specific
  trainingChar:    'marcus',
  trainingDummy:   'vesper',
  trainingStage:   'underground',

  // Runtime
  gameEngine: null,
  isTrainingMode: false,

  // Settings (read into game at match start)
  settings: {
    difficulty:       'normal',
    timerSetting:     '99',
    roundsToWin:      2,
    debugMode:        false,
    infiniteHealth:   false,
    infiniteMeter:    false,
    showHitboxes:     false,
    showHurtboxes:    false,
    screenShake:      'full',
    // Training overrides (merged at start)
    trainingDummyBehavior: 'cpu',
  },
};

// ══════════════════════════════════════════════════
//  SCREEN TRANSITIONS
// ══════════════════════════════════════════════════

function showScreen(screenKey) {
  Object.values(SCREENS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });

  const target = document.getElementById(SCREENS[screenKey]);
  if (target) {
    target.classList.add('active');
    // Retrigger fade animation
    target.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    target.offsetHeight;          // force reflow
    target.style.animation = 'fadeIn 0.25s ease';
  }

  appState.prevScreen    = appState.currentScreen;
  appState.currentScreen = screenKey;
}

// Make showScreen available globally for other modules
window.__iflShowScreen = showScreen;

// ══════════════════════════════════════════════════
//  SETTINGS  —  helpers to read current DOM values
// ══════════════════════════════════════════════════

function readSettingsFromDOM() {
  appState.settings.difficulty     = document.getElementById('setting-difficulty')?.value  || 'normal';
  appState.settings.timerSetting   = document.getElementById('setting-timer')?.value       || '99';
  appState.settings.roundsToWin    = parseInt(document.getElementById('setting-rounds')?.value || '2');
  appState.settings.debugMode      = document.getElementById('setting-debug')?.checked     || false;
  appState.settings.showHitboxes   = document.getElementById('setting-hitboxes')?.checked  || false;
  appState.settings.showHurtboxes  = document.getElementById('setting-hurtboxes')?.checked || false;
  appState.settings.infiniteHealth = document.getElementById('setting-infinite-health')?.checked || false;
  appState.settings.infiniteMeter  = document.getElementById('setting-infinite-meter')?.checked  || false;
  appState.settings.screenShake    = document.getElementById('setting-screenshake')?.value || 'full';
}

// ══════════════════════════════════════════════════
//  1. MAIN MENU
// ══════════════════════════════════════════════════

function initMainMenu() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  let activeIdx = 0;
  const buttons = Array.from(nav.querySelectorAll('.nav-item'));

  function setActive(idx) {
    activeIdx = Math.max(0, Math.min(buttons.length - 1, idx));
    buttons.forEach((b, i) => b.classList.toggle('active', i === activeIdx));
  }

  buttons.forEach((btn, i) => {
    btn.addEventListener('mouseenter', () => {
      setActive(i);
      audioManager.play('menuMove');
    });
    btn.addEventListener('click', () => {
      setActive(i);
      handleMenuAction(btn.dataset.action);
    });
  });

  // Window-level keyboard navigation (only fires when on MAIN_MENU)
  window.addEventListener('keydown', (e) => {
    if (appState.currentScreen !== 'MAIN_MENU') return;

    switch (e.code) {
      case 'ArrowDown': case 'KeyS':
        setActive((activeIdx + 1) % buttons.length);
        audioManager.play('menuMove');
        e.preventDefault();
        break;
      case 'ArrowUp': case 'KeyW':
        setActive((activeIdx - 1 + buttons.length) % buttons.length);
        audioManager.play('menuMove');
        e.preventDefault();
        break;
      case 'Enter': case 'Space':
        handleMenuAction(buttons[activeIdx].dataset.action);
        e.preventDefault();
        break;
    }
  });

  setActive(0);
}

function handleMenuAction(action) {
  audioManager.play('menuSelect');

  // Check if user needs to be logged in for game actions
  const gameActions = ['arcade', 'versus', 'training', 'dashboard'];
  
  if (gameActions.includes(action)) {
    // Use the new authService to check if user is logged in
    if (!authService.isLoggedIn()) {
      // Not logged in, show welcome screen with login options
      showScreen('WELCOME');
      
      // Set a callback to proceed with action after successful login
      const originalAction = action;
      const loginCallback = () => {
        // User logged in successfully, now proceed with original action
        proceedWithAction(originalAction);
        // Remove the callback to prevent multiple calls
        authService.off('login', loginCallback);
      };
      
      // Listen for login event
      authService.on('login', loginCallback);
      
      return;
    }
    
    // User is logged in, proceed with action
    proceedWithAction(action);
  } else {
    // Settings and exit don't require login
    proceedWithAction(action);
  }
}

function proceedWithAction(action) {
  switch (action) {
    case 'arcade':
      appState.gameMode = 'arcade';
      appState.isTrainingMode = false;
      showScreen('CHAR_SELECT');
      initCharSelect();
      break;

    case 'versus':
      appState.gameMode = 'versus';
      appState.isTrainingMode = false;
      showScreen('CHAR_SELECT');
      initCharSelect();
      break;

    case 'training':
      appState.gameMode = 'training';
      appState.isTrainingMode = true;
      showScreen('TRAINING');
      initTraining();
      break;

    case 'settings':
      showScreen('SETTINGS');
      break;

    case 'dashboard':
      showDashboard();
      break;

    case 'exit':
      document.body.innerHTML = `
        <div style="
          display:flex; align-items:center; justify-content:center;
          height:100vh; background:#000;
          font-family:'Rajdhani',sans-serif; font-size:32px;
          color:#4ea8de; letter-spacing:0.3em; text-align:center;
          flex-direction:column; gap:16px;">
          <div>IRON FIST LEAGUE</div>
          <div style="font-size:14px; color:#3a6a8a; letter-spacing:0.4em;">THANK YOU FOR PLAYING.</div>
        </div>`;
      break;
  }
}

// ══════════════════════════════════════════════════
//  2. CHARACTER SELECT
// ══════════════════════════════════════════════════

function initCharSelect() {
  const charKeys = Object.keys(CHARACTER_DATA);

  // ── Mode badge ──
  const badge = document.getElementById('cs-mode-badge');
  if (badge) {
    const labels = { arcade: 'VS CPU', versus: 'VERSUS', training: 'TRAINING' };
    badge.textContent = labels[appState.gameMode] || 'VS CPU';
  }

  // ── P2 label ──
  const p2Label = document.getElementById('cs-p2-label');
  if (p2Label) p2Label.textContent = appState.gameMode === 'versus' ? 'PLAYER 2' : 'CPU';

  // ── Controls hint ──
  const hint = document.querySelector('.cs-controls-hint');
  if (hint) {
    hint.innerHTML = appState.gameMode === 'versus'
      ? 'P1: ← → ↑ ↓ + ENTER &nbsp;|&nbsp; P2: A D W S + F'
      : '← → ↑ ↓ SELECT &nbsp;·&nbsp; ENTER CONFIRM &nbsp;·&nbsp; R REROLL CPU';
  }

  const roster   = document.getElementById('cs-roster');
  const fightBtn = document.getElementById('btn-fight');
  if (!roster || !fightBtn) return;

  // ── Build roster grid ──
  roster.innerHTML = '';
  charKeys.forEach(key => {
    const charData = CHARACTER_DATA[key];
    const isUnlocked = isCharacterUnlocked(key);
    const requirements = getCharacterRequirements(key);
    
    const cell = document.createElement('div');
    cell.className    = 'cs-roster-cell';
    cell.dataset.char = key;
    cell.dataset.unlocked = isUnlocked;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', isUnlocked ? charData.name : `${charData.name} (Locked)`);
    cell.setAttribute('tabindex', '0');
    
    if (!isUnlocked) {
      cell.classList.add('locked');
      cell.setAttribute('aria-disabled', 'true');
    }

    const miniCanvas = document.createElement('canvas');
    miniCanvas.width  = 110;
    miniCanvas.height = 130;
    _drawMiniPortrait(miniCanvas.getContext('2d'), key, 110, 130);
    cell.appendChild(miniCanvas);

    const nameEl = document.createElement('div');
    nameEl.className   = 'cs-roster-cell-name';
    nameEl.textContent = charData.name;
    cell.appendChild(nameEl);
    
    // Add lock icon for locked characters
    if (!isUnlocked) {
      const lockIcon = document.createElement('div');
      lockIcon.className = 'cs-lock-icon';
      lockIcon.innerHTML = '🔒';
      cell.appendChild(lockIcon);
      
      const requirementEl = document.createElement('div');
      requirementEl.className = 'cs-requirement';
      requirementEl.textContent = requirements.required > 0 ? 
        `${requirements.required} points` : requirements.description;
      cell.appendChild(requirementEl);
    }

    if (isUnlocked) {
      cell.addEventListener('mouseenter', () => audioManager.play('menuMove'));
      cell.addEventListener('click', () => {
        _handleP1Select(key);
        audioManager.play('menuSelect');
      });
      cell.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          _handleP1Select(key);
          audioManager.play('menuSelect');
        }
      });
    } else {
      cell.addEventListener('click', () => {
        audioManager.play('menuError');
        _showLockedMessage(key, requirements);
      });
      cell.addEventListener('keydown', (e) => {
        if (e.code === 'Enter' || e.code === 'Space') {
          audioManager.play('menuError');
          _showLockedMessage(key, requirements);
        }
      });
    }
    roster.appendChild(cell);
  });

  // ── Initial selections ──
  if (!CHARACTER_DATA[appState.selectedP1Char]) appState.selectedP1Char = charKeys[0];
  if (!CHARACTER_DATA[appState.selectedP2Char]) appState.selectedP2Char = charKeys[1] || charKeys[0];

  // In CPU mode pick a random opponent
  if (appState.gameMode !== 'versus') {
    appState.selectedP2Char = _randomCPUChar(appState.selectedP1Char);
  }

  selectP1Char(appState.selectedP1Char);
  if (appState.gameMode === 'versus') {
    selectP2Char(appState.selectedP2Char);
  } else {
    _updateP2Preview(appState.selectedP2Char);
  }

  // ── Fight button ──
  fightBtn.disabled = false;
  fightBtn.onclick = () => {
    audioManager.play('menuSelect');
    showScreen('STAGE_SELECT');
    initStageSelect();
  };

  // ── Keyboard nav ──
  let p1Idx = Math.max(0, charKeys.indexOf(appState.selectedP1Char));
  let p2Idx = Math.max(0, charKeys.indexOf(appState.selectedP2Char));
  const COLS = 5;

  const csKeyHandler = (e) => {
    if (appState.currentScreen !== 'CHAR_SELECT') {
      window.removeEventListener('keydown', csKeyHandler);
      return;
    }
    const total = charKeys.length;

    // P1 — arrow keys
    switch (e.code) {
      case 'ArrowRight':
        p1Idx = (p1Idx + 1) % total;
        _handleP1Select(charKeys[p1Idx]);
        audioManager.play('menuMove');
        e.preventDefault(); return;
      case 'ArrowLeft':
        p1Idx = (p1Idx - 1 + total) % total;
        _handleP1Select(charKeys[p1Idx]);
        audioManager.play('menuMove');
        e.preventDefault(); return;
      case 'ArrowDown':
        p1Idx = Math.min(p1Idx + COLS, total - 1);
        _handleP1Select(charKeys[p1Idx]);
        audioManager.play('menuMove');
        e.preventDefault(); return;
      case 'ArrowUp':
        p1Idx = Math.max(p1Idx - COLS, 0);
        _handleP1Select(charKeys[p1Idx]);
        audioManager.play('menuMove');
        e.preventDefault(); return;
      case 'Enter':
        if (!fightBtn.disabled) fightBtn.click();
        e.preventDefault(); return;
      case 'KeyR':
        if (appState.gameMode !== 'versus') {
          appState.selectedP2Char = _randomCPUChar(appState.selectedP1Char);
          p2Idx = charKeys.indexOf(appState.selectedP2Char);
          _updateP2Preview(appState.selectedP2Char);
          audioManager.play('menuSelect');
        }
        e.preventDefault(); return;
      case 'Escape':
        window.removeEventListener('keydown', csKeyHandler);
        showScreen('MAIN_MENU');
        e.preventDefault(); return;
    }

    // P2 — WASD + F (versus only)
    if (appState.gameMode === 'versus') {
      switch (e.code) {
        case 'KeyD':
          p2Idx = (p2Idx + 1) % total;
          selectP2Char(charKeys[p2Idx]);
          audioManager.play('menuMove');
          e.preventDefault(); return;
        case 'KeyA':
          p2Idx = (p2Idx - 1 + total) % total;
          selectP2Char(charKeys[p2Idx]);
          audioManager.play('menuMove');
          e.preventDefault(); return;
        case 'KeyS':
          p2Idx = Math.min(p2Idx + COLS, total - 1);
          selectP2Char(charKeys[p2Idx]);
          audioManager.play('menuMove');
          e.preventDefault(); return;
        case 'KeyW':
          p2Idx = Math.max(p2Idx - COLS, 0);
          selectP2Char(charKeys[p2Idx]);
          audioManager.play('menuMove');
          e.preventDefault(); return;
        case 'KeyF':
          if (!fightBtn.disabled) fightBtn.click();
          e.preventDefault(); return;
      }
    }
  };
  window.addEventListener('keydown', csKeyHandler);

  // ── Back button ──
  const backBtn = document.getElementById('cs-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      window.removeEventListener('keydown', csKeyHandler);
      audioManager.play('menuSelect');
      showScreen('MAIN_MENU');
    };
  }

  // ── CPU reroll button ──
  _ensureCPURerollBtn(() => {
    appState.selectedP2Char = _randomCPUChar(appState.selectedP1Char);
    p2Idx = charKeys.indexOf(appState.selectedP2Char);
    _updateP2Preview(appState.selectedP2Char);
    audioManager.play('menuSelect');
  });
}

// ── Helpers ──

function _randomCPUChar(excludeId) {
  const keys = Object.keys(CHARACTER_DATA);
  const pool = keys.filter(k => k !== excludeId);
  if (!pool.length) return excludeId;
  return pool[Math.floor(Math.random() * pool.length)];
}

function _handleP1Select(charId) {
  selectP1Char(charId);
  // In CPU mode, ensure CPU never matches P1
  if (appState.gameMode !== 'versus' && appState.selectedP2Char === charId) {
    appState.selectedP2Char = _randomCPUChar(charId);
    _updateP2Preview(appState.selectedP2Char);
  }
}

function _ensureCPURerollBtn(onClick) {
  // Remove in versus mode
  const existing = document.getElementById('cs-cpu-reroll');
  if (appState.gameMode === 'versus') { existing?.remove(); return; }
  if (existing) { existing.onclick = onClick; return; }
  const btn = document.createElement('button');
  btn.id = 'cs-cpu-reroll';
  btn.className = 'cs-cpu-reroll-btn';
  btn.setAttribute('aria-label', 'Reroll CPU character');
  btn.innerHTML = '↻ REROLL CPU';
  btn.onclick = onClick;
  document.getElementById('cs-preview-p2')?.appendChild(btn);
}

function _drawMiniPortrait(ctx, charId, w, h) {
  // Per-character accent colors for mini portrait backgrounds
  const CHAR_COLORS = {
    marcus:  { top: '#0a1520', accent: '#4ea8de' },
    vesper:  { top: '#120818', accent: '#cc2a2a' },
    rook:    { top: '#0a1510', accent: '#4aaa44' },
    zero:    { top: '#080c20', accent: '#4488ff' },
    cinder:  { top: '#180a04', accent: '#ff6600' },
    nova:    { top: '#180808', accent: '#ff2222' },
    reaper:  { top: '#0c0c0c', accent: '#888888' },
    titan:   { top: '#100808', accent: '#cc4422' },
    sable:   { top: '#0e0818', accent: '#8844ff' },
    kang:    { top: '#141008', accent: '#ddaa00' },
  };
  const colors = CHAR_COLORS[charId] || { top: '#0a0a18', accent: '#4ea8de' };

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, colors.top);
  bg.addColorStop(1, '#020305');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Try to draw real idle_0.png sprite
  const img = new Image();
  img.onload = () => {
    // Clear and redraw bg
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Smart background removal — samples corner pixels to detect bg color
    const off = document.createElement('canvas');
    off.width = img.naturalWidth; off.height = img.naturalHeight;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0);
    try {
      const iw = off.width, ih = off.height;
      const id = octx.getImageData(0, 0, iw, ih);
      const d = id.data;

      // Sample 4 corners to detect background color
      const corners = [
        [0, 0], [iw - 1, 0], [0, ih - 1], [iw - 1, ih - 1]
      ];
      let bgR = 0, bgG = 0, bgB = 0, count = 0;
      for (const [cx, cy] of corners) {
        const idx = (cy * iw + cx) * 4;
        if (d[idx + 3] > 200) { // only count opaque corners
          bgR += d[idx]; bgG += d[idx + 1]; bgB += d[idx + 2]; count++;
        }
      }
      if (count > 0) { bgR /= count; bgG /= count; bgB /= count; }

      // Remove pixels similar to background color (tolerance = 40)
      const TOL = 40;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
        if (a < 10) continue; // already transparent
        const dr = Math.abs(r - bgR), dg = Math.abs(g - bgG), db = Math.abs(b - bgB);
        const diff = (dr + dg + db) / 3;
        if (diff < TOL) {
          // Fade edges smoothly
          d[i+3] = Math.round((diff / TOL) * 255 * 0.5);
        } else if (diff < TOL * 1.5) {
          // Semi-transparent edge
          d[i+3] = Math.round(((diff - TOL) / (TOL * 0.5)) * a);
        }
      }
      octx.putImageData(id, 0, 0);
    } catch(e) {}

    // Scale to fit cell — centered, bottom-aligned
    const HORIZONTAL = off.width > off.height * 1.3;
    const scale = HORIZONTAL ? (w * 0.9) / off.width : (h * 0.88) / off.height;
    const dw = off.width * scale;
    const dh = off.height * scale;
    const dx = (w - dw) / 2;
    const dy = h - dh - 2;
    ctx.drawImage(off, dx, dy, dw, dh);

    // Accent line at bottom
    ctx.strokeStyle = colors.accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(4, h - 18); ctx.lineTo(w - 4, h - 18); ctx.stroke();
    ctx.globalAlpha = 1;
  };
  img.onerror = () => {
    // Fallback: draw canvas art via drawPortrait
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    drawPortrait(ctx, charId);
  };
  img.src = `assets/characters/${charId}/idle_0.png`;
}

function selectP1Char(charId) {
  appState.selectedP1Char = charId;

  // Refresh all highlights (handle same-char in versus mode)
  _refreshRosterHighlights();

  _updateCharPreview('p1', charId);

  const vsName = document.getElementById('cs-vs-name-p1');
  if (vsName) vsName.textContent = CHARACTER_DATA[charId]?.name || '';
}

function selectP2Char(charId) {
  appState.selectedP2Char = charId;

  _refreshRosterHighlights();

  _updateCharPreview('p2', charId);

  const vsName = document.getElementById('cs-vs-name-p2');
  if (vsName) vsName.textContent = CHARACTER_DATA[charId]?.name || '';
}

function _refreshRosterHighlights() {
  document.querySelectorAll('.cs-roster-cell').forEach(c => {
    const key = c.dataset.char;
    c.classList.remove('selected-p1', 'selected-p2');
    if (key === appState.selectedP1Char) c.classList.add('selected-p1');
    if (key === appState.selectedP2Char) c.classList.add('selected-p2');
  });
}

function _updateCharPreview(side, charId) {
  const charData = CHARACTER_DATA[charId];
  if (!charData) return;

  const nameEl  = document.getElementById(`cs-name-${side}`);
  const archEl  = document.getElementById(`cs-arch-${side}`);
  const statsEl = document.getElementById(`cs-stats-${side}`);

  if (nameEl)  nameEl.textContent = `${charData.name} ${charData.nickname}`;
  if (archEl)  archEl.textContent = charData.archetype;
  if (statsEl) statsEl.innerHTML  = buildStatBars(charData.stats);

  const canvas = document.getElementById(`portrait-canvas-${side}`);
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPortrait(ctx, charId);
  }
}

function _updateP2Preview(charId) {
  appState.selectedP2Char = charId;
  _refreshRosterHighlights();
  _updateCharPreview('p2', charId);

  const vsName = document.getElementById('cs-vs-name-p2');
  if (vsName) vsName.textContent = CHARACTER_DATA[charId]?.name || '';
}

// ══════════════════════════════════════════════════
//  3. STAGE SELECT
// ══════════════════════════════════════════════════

function initStageSelect() {
  // Fighter chips
  const chipP1 = document.getElementById('ss-chip-p1');
  const chipP2 = document.getElementById('ss-chip-p2');
  if (chipP1) chipP1.textContent = `P1: ${CHARACTER_DATA[appState.selectedP1Char]?.name || ''}`;
  if (chipP2) {
    const label = appState.gameMode === 'versus' ? 'P2' : 'CPU';
    chipP2.textContent = `${label}: ${CHARACTER_DATA[appState.selectedP2Char]?.name || ''}`;
  }

  const grid       = document.getElementById('ss-grid');
  const confirmBtn = document.getElementById('btn-confirm-stage');
  if (!grid || !confirmBtn) return;

  grid.innerHTML = '';

  STAGE_DATA.forEach(stage => {
    const card = document.createElement('div');
    card.className       = 'ss-card';
    card.dataset.stageId = stage.id;
    card.setAttribute('role', 'gridcell');
    card.setAttribute('aria-label', stage.name);
    card.setAttribute('tabindex', '0');

    const canvas = document.createElement('canvas');
    canvas.width      = 280;
    canvas.height     = 160;
    canvas.className  = 'ss-card-preview';
    drawStagePreview(canvas.getContext('2d'), stage);
    card.appendChild(canvas);

    const nameEl = document.createElement('div');
    nameEl.className   = 'ss-card-name';
    nameEl.textContent = stage.name;
    card.appendChild(nameEl);

    card.addEventListener('click',      () => { _selectStage(stage.id); audioManager.play('menuSelect'); });
    card.addEventListener('mouseenter', () => { _selectStage(stage.id); audioManager.play('menuMove'); });
    card.addEventListener('keydown',    (e) => { if (e.code === 'Enter') { _selectStage(stage.id); audioManager.play('menuSelect'); } });

    grid.appendChild(card);
  });

  _selectStage(appState.selectedStage);

  confirmBtn.onclick = () => {
    audioManager.play('menuSelect');
    showScreen('MATCH_INTRO');
    _showMatchIntro();
  };

  const ssKeyHandler = (e) => {
    if (appState.currentScreen !== 'STAGE_SELECT') {
      window.removeEventListener('keydown', ssKeyHandler);
      return;
    }
    if (e.code === 'Enter') { confirmBtn.click(); e.preventDefault(); }
    if (e.code === 'Escape') {
      window.removeEventListener('keydown', ssKeyHandler);
      showScreen('CHAR_SELECT');
    }
  };
  window.addEventListener('keydown', ssKeyHandler);

  // Back button
  const backBtn = document.getElementById('ss-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      window.removeEventListener('keydown', ssKeyHandler);
      audioManager.play('menuSelect');
      showScreen('CHAR_SELECT');
      initCharSelect();
    };
  }
}

function _selectStage(stageId) {
  appState.selectedStage = stageId;

  document.querySelectorAll('.ss-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.stageId === stageId)
  );

  // Update detail panel
  const stage = STAGE_DATA.find(s => s.id === stageId);
  if (stage) {
    const nameEl = document.getElementById('ss-detail-name');
    const descEl = document.getElementById('ss-detail-desc');
    if (nameEl) nameEl.textContent = stage.name;
    if (descEl) descEl.textContent = stage.description || '';
  }
}

// ══════════════════════════════════════════════════
//  4. MATCH INTRO
// ══════════════════════════════════════════════════

function _showMatchIntro() {
  const p1Data = CHARACTER_DATA[appState.selectedP1Char];
  const p2Data = CHARACTER_DATA[appState.selectedP2Char];

  // Stage label
  const stageData = STAGE_DATA.find(s => s.id === appState.selectedStage);
  const stageLabel = document.getElementById('intro-stage-label');
  if (stageLabel) stageLabel.textContent = stageData?.name || '';

  // Fighter names
  _setEl('intro-name-p1', p1Data.name);
  _setEl('intro-nick-p1', p1Data.nickname);
  _setEl('intro-arch-p1', p1Data.archetype);
  _setEl('intro-name-p2', p2Data.name);
  _setEl('intro-nick-p2', p2Data.nickname);
  _setEl('intro-arch-p2', p2Data.archetype);

  // P2 badge
  const p2Badge = document.getElementById('intro-p2-badge');
  if (p2Badge) p2Badge.textContent = appState.gameMode === 'versus' ? 'PLAYER 2' : 'CPU';

  // Round label
  _setEl('intro-round-label', 'ROUND 1');

  // After 3 seconds the countdown bar animation finishes → start gameplay
  setTimeout(() => {
    _startGameplay();
  }, 3000);
}

// ══════════════════════════════════════════════════
//  5. GAMEPLAY
// ══════════════════════════════════════════════════

function _startGameplay() {
  // Destroy any previous engine
  if (appState.gameEngine) {
    appState.gameEngine.destroy();
    appState.gameEngine = null;
  }

  readSettingsFromDOM();

  const p1Data = CHARACTER_DATA[appState.selectedP1Char];
  const p2Data = CHARACTER_DATA[appState.selectedP2Char];

  // Preload sprites for selected characters (runs in background, canvas fallback used until ready)
  preloadCharacterSprites(appState.selectedP1Char);
  preloadCharacterSprites(appState.selectedP2Char);

  showScreen('GAMEPLAY');

  // HUD names
  _setEl('hud-name-p1', p1Data.name);
  _setEl('hud-name-p2', p2Data.name);

  // HUD portraits
  _drawHudPortrait('hud-portrait-p1', p1Data.id);
  _drawHudPortrait('hud-portrait-p2', p2Data.id);

  // Ghost bars — initialise to 100%
  _setWidth('hud-health-ghost-p1', 100);
  _setWidth('hud-health-ghost-p2', 100);

  // Meter ready labels
  _setMeterReady('meter-ready-p1', false);
  _setMeterReady('meter-ready-p2', false);

  // Training mode overlay in pause
  const trainingInfo = document.getElementById('pause-training-info');
  const trainingToggle = document.getElementById('pause-training-toggle');
  if (trainingInfo)  trainingInfo.style.display  = appState.isTrainingMode ? 'block' : 'none';
  if (trainingToggle) trainingToggle.style.display = appState.isTrainingMode ? 'block' : 'none';

  inputManager.enable();
  audioManager.init();

  // Build settings object passed to engine
  const engineSettings = {
    ...appState.settings,
    isTrainingMode: appState.isTrainingMode,
    isVersusMode:   appState.gameMode === 'versus',
  };

  // Training overrides
  if (appState.isTrainingMode) {
    engineSettings.infiniteHealth = document.getElementById('training-infinite-health')?.checked ?? true;
    engineSettings.infiniteMeter  = document.getElementById('training-infinite-meter')?.checked  ?? true;
    engineSettings.showHitboxes   = document.getElementById('training-show-hitboxes')?.checked   ?? false;
    engineSettings.debugMode      = document.getElementById('training-frame-data')?.checked      ?? false;
    engineSettings.timerSetting   = 'infinite';
    engineSettings.trainingDummyBehavior = document.getElementById('training-dummy-behavior')?.value || 'cpu';
  }

  appState.gameEngine = new GameEngine(
    p1Data,
    p2Data,
    appState.selectedStage,
    engineSettings,
    _onMatchEnd
  );

  // Register round-result overlay callback (avoids circular import)
  appState.gameEngine.onRoundEnd = showRoundResult;
}

function _drawHudPortrait(elId, charId) {
  const el = document.getElementById(elId);
  if (!el) return;
  let canvas = el.querySelector('canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width  = 56;
    canvas.height = 56;
    canvas.style.width  = '100%';
    canvas.style.height = '100%';
    el.appendChild(canvas);
  }
  drawPortrait(canvas.getContext('2d'), charId);
}

// Called each frame from GameEngine to update ghost health bars
export function updateHealthGhost(side, pct) {
  const id = `hud-health-ghost-p${side}`;
  _setWidth(id, pct);
}

// Called from GameEngine when meter hits 100
export function setMeterReady(side, ready) {
  _setMeterReady(`meter-ready-p${side}`, ready);
}

function _setMeterReady(elId, ready) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = ready ? 'READY' : '';
  el.classList.toggle('ready', ready);
}

// ══════════════════════════════════════════════════
//  ROUND RESULT overlay  (between rounds)
// ══════════════════════════════════════════════════

export function showRoundResult(roundNum, winnerName, p1Wins, p2Wins, onDone) {
  const overlay = document.getElementById('round-result-overlay');
  const panel   = document.getElementById('round-result-panel');
  if (!overlay || !panel) { if (onDone) setTimeout(onDone, 1000); return; }

  // Title
  _setEl('rr-title', `ROUND ${roundNum}`);

  // Winner
  _setEl('rr-winner', winnerName ? `${winnerName} WINS` : 'DRAW');

  // Pips row
  const pipsRow = document.getElementById('rr-pips-row');
  if (pipsRow) {
    pipsRow.innerHTML = '';

    // P1 pips
    const p1Group = document.createElement('div');
    p1Group.className = 'rr-pip-group';
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'rr-pip' + (p1Wins[i] ? ' p1-won' : '');
      p1Group.appendChild(pip);
    }
    pipsRow.appendChild(p1Group);

    const sep = document.createElement('span');
    sep.className = 'rr-pip-sep';
    sep.textContent = 'VS';
    pipsRow.appendChild(sep);

    // P2 pips
    const p2Group = document.createElement('div');
    p2Group.className = 'rr-pip-group';
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'rr-pip' + (p2Wins[i] ? ' p2-won' : '');
      p2Group.appendChild(pip);
    }
    pipsRow.appendChild(p2Group);
  }

  // Next hint
  const totalRounds = roundNum + 1;
  const nextHint = document.getElementById('rr-next-hint');
  if (nextHint) nextHint.textContent = `ROUND ${totalRounds} STARTING…`;

  overlay.style.display = 'flex';

  setTimeout(() => {
    overlay.style.display = 'none';
    if (onDone) onDone();
  }, 2200);
}

export function hideRoundResult() {
  const el = document.getElementById('round-result-overlay');
  if (el) el.style.display = 'none';
}

// ══════════════════════════════════════════════════
//  6. TRAINING MODE SETUP
// ══════════════════════════════════════════════════

function initTraining() {
  _buildTrainingCharGrid();
  _buildTrainingDummyGrid();
  _buildTrainingStageList();
  _buildTrainingMoveList(appState.trainingChar);
  _updateTrainingInfo();

  // Start Training button
  const startBtn = document.getElementById('btn-start-training');
  if (startBtn) {
    startBtn.onclick = () => {
      audioManager.play('menuSelect');
      // Copy training selections into match state
      appState.selectedP1Char = appState.trainingChar;
      appState.selectedP2Char = appState.trainingDummy;
      appState.selectedStage  = appState.trainingStage;
      appState.isTrainingMode = true;
      // Skip match intro for training — go straight to gameplay
      showScreen('GAMEPLAY');
      _startGameplay();
    };
  }

  // Back button
  const backBtn = document.getElementById('training-back-btn');
  if (backBtn) {
    backBtn.onclick = () => {
      audioManager.play('menuSelect');
      showScreen('MAIN_MENU');
    };
  }

  // Live updates from options
  ['training-dummy-behavior', 'training-infinite-health', 'training-infinite-meter',
   'training-show-hitboxes', 'training-frame-data'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', _updateTrainingInfo);
  });
}

function _buildTrainingCharGrid() {
  const grid = document.getElementById('training-char-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.keys(CHARACTER_DATA).forEach(key => {
    const charData = CHARACTER_DATA[key];
    const cell = document.createElement('div');
    cell.className    = 'training-char-cell';
    cell.dataset.char = key;
    if (key === appState.trainingChar) cell.classList.add('selected-player');

    const iconDiv = document.createElement('div');
    iconDiv.className = 'training-char-icon';
    const canvas = document.createElement('canvas');
    canvas.width  = 56;
    canvas.height = 56;
    _drawMiniPortrait(canvas.getContext('2d'), key, 56, 56);
    iconDiv.appendChild(canvas);
    cell.appendChild(iconDiv);

    const nameEl = document.createElement('div');
    nameEl.className   = 'training-char-name';
    nameEl.textContent = charData.name;
    cell.appendChild(nameEl);

    cell.addEventListener('click', () => {
      appState.trainingChar = key;
      document.querySelectorAll('#training-char-grid .training-char-cell').forEach(c =>
        c.classList.toggle('selected-player', c.dataset.char === key)
      );
      _buildTrainingMoveList(key);
      _updateTrainingInfo();
      audioManager.play('menuSelect');
    });

    grid.appendChild(cell);
  });
}

function _buildTrainingDummyGrid() {
  const grid = document.getElementById('training-dummy-grid');
  if (!grid) return;
  grid.innerHTML = '';

  Object.keys(CHARACTER_DATA).forEach(key => {
    const charData = CHARACTER_DATA[key];
    const cell = document.createElement('div');
    cell.className    = 'training-char-cell';
    cell.dataset.char = key;
    if (key === appState.trainingDummy) cell.classList.add('selected-dummy');

    const iconDiv = document.createElement('div');
    iconDiv.className = 'training-char-icon';
    const canvas = document.createElement('canvas');
    canvas.width  = 56;
    canvas.height = 56;
    _drawMiniPortrait(canvas.getContext('2d'), key, 56, 56);
    iconDiv.appendChild(canvas);
    cell.appendChild(iconDiv);

    const nameEl = document.createElement('div');
    nameEl.className   = 'training-char-name';
    nameEl.textContent = charData.name;
    cell.appendChild(nameEl);

    cell.addEventListener('click', () => {
      appState.trainingDummy = key;
      document.querySelectorAll('#training-dummy-grid .training-char-cell').forEach(c =>
        c.classList.toggle('selected-dummy', c.dataset.char === key)
      );
      _updateTrainingInfo();
      audioManager.play('menuSelect');
    });

    grid.appendChild(cell);
  });
}

function _buildTrainingStageList() {
  const list = document.getElementById('training-stage-list');
  if (!list) return;
  list.innerHTML = '';

  STAGE_DATA.forEach(stage => {
    const item = document.createElement('div');
    item.className       = 'training-stage-item';
    item.dataset.stageId = stage.id;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', stage.id === appState.trainingStage ? 'true' : 'false');
    if (stage.id === appState.trainingStage) item.classList.add('selected');

    const dot = document.createElement('div');
    dot.className  = 'training-stage-dot';
    dot.style.background = stage.accentColor || '#4ea8de';
    item.appendChild(dot);

    const nameEl = document.createElement('div');
    nameEl.className   = 'training-stage-name';
    nameEl.textContent = stage.name;
    item.appendChild(nameEl);

    item.addEventListener('click', () => {
      appState.trainingStage = stage.id;
      document.querySelectorAll('.training-stage-item').forEach(i => {
        i.classList.toggle('selected', i.dataset.stageId === stage.id);
        i.setAttribute('aria-selected', i.dataset.stageId === stage.id ? 'true' : 'false');
      });
      _updateTrainingInfo();
      audioManager.play('menuMove');
    });

    list.appendChild(item);
  });
}

function _buildTrainingMoveList(charId) {
  const charData = CHARACTER_DATA[charId];
  if (!charData) return;

  _setEl('training-movelist-char', charData.name);

  const table = document.getElementById('training-move-table');
  if (!table) return;

  const INPUT_LABELS = {
    lightAttack:  'J',
    heavyAttack:  'K',
    kick:         'L',
    grab:         'I',
    special:      'U (+50m)',
  };

  table.innerHTML = `
    <div class="tm-row tm-header">
      <span>MOVE</span><span>INPUT</span><span>STARTUP</span><span>DAMAGE</span>
    </div>`;

  Object.entries(charData.moves).forEach(([key, move]) => {
    const isSpecial = key === 'special';
    const row = document.createElement('div');
    row.className = 'tm-row' + (isSpecial ? ' tm-special-row' : '');
    row.innerHTML = `
      <span class="tm-move-name">${move.name}</span>
      <span class="tm-input">${INPUT_LABELS[key] || '?'}</span>
      <span class="tm-startup">${move.startup}f</span>
      <span class="tm-damage">${isSpecial && move.hits ? `${move.damage}×${move.hits}` : move.damage}</span>`;
    table.appendChild(row);
  });
}

function _updateTrainingInfo() {
  const charData  = CHARACTER_DATA[appState.trainingChar];
  const dummyData = CHARACTER_DATA[appState.trainingDummy];
  const stageData = STAGE_DATA.find(s => s.id === appState.trainingStage);

  _setEl('training-info-char',  charData?.name  || appState.trainingChar);
  _setEl('training-info-dummy', dummyData?.name || appState.trainingDummy);
  _setEl('training-info-stage', stageData?.name || appState.trainingStage);
}

// Training mode exit from pause menu
export function exitTrainingMode() {
  if (appState.gameEngine) {
    appState.gameEngine.destroy();
    appState.gameEngine = null;
  }
  inputManager.disable();
  appState.isTrainingMode = false;
  appState.gameMode       = 'arcade';
  showScreen('TRAINING');
  initTraining();
}

// ══════════════════════════════════════════════════
//  7. MATCH RESULT
// ══════════════════════════════════════════════════

function _onMatchEnd(winner, stats) {
  inputManager.disable();

  if (!winner) {
    // Player quit → back to main menu
    showScreen('MAIN_MENU');
    return;
  }

  // Award points and record match result for registered users
  if (winner && stats) {
    const isPlayer1Winner = winner.playerIndex === 0;
    const pointsEarned = calculatePoints(isPlayer1Winner, stats);
    const highestCombo = stats.highestCombo || 0;
    
    // Import recordMatchResult function from auth module
    import('./auth.js').then(({ recordMatchResult }) => {
      recordMatchResult(isPlayer1Winner, pointsEarned, highestCombo);
    }).catch(() => {
      console.log('Auth module not available for recording match results');
    });
  }

  showScreen('RESULT');
  _populateResult(winner, stats);
}

/**
 * Calculate points earned based on match performance
 */
function calculatePoints(isWinner, stats) {
  let points = 0;
  
  // Base points for playing
  points += 10;
  
  // Bonus for winning
  if (isWinner) {
    points += 30;
  }
  
  // Bonus for perfect round (no damage taken)
  if (stats.p1RoundArr && stats.p2RoundArr) {
    const perfectRounds = stats.p1RoundArr.filter(win => win === 'perfect').length;
    points += perfectRounds * 15;
  }
  
  // Bonus for high combo
  if (stats.highestCombo && stats.highestCombo >= 5) {
    points += Math.min(20, (stats.highestCombo - 4) * 2);
  }
  
  // Bonus for quick victory (under 30 seconds)
  if (stats.totalTime && stats.totalTime < 30000) {
    points += 10;
  }
  
  return points;
}

function _populateResult(winner, stats) {
  const p1Data = CHARACTER_DATA[appState.selectedP1Char];
  const p2Data = CHARACTER_DATA[appState.selectedP2Char];

  // Match type label
  const typeLabels = { arcade: 'ARCADE MATCH', versus: 'VERSUS MATCH', training: 'TRAINING SESSION' };
  _setEl('result-match-type', typeLabels[appState.gameMode] || 'MATCH RESULT');

  // Winner block
  _setEl('result-winner-name', winner.charData.name);
  _setEl('result-winner-nick', winner.charData.nickname);
  _setEl('result-winner-arch', winner.charData.archetype);

  // Score bar (round diamonds)
  const scoreBar = document.getElementById('result-score-bar');
  if (scoreBar && stats) {
    scoreBar.innerHTML = '';

    // P1 label
    const p1Label = document.createElement('span');
    p1Label.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:12px;color:#4ea8de;letter-spacing:.15em;';
    p1Label.textContent = p1Data.name;
    scoreBar.appendChild(p1Label);

    // Pip row for 3 possible rounds
    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'result-round-pip';
      const p1w = stats.p1RoundArr?.[i];
      const p2w = stats.p2RoundArr?.[i];
      if (p1w) pip.classList.add('p1-win');
      else if (p2w) pip.classList.add('p2-win');
      else pip.classList.add('draw');
      pip.title = `Round ${i + 1}`;
      scoreBar.appendChild(pip);
    }

    const sep = document.createElement('span');
    sep.className = 'result-score-sep';
    sep.textContent = 'VS';
    scoreBar.appendChild(sep);

    for (let i = 0; i < 3; i++) {
      const pip = document.createElement('div');
      pip.className = 'result-round-pip';
      const p1w = stats.p1RoundArr?.[i];
      const p2w = stats.p2RoundArr?.[i];
      if (p2w) pip.classList.add('p2-win');
      else if (p1w) pip.classList.add('p1-win');
      else pip.classList.add('draw');
      scoreBar.appendChild(pip);
    }

    const p2Label = document.createElement('span');
    p2Label.style.cssText = 'font-family:Rajdhani,sans-serif;font-size:12px;color:#e05050;letter-spacing:.15em;';
    p2Label.textContent = p2Data.name;
    scoreBar.appendChild(p2Label);
  }

  // Summary stats
  const statsEl = document.getElementById('result-stats');
  if (statsEl && stats) {
    statsEl.innerHTML = `
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.p1Rounds}</div>
        <div class="result-stat-label">P1 ROUNDS</div>
      </div>
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.p2Rounds}</div>
        <div class="result-stat-label">${appState.gameMode === 'versus' ? 'P2' : 'CPU'} ROUNDS</div>
      </div>
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.maxCombo || 0}</div>
        <div class="result-stat-label">BEST COMBO</div>
      </div>
      <div class="result-stat-item">
        <div class="result-stat-value">${stats.totalDamage || 0}</div>
        <div class="result-stat-label">TOTAL DMG</div>
      </div>`;
  }

  // Per-player breakdown
  const playerStatsEl = document.getElementById('result-player-stats');
  if (playerStatsEl && stats) {
    playerStatsEl.innerHTML = `
      <div class="result-player-col">
        <div class="result-player-col-title p1-title">${p1Data.name}</div>
        <div class="result-stat-detail"><span>ROUNDS WON</span><span>${stats.p1Rounds}</span></div>
        <div class="result-stat-detail"><span>DMG DEALT</span><span>${stats.p1TotalDmg || 0}</span></div>
        <div class="result-stat-detail"><span>BEST COMBO</span><span>${stats.p1MaxCombo || 0}</span></div>
        <div class="result-stat-detail"><span>SPECIALS</span><span>${stats.p1Specials || 0}</span></div>
      </div>
      <div class="result-player-col">
        <div class="result-player-col-title p2-title">${p2Data.name}</div>
        <div class="result-stat-detail"><span>ROUNDS WON</span><span>${stats.p2Rounds}</span></div>
        <div class="result-stat-detail"><span>DMG DEALT</span><span>${stats.p2TotalDmg || 0}</span></div>
        <div class="result-stat-detail"><span>BEST COMBO</span><span>${stats.p2MaxCombo || 0}</span></div>
        <div class="result-stat-detail"><span>SPECIALS</span><span>${stats.p2Specials || 0}</span></div>
      </div>`;
  }

  // Keyboard nav for result screen
  const btns    = ['btn-rematch', 'btn-char-select', 'btn-main-menu'];
  let rIdx      = 0;
  const rBtns   = btns.map(id => document.getElementById(id)).filter(Boolean);
  const setRA   = () => rBtns.forEach((b, i) => b.classList.toggle('active', i === rIdx));
  setRA();

  const resultKeyHandler = (e) => {
    if (appState.currentScreen !== 'RESULT') {
      window.removeEventListener('keydown', resultKeyHandler);
      return;
    }
    switch (e.code) {
      case 'ArrowDown': case 'KeyS':
        rIdx = (rIdx + 1) % rBtns.length; setRA(); e.preventDefault(); break;
      case 'ArrowUp': case 'KeyW':
        rIdx = (rIdx - 1 + rBtns.length) % rBtns.length; setRA(); e.preventDefault(); break;
      case 'Enter':
        rBtns[rIdx]?.click();
        window.removeEventListener('keydown', resultKeyHandler);
        e.preventDefault();
        break;
    }
  };
  window.addEventListener('keydown', resultKeyHandler);
}

// ══════════════════════════════════════════════════
//  RESULT BUTTONS
// ══════════════════════════════════════════════════

/**
 * Show locked character message
 */
function _showLockedMessage(characterId, requirements) {
  const charData = CHARACTER_DATA[characterId];
  const currentUser = getCurrentUser();
  const currentPoints = currentUser?.totalPoints || 0;
  
  // Create or update message element
  let messageEl = document.getElementById('cs-locked-message');
  if (!messageEl) {
    messageEl = document.createElement('div');
    messageEl.id = 'cs-locked-message';
    messageEl.className = 'cs-locked-message';
    document.querySelector('.cs-center').appendChild(messageEl);
  }
  
  const pointsNeeded = requirements.required - currentPoints;
  
  messageEl.innerHTML = `
    <div class="cs-locked-title">${charData.name} - LOCKED</div>
    <div class="cs-locked-requirement">${requirements.description}</div>
    ${requirements.required > 0 ? `
    <div class="cs-locked-progress">
      <div class="cs-locked-progress-bar">
        <div class="cs-locked-progress-fill" style="width: ${Math.min(100, (currentPoints / requirements.required) * 100)}%"></div>
      </div>
      <div class="cs-locked-progress-text">
        ${currentPoints}/${requirements.required} points
        ${pointsNeeded > 0 ? `(${pointsNeeded} more needed)` : ''}
      </div>
    </div>` : ''}
    <div class="cs-locked-hint">Play matches to earn points and unlock characters</div>
  `;
  
  // Auto-hide after 5 seconds
  clearTimeout(window._lockedMessageTimeout);
  window._lockedMessageTimeout = setTimeout(() => {
    if (messageEl) {
      messageEl.style.opacity = '0';
      setTimeout(() => {
        if (messageEl && messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 500);
    }
  }, 5000);
}

function initResultButtons() {
  document.getElementById('btn-rematch')?.addEventListener('click', () => {
    audioManager.play('menuSelect');
    showScreen('MATCH_INTRO');
    _showMatchIntro();
  });

  document.getElementById('btn-char-select')?.addEventListener('click', () => {
    audioManager.play('menuSelect');
    if (appState.isTrainingMode) {
      appState.isTrainingMode = false;
      appState.gameMode = 'arcade';
    }
    showScreen('CHAR_SELECT');
    initCharSelect();
  });

  document.getElementById('btn-main-menu')?.addEventListener('click', () => {
    audioManager.play('menuSelect');
    appState.isTrainingMode = false;
    showScreen('MAIN_MENU');
  });
}

// ══════════════════════════════════════════════════
//  8. SETTINGS
// ══════════════════════════════════════════════════

function initSettings() {
  // Tab switching
  const tabs   = document.querySelectorAll('.settings-tab');
  const panels = document.querySelectorAll('.settings-tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => {
        t.classList.toggle('active', t.dataset.tab === target);
        t.setAttribute('aria-selected', t.dataset.tab === target ? 'true' : 'false');
      });
      panels.forEach(p => {
        const match = p.id === `settings-tab-${target}`;
        p.classList.toggle('active', match);
      });
      audioManager.play('menuMove');
    });
  });

  // Back buttons
  const backFn = () => {
    audioManager.play('menuSelect');
    showScreen(appState.prevScreen || 'MAIN_MENU');
  };
  document.getElementById('settings-back')?.addEventListener('click', backFn);
  document.getElementById('settings-back-btn-top')?.addEventListener('click', backFn);

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (appState.currentScreen !== 'SETTINGS') return;
    if (e.code === 'Escape') backFn();
  });
}

// ══════════════════════════════════════════════════
//  PAUSE MENU  (training toggle wire-up)
// ══════════════════════════════════════════════════

function initPauseButtons() {
  // "Exit Training" button in pause
  const trainingToggle = document.getElementById('pause-training-toggle');
  if (trainingToggle) {
    trainingToggle.addEventListener('click', () => {
      exitTrainingMode();
    });
  }
}

// ══════════════════════════════════════════════════
//  WELCOME SCREEN INITIALIZATION
// ══════════════════════════════════════════════════

function initWelcomeScreen() {
  // Check for existing session via authUIManager
  authUIManager.checkExistingSession().then(hasSession => {
    if (hasSession) {
      // User has valid session, show main menu directly
      showScreen('MAIN_MENU');
    } else {
      // No session, ensure welcome screen is properly set up
      authUIManager.setupWelcomeScreen();
    }
  }).catch(error => {
    console.error('Error checking session:', error);
    // Fallback: ensure welcome screen is set up
    authUIManager.setupWelcomeScreen();
  });
}

// ══════════════════════════════════════════════════
//  UTILITY
// ══════════════════════════════════════════════════

function _setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _setWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.max(0, Math.min(100, pct)) + '%';
}

// ══════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════

function boot() {
  // Unlock AudioContext on first interaction
  document.addEventListener('click',   () => audioManager.init(), { once: true });
  document.addEventListener('keydown', () => audioManager.init(), { once: true });

  // Note: authService and authUIManager are auto-initialized when imported

  // Wire up all persistent screens
  initMainMenu();
  initResultButtons();
  initSettings();
  initPauseButtons();
  initDashboard();

  // Start on welcome cinematic screen
  showScreen('WELCOME');
  
  // Initialize welcome screen
  initWelcomeScreen();

  /* eslint-disable no-console */
  console.log('%c IRON FIST LEAGUE ', 'background:#0a1825; color:#4ea8de; font-size:16px; font-weight:bold; padding:4px 8px;');
  console.log('%c TRAIN. FIGHT. BECOME LEGEND. ', 'color:#7a9db5; font-size:11px;');
  console.log('Controls → A/D:Move  W:Jump  S:Crouch  J:Light  K:Heavy  L:Kick  U:Special  I:Grab  O:Block  ESC:Pause');
  console.log('Screens  → Main Menu → Char Select → Stage Select → Match Intro → Gameplay → Result');
  console.log('Training → Main Menu → Training Setup → Gameplay (infinite health/meter, move reference)');
  /* eslint-enable no-console */
}

// Run after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
