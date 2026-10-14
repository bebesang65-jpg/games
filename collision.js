/**
 * IRON FIST LEAGUE — Collision & Hitbox / Hurtbox System
 *
 * All geometry is in world-space pixels.
 * Box format: { x, y, w, h } where x,y = top-left corner.
 *
 * Phase 2 upgrades:
 *  - State-aware hurtboxes (stand / crouch / air / knockdown)
 *  - Correct directional hitbox mirroring
 *  - State-aware pushboxes (crouch shrinks pushbox)
 *  - Per-frame active-hit-zone exported for debug
 *  - Rich labeled debug overlay: hurtbox / hitbox / pushbox / origin / frame data
 */

// ══════════════════════════════════════════════════════════
//  AABB OVERLAP
// ══════════════════════════════════════════════════════════

/**
 * Axis-aligned bounding box overlap test.
 * @param {Object} a - { x, y, w, h }
 * @param {Object} b - { x, y, w, h }
 * @returns {boolean}
 */
export function boxOverlap(a, b) {
  return (
    a.x         < b.x + b.w &&
    a.x + a.w   > b.x       &&
    a.y         < b.y + b.h &&
    a.y + a.h   > b.y
  );
}

// ══════════════════════════════════════════════════════════
//  HURTBOX  —  the defender's vulnerable body area
// ══════════════════════════════════════════════════════════

/**
 * Returns the active hurtbox for a player.
 * Hurtbox dimensions vary by character and combat state.
 *
 * Dimension table (width × height):
 *   State       Marcus    Vesper
 *   ─────────── ────────  ───────
 *   stand       48 × 185  36 × 175
 *   crouch      44 × 105  32 ×  85   ← Phase 2: accurate low-profile
 *   jump/fall   38 × 155  28 × 145   ← Phase 2: compressed air hurtbox
 *   knockdown   90 ×  40  70 ×  38   ← Phase 2: lying-on-ground box
 *   wakeup      80 ×  80  64 ×  80   ← Phase 2: rising, partial invuln region
 *
 * @param {Object} player
 * @returns {{ x, y, w, h, state: string }}
 */
export function getHurtbox(player) {
  const isMarcus = player.charData.id === 'marcus';
  const px = player.x;
  const py = player.y; // feet

  let w, h, offX = 0, offY;

  switch (player.state) {
    case 'crouch':
      w    = isMarcus ? 44 : 32;
      h    = isMarcus ? 105 : 85;
      offX = 0;
      offY = -h;
      break;

    case 'jump':
    case 'fall':
      w    = isMarcus ? 38 : 28;
      h    = isMarcus ? 155 : 145;
      offY = -h;
      break;

    case 'knockdown':
      // Lying flat — wide, short
      w    = isMarcus ? 90 : 70;
      h    = isMarcus ? 40 : 38;
      offY = -h;
      break;

    case 'getup':
      // Wakeup — rising posture; invincible frames handled in Player, but
      // we still expose a hurtbox for the debug overlay.
      w    = isMarcus ? 52 : 40;
      h    = isMarcus ? 160 : 150;
      offY = -h;
      break;

    case 'grabbed':
    case 'thrown':
      // Grabbed state — compact, centered
      w    = isMarcus ? 44 : 34;
      h    = isMarcus ? 170 : 160;
      offY = -h;
      break;

    default:
      // Standing, idle, walk, attack, block, hit, stun …
      w    = isMarcus ? 48 : 36;
      h    = isMarcus ? 185 : 175;
      offY = -h;
      break;
  }

  return {
    x: px - w / 2 + offX,
    y: py + offY,
    w, h,
    state: player.state,
  };
}

// ══════════════════════════════════════════════════════════
//  HITBOX  —  the attacker's active damage zone
// ══════════════════════════════════════════════════════════

/**
 * Returns the world-space hitbox for an attacking player,
 * or null when no hitbox is active.
 *
 * Coordinate system:
 *   facing = +1  →  hitbox is to the RIGHT of the character
 *   facing = -1  →  hitbox is to the LEFT of the character
 *
 * For facing = +1:
 *   hbX = px + (hitboxOffsetX - hitboxW)   [right-edge at px + hitboxOffsetX]
 * For facing = -1:
 *   hbX = px - hitboxOffsetX               [left-edge at px - hitboxOffsetX]
 *
 * @param {Object} player
 * @returns {{ x, y, w, h, move: string } | null}
 */
export function getHitbox(player) {
  if (!player.attackActive)     return null;
  const moveDef = player.currentMoveDef;
  if (!moveDef)                 return null;

  const dir  = player.facing;  // +1 or -1
  const px   = player.x;
  const py   = player.y;       // feet

  const offX = moveDef.hitboxOffsetX || 50;
  const w    = moveDef.hitboxW       || 50;
  const h    = moveDef.hitboxH       || 30;

  // Vertical offset: grabs hit mid-body; normal attacks hit upper body
  const offY = moveDef.isGrab ? -80 : -90;

  let hbX;
  if (dir === 1) {
    // Facing right: hitbox starts at (px + offX - w) so its right edge is at (px + offX)
    hbX = px + offX - w;
  } else {
    // Facing left: hitbox starts at (px - offX) so its left edge is at (px - offX)
    hbX = px - offX;
  }

  return {
    x: hbX,
    y: py + offY,
    w, h,
    move: moveDef.name || '?',
  };
}

// ══════════════════════════════════════════════════════════
//  PUSHBOX  —  physical separation box
// ══════════════════════════════════════════════════════════

/**
 * Returns the pushbox (physical volume) for a player.
 * Crouch reduces height so corner pressure is visually accurate.
 *
 * @param {Object} player
 * @returns {{ x, y, w, h }}
 */
export function getPushbox(player) {
  const isMarcus = player.charData.id === 'marcus';

  let w, h;
  if (player.state === 'crouch') {
    w = isMarcus ? 46 : 34;
    h = isMarcus ? 120 : 95;
  } else if (player.state === 'knockdown' || player.state === 'getup') {
    // Lying down — minimal pushbox
    w = isMarcus ? 60 : 48;
    h = isMarcus ? 30 : 28;
  } else {
    w = isMarcus ? 50 : 38;
    h = isMarcus ? 182 : 172;
  }

  return {
    x: player.x - w / 2,
    y: player.y - h,
    w, h,
  };
}

// ══════════════════════════════════════════════════════════
//  PUSHBOX RESOLUTION
// ══════════════════════════════════════════════════════════

/**
 * Resolve pushbox overlap each frame — keeps characters from occupying
 * the same space. Splits the overlap evenly unless one fighter is against
 * a wall, in which case the wall-side fighter absorbs all the push.
 *
 * @param {Object} p1
 * @param {Object} p2
 * @param {number} stageLeft
 * @param {number} stageRight
 */
export function resolvePushboxes(p1, p2, stageLeft, stageRight) {
  const pb1 = getPushbox(p1);
  const pb2 = getPushbox(p2);

  if (!boxOverlap(pb1, pb2)) return;

  // Midpoints
  const mid1 = pb1.x + pb1.w / 2;
  const mid2 = pb2.x + pb2.w / 2;

  let overlap;
  if (mid1 > mid2) {
    overlap = (pb2.x + pb2.w) - pb1.x;
    // p1 is to the right
    const push = overlap / 2 + 0.5;
    const p1AtWall = p1.x + push > stageRight - 26;
    const p2AtWall = p2.x - push < stageLeft  + 26;

    if (p1AtWall && !p2AtWall) {
      p2.x -= overlap + 1;
    } else if (p2AtWall && !p1AtWall) {
      p1.x += overlap + 1;
    } else {
      p1.x = Math.min(p1.x + push, stageRight - 26);
      p2.x = Math.max(p2.x - push, stageLeft  + 26);
    }
  } else {
    overlap = (pb1.x + pb1.w) - pb2.x;
    const push = overlap / 2 + 0.5;
    const p2AtWall = p2.x + push > stageRight - 26;
    const p1AtWall = p1.x - push < stageLeft  + 26;

    if (p2AtWall && !p1AtWall) {
      p1.x -= overlap + 1;
    } else if (p1AtWall && !p2AtWall) {
      p2.x += overlap + 1;
    } else {
      p2.x = Math.min(p2.x + push, stageRight - 26);
      p1.x = Math.max(p1.x - push, stageLeft  + 26);
    }
  }
}

// ══════════════════════════════════════════════════════════
//  DEBUG VISUALIZATION
// ══════════════════════════════════════════════════════════

/**
 * Draw labeled debug boxes for a player.
 * Called from player.draw() when debugMode or showHitboxes is active.
 *
 * Color legend:
 *   Green  — hurtbox (vulnerable area)
 *   Red    — hitbox  (active damage zone), filled semi-transparent
 *   Yellow — pushbox (physical separation)
 *   Cyan   — origin dot (feet position)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} player
 * @param {boolean} showFrameData  — also print startup/active/recovery info
 */
export function drawDebugBoxes(ctx, player, showFrameData = false) {
  ctx.save();

  const hurtbox = getHurtbox(player);
  const hitbox  = getHitbox(player);
  const pushbox = getPushbox(player);

  // ── Hurtbox (green) ──
  ctx.strokeStyle = 'rgba(0,255,80,0.85)';
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(hurtbox.x, hurtbox.y, hurtbox.w, hurtbox.h);
  ctx.fillStyle   = 'rgba(0,255,80,0.06)';
  ctx.fillRect(hurtbox.x, hurtbox.y, hurtbox.w, hurtbox.h);

  // ── Hitbox (red, filled) ──
  if (hitbox) {
    ctx.strokeStyle = 'rgba(255,40,40,0.95)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(hitbox.x, hitbox.y, hitbox.w, hitbox.h);
    ctx.fillStyle   = 'rgba(255,40,40,0.18)';
    ctx.fillRect(hitbox.x, hitbox.y, hitbox.w, hitbox.h);

    // Move name label
    ctx.fillStyle  = 'rgba(255,150,150,0.9)';
    ctx.font       = '10px monospace';
    ctx.textAlign  = 'left';
    ctx.fillText(hitbox.move, hitbox.x, hitbox.y - 2);
  }

  // ── Pushbox (yellow, outline only) ──
  ctx.strokeStyle = 'rgba(255,220,0,0.55)';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(pushbox.x, pushbox.y, pushbox.w, pushbox.h);
  ctx.setLineDash([]);

  // ── Origin dot (cyan) ──
  ctx.fillStyle = 'rgba(0,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 3, 0, Math.PI * 2);
  ctx.fill();

  // ── State + frame data label ──
  if (showFrameData && player.currentMoveDef) {
    const md = player.currentMoveDef;
    const f  = Math.floor(player.attackFrame);
    let phase = 'startup';
    if (f >= md.startup + md.active)   phase = 'recovery';
    else if (f >= md.startup)           phase = 'ACTIVE';

    const label = `${md.name || '?'} F${f} [${phase}]`;
    ctx.fillStyle  = 'rgba(255,255,100,0.95)';
    ctx.font       = '11px monospace';
    ctx.textAlign  = 'center';
    ctx.fillText(label, player.x, player.y - hurtbox.h - 6);
  } else {
    // Just show state
    ctx.fillStyle  = 'rgba(200,200,200,0.7)';
    ctx.font       = '10px monospace';
    ctx.textAlign  = 'center';
    ctx.fillText(player.state, player.x, player.y - hurtbox.h - 4);
  }

  // ── Invincibility indicator ──
  if (player.invincibleTimer > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth   = 3;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(hurtbox.x - 3, hurtbox.y - 3, hurtbox.w + 6, hurtbox.h + 6);
    ctx.setLineDash([]);
  }

  // ── Wall splat indicator ──
  if (player.wallSplatTimer > 0) {
    ctx.fillStyle  = 'rgba(255,100,0,0.5)';
    ctx.font       = 'bold 11px monospace';
    ctx.textAlign  = 'center';
    ctx.fillText('SPLAT', player.x, player.y - hurtbox.h - 18);
  }

  ctx.restore();
}
