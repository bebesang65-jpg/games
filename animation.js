/**
 * IRON FIST LEAGUE — Animation System
 * Uses individual PNG sprite frames per animation state.
 * Falls back to canvas art if images fail to load.
 */

// ── Sprite cache: _cache[charId][animName][frameIndex] = OffscreenCanvas ──
const _cache = {};

// ── Animation definitions ──
export const ANIM_FPS  = 12;
const FRAME_DURATION   = 1000 / ANIM_FPS;

export const ANIM_DEF = {
  idle:        { frameCount: 4, loop: true  },
  walk:        { frameCount: 6, loop: true  },
  run:         { frameCount: 6, loop: true  },
  crouch:      { frameCount: 2, loop: false },
  jump:        { frameCount: 3, loop: false },
  fall:        { frameCount: 2, loop: false },
  lightAttack: { frameCount: 3, loop: false },
  heavyAttack: { frameCount: 4, loop: false },
  kick:        { frameCount: 3, loop: false },
  block:       { frameCount: 2, loop: false },
  hit:         { frameCount: 2, loop: false },
  knockdown:   { frameCount: 4, loop: false },
  getup:       { frameCount: 3, loop: false },
  grab:        { frameCount: 4, loop: false },
  grabbed:     { frameCount: 2, loop: false },
  thrown:      { frameCount: 3, loop: false },
  special:     { frameCount: 6, loop: false },
  victory:     { frameCount: 5, loop: true  },
  defeat:      { frameCount: 3, loop: false },
};

/**
 * Remove white/near-white background from an image using an offscreen canvas.
 * Returns an OffscreenCanvas (or regular canvas) with transparent background.
 */
function removeBackground(img) {
  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  try {
    const iw = canvas.width, ih = canvas.height;
    const imageData = ctx.getImageData(0, 0, iw, ih);
    const d = imageData.data;

    // Sample 4 corners to auto-detect background color
    const corners = [[0,0],[iw-1,0],[0,ih-1],[iw-1,ih-1]];
    let bgR=0, bgG=0, bgB=0, cnt=0;
    for (const [cx, cy] of corners) {
      const idx = (cy * iw + cx) * 4;
      if (d[idx+3] > 200) { bgR+=d[idx]; bgG+=d[idx+1]; bgB+=d[idx+2]; cnt++; }
    }
    if (cnt > 0) { bgR/=cnt; bgG/=cnt; bgB/=cnt; }

    // Remove pixels matching background color (tolerance = 40)
    const TOL = 40;
    for (let i = 0; i < d.length; i += 4) {
      const r=d[i], g=d[i+1], b=d[i+2], a=d[i+3];
      if (a < 10) continue; // already transparent
      const diff = (Math.abs(r-bgR) + Math.abs(g-bgG) + Math.abs(b-bgB)) / 3;
      if (diff < TOL) {
        d[i+3] = Math.round((diff / TOL) * 255 * 0.5);
      } else if (diff < TOL * 1.5) {
        d[i+3] = Math.round(((diff - TOL) / (TOL * 0.5)) * a);
      }
    }
    ctx.putImageData(imageData, 0, 0);
  } catch(e) {
    // CORS or security — use as-is
  }

  return canvas;
}

/**
 * Preload all PNG frames for a character.
 * @param {string} charId - 'marcus' | 'vesper'
 * @returns {Promise<void>}
 */
export function preloadCharacterSprites(charId) {
  if (_cache[charId]) return Promise.resolve();
  _cache[charId] = {};

  const promises = [];

  for (const [animName, def] of Object.entries(ANIM_DEF)) {
    _cache[charId][animName] = new Array(def.frameCount).fill(null);

    for (let i = 0; i < def.frameCount; i++) {
      const src = `assets/characters/${charId}/${animName}_${i}.png`;
      const idx = i;
      const anim = animName;

      promises.push(new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          _cache[charId][anim][idx] = removeBackground(img);
          resolve();
        };
        img.onerror = () => {
          // Missing frame — leave as null (canvas fallback will draw instead)
          resolve();
        };
        img.src = src;
      }));
    }
  }

  return Promise.all(promises).then(() => {
    console.log(`[IFL] Sprites loaded: ${charId}`);
  });
}

/**
 * Get a cached sprite canvas for a specific frame.
 */
function getSprite(charId, animName, frame) {
  return _cache[charId]?.[animName]?.[frame] ?? null;
}

// ── roundRect polyfill ──
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    const r = typeof radii === 'number' ? radii : Array.isArray(radii) ? radii[0] : 0;
    const c = Math.min(r, Math.abs(w)/2, Math.abs(h)/2);
    this.moveTo(x+c, y);
    this.lineTo(x+w-c, y);  this.quadraticCurveTo(x+w, y, x+w, y+c);
    this.lineTo(x+w, y+h-c); this.quadraticCurveTo(x+w, y+h, x+w-c, y+h);
    this.lineTo(x+c, y+h);   this.quadraticCurveTo(x, y+h, x, y+h-c);
    this.lineTo(x, y+c);     this.quadraticCurveTo(x, y, x+c, y);
    this.closePath();
  };
}

// ════════════════════════════════════════════════════════
//  ANIMATOR CLASS
// ════════════════════════════════════════════════════════
export class Animator {
  constructor(characterId) {
    this.characterId  = characterId;
    this.currentAnim  = 'idle';
    this.currentFrame = 0;
    this._elapsed     = 0;
    this._onComplete  = null;
    this._def         = ANIM_DEF;
  }

  play(name, onComplete = null) {
    if (!this._def[name]) { console.warn(`[Animator] Unknown: ${name}`); return; }
    if (this.currentAnim === name && this._def[name].loop) return;
    this.currentAnim  = name;
    this.currentFrame = 0;
    this._elapsed     = 0;
    this._onComplete  = onComplete;
  }

  update(dt) {
    this._elapsed += dt;
    const def = this._def[this.currentAnim];
    if (!def) return false;
    let completed = false;
    while (this._elapsed >= FRAME_DURATION) {
      this._elapsed -= FRAME_DURATION;
      this.currentFrame++;
      if (this.currentFrame >= def.frameCount) {
        if (def.loop) {
          this.currentFrame = 0;
        } else {
          this.currentFrame = def.frameCount - 1;
          completed = true;
          if (this._onComplete) { const cb = this._onComplete; this._onComplete = null; cb(); }
          break;
        }
      }
    }
    return completed;
  }

  isComplete() {
    const def = this._def[this.currentAnim];
    if (!def || def.loop) return false;
    return this.currentFrame >= def.frameCount - 1 && this._elapsed === 0;
  }

  draw(ctx, x, y, dir, opts = {}) {
    const { alpha = 1, hitFlash = false, armorFlash = false, isAirborne = false } = opts;

    // ── Try PNG sprite ──
    const sprite = getSprite(this.characterId, this.currentAnim, this.currentFrame);
    if (sprite) {
      const sw = sprite.width;
      const sh = sprite.height;

      // Auto-detect orientation based on aspect ratio and animation name
      const HORIZONTAL_ANIMS = new Set(['knockdown', 'defeat', 'thrown']);
      const isHorizontal = HORIZONTAL_ANIMS.has(this.currentAnim) || (sw > sh * 1.3);

      let scale;
      if (isHorizontal) {
        const TARGET_W = 180;
        scale = TARGET_W / sw;
      } else {
        // Use fixed TARGET_H per character to keep size consistent across animations
        const TARGET_H = 200;
        scale = TARGET_H / sh;
        // Clamp: prevent characters from being too small or too large
        scale = Math.max(0.5, Math.min(scale, 3.0));
      }

      const dw = sw * scale;
      const dh = sh * scale;

      ctx.save();
      ctx.globalAlpha = alpha;

      if (dir === -1) {
        ctx.translate(x * 2, 0);
        ctx.scale(-1, 1);
      }

      // Draw: center X on feet position, bottom at feet Y
      ctx.drawImage(sprite, x - dw / 2, y - dh, dw, dh);

      // Hit flash — subtle red tint instead of harsh white
      if (hitFlash) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ff2200';
        ctx.fillRect(x - dw / 2, y - dh, dw, dh);
        ctx.restore();
      }

      // Armor flash — gold tint
      if (armorFlash) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffcc00';
        ctx.fillRect(x - dw / 2, y - dh, dw, dh);
        ctx.restore();
      }

      ctx.restore();
      return;
    }

    // ── Fallback: canvas drawing ──
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    if (this.characterId === 'marcus') {
      this._drawMarcus(ctx, hitFlash, armorFlash);
    } else {
      this._drawVesper(ctx, hitFlash, armorFlash, isAirborne);
    }
    ctx.restore();
  }

  // ── Canvas fallback: Marcus ──
  _drawMarcus(ctx, hitFlash, armorFlash) {
    const skin  = hitFlash ? '#fff' : '#8b6954';
    const vest  = hitFlash ? '#fff' : '#2a3540';
    const pants = hitFlash ? '#fff' : '#2a3020';
    const boot  = hitFlash ? '#fff' : '#1a1a1a';
    const wrap  = hitFlash ? '#fff' : armorFlash ? '#ffd700' : '#5a3020';

    ctx.fillStyle = vest;
    ctx.beginPath(); ctx.roundRect(-24,-130,48,60,[4,4,0,0]); ctx.fill();
    ctx.fillStyle = pants; ctx.fillRect(-22,-70,44,40);
    ctx.fillStyle = boot;  ctx.fillRect(-22,-30,18,30); ctx.fillRect(4,-30,18,30);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.roundRect(-22,-190,44,44,8); ctx.fill();
    ctx.fillStyle = wrap;  ctx.fillRect(-42,-128,16,55);
    ctx.fillStyle = wrap;  ctx.fillRect(26,-110,42,37);
    ctx.fillStyle = skin;  ctx.fillRect(-10,-148,20,18);
  }

  // ── Canvas fallback: Vesper ──
  _drawVesper(ctx, hitFlash, armorFlash, isAirborne) {
    const suit = hitFlash ? '#fff' : '#1a2030';
    const trim = hitFlash ? '#fff' : '#cc2a2a';
    const skin = hitFlash ? '#fff' : '#d4c0a8';
    const hair = hitFlash ? '#fff' : '#e8e8e8';

    ctx.fillStyle = suit;
    ctx.beginPath(); ctx.roundRect(-17,-125,34,50,[4,4,0,0]); ctx.fill();
    ctx.fillStyle = trim;  ctx.fillRect(-17,-125,34,4);
    ctx.fillStyle = suit;  ctx.fillRect(-16,-75,32,47);
    ctx.fillStyle = '#0a0a12'; ctx.fillRect(-16,-28,13,28); ctx.fillRect(3,-28,13,28);
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.roundRect(-15,-178,30,42,7); ctx.fill();
    ctx.fillStyle = hair;  ctx.fillRect(-15,-178,30,12);
    ctx.fillStyle = '#cc2a2a'; ctx.fillRect(-10,-163,8,4); ctx.fillRect(2,-163,8,4);
  }
}

/**
 * Draw a character portrait for the character-select screen.
 */
export function drawPortrait(ctx, characterId) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Per-character accent colors
  const ACCENT = {
    marcus: '#4ea8de', vesper: '#cc2a2a', rook: '#4aaa44',
    zero:   '#4488ff', cinder: '#ff6600', nova: '#ff2222',
    reaper: '#888888', titan:  '#cc4422', sable: '#8844ff', kang: '#ddaa00',
  };
  const accent = ACCENT[characterId] || '#4ea8de';

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0a1020');
  grad.addColorStop(1, '#020508');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle vignette sides
  const vL = ctx.createLinearGradient(0, 0, w * 0.4, 0);
  vL.addColorStop(0, 'rgba(0,0,0,0.5)'); vL.addColorStop(1, 'transparent');
  ctx.fillStyle = vL; ctx.fillRect(0, 0, w, h);
  const vR = ctx.createLinearGradient(w, 0, w * 0.6, 0);
  vR.addColorStop(0, 'rgba(0,0,0,0.5)'); vR.addColorStop(1, 'transparent');
  ctx.fillStyle = vR; ctx.fillRect(0, 0, w, h);

  // Floor line with accent glow
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.moveTo(0, h - 18); ctx.lineTo(w, h - 18); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Try cached sprite first (already preloaded)
  const cached = _cache[characterId]?.['idle']?.[0];
  if (cached) {
    const HORIZONTAL = cached.width > cached.height * 1.3;
    const TARGET_H = h - 22;
    const scale = HORIZONTAL ? (w * 0.85) / cached.width : TARGET_H / cached.height;
    const dw = cached.width * scale;
    const dh = cached.height * scale;
    ctx.drawImage(cached, (w - dw) / 2, h - 18 - dh, dw, dh);
    return;
  }

  // Load sprite on-demand for portrait
  const img = new Image();
  img.onload = () => {
    const off = document.createElement('canvas');
    off.width = img.naturalWidth; off.height = img.naturalHeight;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0);
    try {
      const id2 = octx.getImageData(0, 0, off.width, off.height);
      const d = id2.data;
      const iw = off.width, ih = off.height;

      // Sample corners to detect bg color
      const corners = [[0,0],[iw-1,0],[0,ih-1],[iw-1,ih-1]];
      let bgR=0,bgG=0,bgB=0,cnt=0;
      for(const [cx,cy] of corners){
        const idx=(cy*iw+cx)*4;
        if(d[idx+3]>200){bgR+=d[idx];bgG+=d[idx+1];bgB+=d[idx+2];cnt++;}
      }
      if(cnt>0){bgR/=cnt;bgG/=cnt;bgB/=cnt;}
      const TOL=40;
      for(let i=0;i<d.length;i+=4){
        const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];
        if(a<10)continue;
        const diff=(Math.abs(r-bgR)+Math.abs(g-bgG)+Math.abs(b-bgB))/3;
        if(diff<TOL){d[i+3]=Math.round((diff/TOL)*255*0.5);}
        else if(diff<TOL*1.5){d[i+3]=Math.round(((diff-TOL)/(TOL*0.5))*a);}
      }
      octx.putImageData(id2, 0, 0);
    } catch(e) {}

    // Redraw bg then sprite
    ctx.clearRect(0, 0, w, h);
    const grad2 = ctx.createLinearGradient(0, 0, 0, h);
    grad2.addColorStop(0, '#0a1020'); grad2.addColorStop(1, '#020508');
    ctx.fillStyle = grad2; ctx.fillRect(0, 0, w, h);

    const HORIZONTAL = off.width > off.height * 1.3;
    const scale = HORIZONTAL ? (w * 0.85) / off.width : (h - 22) / off.height;
    const dw = off.width * scale;
    const dh = off.height * scale;
    ctx.drawImage(off, (w - dw) / 2, h - 18 - dh, dw, dh);

    // Redraw floor line
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(0, h - 18); ctx.lineTo(w, h - 18); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  };
  img.onerror = () => {
    // Canvas fallback
    const anim = new Animator(characterId);
    anim.play('idle');
    anim.draw(ctx, w / 2, h - 18, 1);
  };
  img.src = `assets/characters/${characterId}/idle_0.png`;
}
