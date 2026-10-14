/**
 * IRON FIST LEAGUE — Stage Renderer
 *
 * All stages drawn procedurally on Canvas.
 * Replace bgDraw with sprite/image logic when art is ready.
 */

import { STAGE_DATA } from '../data/characters.js';

export class StageRenderer {
  constructor() {
    this._currentStage = null;
    this._time = 0; // for animated elements
  }

  setStage(stageId) {
    this._currentStage = STAGE_DATA.find(s => s.id === stageId) || STAGE_DATA[0];
    this._time = 0;
  }

  getStageData() { return this._currentStage; }

  update(dt) {
    this._time += dt;
  }

  /**
   * Draw the full background + ground for the current stage.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W - canvas width
   * @param {number} H - canvas height
   * @param {number} groundY
   */
  draw(ctx, W, H, groundY) {
    if (!this._currentStage) return;

    const id = this._currentStage.id;
    const t  = this._time / 1000;

    switch (id) {
      case 'underground':   this._drawUnderground(ctx, W, H, groundY, t); break;
      case 'factory':       this._drawFactory(ctx, W, H, groundY, t);     break;
      case 'neon_rooftop':  this._drawNeonRooftop(ctx, W, H, groundY, t); break;
      case 'military_base': this._drawMilitary(ctx, W, H, groundY, t);    break;
      case 'prison':        this._drawPrison(ctx, W, H, groundY, t);      break;
      case 'corporate':     this._drawCorporate(ctx, W, H, groundY, t);   break;
      default:              this._drawUnderground(ctx, W, H, groundY, t); break;
    }
  }

  // ══════════════════════════════════════════════════════
  //  UNDERGROUND ARENA
  // ══════════════════════════════════════════════════════
  _drawUnderground(ctx, W, H, groundY, t) {
    // Sky / ceiling — dark cave
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#0a0805');
    skyGrad.addColorStop(1, '#1a1208');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundY);

    // Back wall rough stone texture (simple rects)
    ctx.fillStyle = '#110e08';
    for (let i = 0; i < 20; i++) {
      const bx = (i % 5) * (W / 5);
      const by = 50 + Math.floor(i / 5) * 60;
      ctx.fillRect(bx + 2, by, W / 5 - 4, 56);
    }

    // Torchlight glow (animated)
    const torchPositions = [W * 0.15, W * 0.5, W * 0.85];
    for (const tx of torchPositions) {
      const flicker = 0.7 + 0.3 * Math.sin(t * 8 + tx);
      const grd = ctx.createRadialGradient(tx, groundY - 80, 5, tx, groundY - 80, 120);
      grd.addColorStop(0, `rgba(200,130,20,${0.35 * flicker})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, groundY);

      // Torch bracket
      ctx.fillStyle = '#5a3010';
      ctx.fillRect(tx - 5, groundY - 100, 10, 30);
      ctx.fillStyle = `rgba(255,160,20,${0.9 * flicker})`;
      ctx.beginPath();
      ctx.ellipse(tx, groundY - 102, 6, 10 * flicker, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crowd silhouettes
    ctx.fillStyle = 'rgba(10,8,5,0.85)';
    for (let i = 0; i < 30; i++) {
      const cx = (i / 30) * W + (Math.sin(t * 0.3 + i) * 3);
      const ch = 35 + Math.sin(i * 0.7 + t * 0.5) * 8;
      ctx.beginPath();
      ctx.ellipse(cx, groundY - 5, 12, ch, 0, Math.PI, 0);
      ctx.fill();
    }

    // Ground
    this._drawGround(ctx, W, groundY, H, '#1a1208', '#c8860a');
  }

  // ══════════════════════════════════════════════════════
  //  FACTORY RUINS
  // ══════════════════════════════════════════════════════
  _drawFactory(ctx, W, H, groundY, t) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#0c0a0e');
    skyGrad.addColorStop(1, '#1a1020');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundY);

    // Industrial pipes
    ctx.fillStyle = '#2a2030';
    ctx.fillRect(0, 40, W, 15); // top pipe
    ctx.fillRect(0, 70, W, 8);

    // Broken machinery silhouette
    const machineX = [W * 0.05, W * 0.75];
    for (const mx of machineX) {
      ctx.fillStyle = '#180e20';
      ctx.fillRect(mx, groundY - 180, 80, 180);
      ctx.fillRect(mx + 20, groundY - 220, 30, 40);
      // Gear
      ctx.strokeStyle = '#2a1a30';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(mx + 40, groundY - 150, 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Purple steam vents (animated)
    for (let i = 0; i < 5; i++) {
      const vx = (i / 5) * W + 40;
      const alpha = 0.15 + 0.1 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(140,80,180,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(vx, groundY - 30 - i * 10, 20, 40, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this._drawGround(ctx, W, groundY, H, '#1a1418', '#8a4ea8');
  }

  // ══════════════════════════════════════════════════════
  //  NEON ROOFTOP
  // ══════════════════════════════════════════════════════
  _drawNeonRooftop(ctx, W, H, groundY, t) {
    // Night sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#000814');
    skyGrad.addColorStop(0.5, '#050e20');
    skyGrad.addColorStop(1, '#0a1828');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundY);

    // City skyline
    const buildings = [
      { x: 0, w: 60, h: 200 }, { x: 70, w: 45, h: 160 }, { x: 130, w: 80, h: 240 },
      { x: 600, w: 70, h: 210 }, { x: 680, w: 50, h: 175 }, { x: 740, w: 90, h: 250 },
    ];
    for (const b of buildings) {
      ctx.fillStyle = '#050e18';
      ctx.fillRect(b.x, groundY - b.h, b.w, b.h);
      // Windows (animated)
      ctx.fillStyle = 'rgba(0,120,255,0.25)';
      for (let wy = groundY - b.h + 10; wy < groundY - 10; wy += 18) {
        for (let wx = b.x + 6; wx < b.x + b.w - 10; wx += 14) {
          if (Math.sin(wx * 0.3 + wy * 0.2 + t * 0.4) > 0.2) {
            ctx.fillRect(wx, wy, 8, 10);
          }
        }
      }
    }

    // Neon signs (animated glow)
    const neonColors = ['#0a8aff', '#ff0a8a', '#0affb0'];
    for (let i = 0; i < 3; i++) {
      const nx = W * 0.2 + i * (W * 0.25);
      const pulse = 0.6 + 0.4 * Math.sin(t * 3 + i * 2);
      ctx.strokeStyle = neonColors[i];
      ctx.lineWidth = 2;
      ctx.shadowColor = neonColors[i];
      ctx.shadowBlur  = 20 * pulse;
      ctx.strokeRect(nx, groundY - 120, 60, 30);
      ctx.shadowBlur = 0;
    }

    // Rain effect
    ctx.strokeStyle = 'rgba(100,160,255,0.25)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 40; i++) {
      const rx = (((i * 137 + t * 80) % W));
      const ry = ((i * 53 + t * 200) % groundY);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 2, ry + 15);
      ctx.stroke();
    }

    this._drawGround(ctx, W, groundY, H, '#101820', '#0a8aff');
  }

  // ══════════════════════════════════════════════════════
  //  MILITARY BASE
  // ══════════════════════════════════════════════════════
  _drawMilitary(ctx, W, H, groundY, t) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#0a0e08');
    skyGrad.addColorStop(1, '#141a10');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundY);

    // Barbed wire fence silhouette
    ctx.strokeStyle = '#2a3020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY - 30);
    for (let fx = 0; fx < W; fx += 20) {
      ctx.lineTo(fx + 10, groundY - 45);
      ctx.lineTo(fx + 20, groundY - 30);
    }
    ctx.stroke();

    // Military vehicles (silhouette)
    ctx.fillStyle = '#1a2010';
    ctx.fillRect(W * 0.7, groundY - 60, 120, 60);
    ctx.fillRect(W * 0.72, groundY - 80, 80, 22);

    // Searchlight sweep
    const angle = (t * 0.5) % (Math.PI * 2);
    const lx = W * 0.5;
    const ly = 30;

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#e8ff80';
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, 400, angle - 0.15, angle + 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this._drawGround(ctx, W, groundY, H, '#141a10', '#4a8a20');
  }

  // ══════════════════════════════════════════════════════
  //  PRISON ARENA
  // ══════════════════════════════════════════════════════
  _drawPrison(ctx, W, H, groundY, t) {
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, groundY);

    // Prison bars
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 3;
    for (let bx = 30; bx < W - 30; bx += 40) {
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx, groundY - 20);
      ctx.stroke();
    }
    // Horizontal bars
    for (let by = 60; by < groundY - 30; by += 80) {
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(W, by);
      ctx.stroke();
    }

    // Overhead harsh lighting
    for (let i = 0; i < 4; i++) {
      const lx = (W / 4) * i + W / 8;
      const flicker = 0.8 + 0.2 * Math.sin(t * 12 + i * 3);
      const grd = ctx.createRadialGradient(lx, 0, 0, lx, 0, 180);
      grd.addColorStop(0, `rgba(255,240,200,${0.3 * flicker})`);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, groundY);

      // Fixture
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(lx - 12, 0, 24, 14);
    }

    // Prisoners / crowd silhouettes
    ctx.fillStyle = 'rgba(8,8,8,0.9)';
    for (let i = 0; i < 20; i++) {
      const px = (i / 20) * W;
      const ph = 25 + Math.sin(i + t * 0.3) * 6;
      ctx.beginPath();
      ctx.ellipse(px, groundY - 4, 10, ph, 0, Math.PI, 0);
      ctx.fill();
    }

    this._drawGround(ctx, W, groundY, H, '#141414', '#aa4a00');
  }

  // ══════════════════════════════════════════════════════
  //  CORPORATE TOWER
  // ══════════════════════════════════════════════════════
  _drawCorporate(ctx, W, H, groundY, t) {
    // Clean dark gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
    skyGrad.addColorStop(0, '#050810');
    skyGrad.addColorStop(1, '#0a1020');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, groundY);

    // Glass panel grid (background wall)
    const panelW = W / 14;
    const panelH = 60;
    for (let col = 0; col < 14; col++) {
      for (let row = 0; row < Math.ceil(groundY / panelH); row++) {
        const px = col * panelW;
        const py = row * panelH;
        const brightness = 0.04 + 0.03 * Math.sin(col * 0.5 + row * 0.3 + t * 0.2);
        ctx.fillStyle = `rgba(60,120,200,${brightness})`;
        ctx.fillRect(px + 1, py + 1, panelW - 2, panelH - 2);
      }
    }

    // Corporate logo (circle + lines)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#4a90c8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(W / 2, groundY / 2, 80, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 80, groundY / 2);
    ctx.lineTo(W / 2 + 80, groundY / 2);
    ctx.moveTo(W / 2, groundY / 2 - 80);
    ctx.lineTo(W / 2, groundY / 2 + 80);
    ctx.stroke();
    ctx.restore();

    // Blue edge lighting
    const edgeGrd = ctx.createLinearGradient(0, 0, W, 0);
    edgeGrd.addColorStop(0, 'rgba(74,144,200,0.15)');
    edgeGrd.addColorStop(0.3, 'transparent');
    edgeGrd.addColorStop(0.7, 'transparent');
    edgeGrd.addColorStop(1, 'rgba(74,144,200,0.15)');
    ctx.fillStyle = edgeGrd;
    ctx.fillRect(0, 0, W, groundY);

    this._drawGround(ctx, W, groundY, H, '#101418', '#4a90c8');
  }

  // ══════════════════════════════════════════════════════
  //  SHARED: Ground / Floor
  // ══════════════════════════════════════════════════════
  _drawGround(ctx, W, groundY, H, baseColor, accentColor) {
    // Main ground plane
    const gGrad = ctx.createLinearGradient(0, groundY, 0, H);
    gGrad.addColorStop(0, this._lighten(baseColor, 0.3));
    gGrad.addColorStop(0.15, baseColor);
    gGrad.addColorStop(1, '#000');
    ctx.fillStyle = gGrad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // Ground line
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Reflection / glow on ground
    const refGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 60);
    refGrad.addColorStop(0, `${accentColor}30`);
    refGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = refGrad;
    ctx.fillRect(0, groundY, W, 60);
  }

  _lighten(hex, amount) {
    // Very simple hex lightener
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.floor(255 * amount));
    const g = Math.min(255, ((num >> 8) & 0xff)  + Math.floor(255 * amount));
    const b = Math.min(255, (num & 0xff)          + Math.floor(255 * amount));
    return `rgb(${r},${g},${b})`;
  }
}

/**
 * Draw a stage preview card on a Canvas element.
 * Used in the stage select screen.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} stageData
 */
export function drawStagePreview(ctx, stageData) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // Background
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, stageData.bgColor || '#050a10');
  grad.addColorStop(1, '#000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Simple geometric elements representing the stage
  ctx.strokeStyle = stageData.accentColor || '#4ea8de';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;

  // Stage-specific simple preview
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = stageData.groundColor || '#1a1a1a';
    ctx.fillRect(i * (w / 5), h * 0.4 + i * 4, w / 5 - 2, h * 0.6);
  }

  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.7);
  ctx.lineTo(w, h * 0.7);
  ctx.stroke();

  ctx.globalAlpha = 1;

  // Stage name
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(w * 0.1)}px Rajdhani, Arial`;
  ctx.textAlign = 'center';
  ctx.fillText(stageData.name, w / 2, h * 0.5);
}
