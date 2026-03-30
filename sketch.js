// Organic grid connections (p5.js port) + presets matching folder PNGs

let srcImg = null;
let grayImg = null;
let dots = [];
let connected = null;
let hasRendered = false;
let renderTimer = null;
let applyingPreset = false;
/** When Preset is "custom", keep rendering with the last chosen style (halftone, ordered, etc.). */
let lastNonCustomRenderStyle = "organic";

// Image-sized canvas + proportional white margin (matches Processing: fither)
let contentW = 900;
let contentH = 900;
let margin = 0;
let layoutDirty = true;
/** Max dimension of the working image (px); smaller = faster preview, smaller PNG export. */
const MAX_CONTENT_SIDE = 800;
const MARGIN_FRAC = 0.06;

const neighbors = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1],
];

// Bayer matrices for ordered dither (classic screen / newsprint)
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

function setup() {
  const cnv = createCanvas(400, 400);
  cnv.parent("canvasMount");
  pixelDensity(1);
  noLoop();
  background(255);

  populatePresets();
  wireUI();
  wireAiPanel();
  applyPresetToUI("organic_natural_connections", true);
  syncUIOutputs();
  setStatus("No image loaded. Upload one to begin.");
}

function draw() {
  background(255);
  if (!srcImg) {
    setStatus("No image loaded.");
    return;
  }

  if (layoutDirty) {
    computeLayoutFromImage();
    layoutDirty = false;
  }

  const cfg = readCfg();
  if (cfg.renderStyle === "organic" || cfg.renderStyle === "organic_dots") {
    if (cfg.gridCount < 2) return;
    drawOrganicGrid(cfg, cfg.renderStyle === "organic");
  } else if (cfg.renderStyle === "threshold") {
    drawThresholdDither(cfg);
  } else if (cfg.renderStyle === "ordered" || cfg.renderStyle === "ordered8") {
    drawOrderedDither(cfg);
  } else if (cfg.renderStyle === "halftone") {
    if (cfg.gridCount < 4) return;
    drawHalftoneGrid(cfg, false);
  } else if (cfg.renderStyle === "stipple") {
    if (cfg.gridCount < 4) return;
    drawHalftoneGrid(cfg, true);
  } else if (cfg.renderStyle === "halftone_edges") {
    if (cfg.gridCount < 4) return;
    drawHalftoneWithEdges(cfg);
  } else if (
    cfg.renderStyle === "fs" ||
    cfg.renderStyle === "atkinson" ||
    cfg.renderStyle === "jarvis" ||
    cfg.renderStyle === "stucki" ||
    cfg.renderStyle === "burkes" ||
    cfg.renderStyle === "sierra2"
  ) {
    drawErrorDiffusion(cfg);
  } else if (cfg.renderStyle === "diamond_overlay") {
    drawDiamondOverlayDither(cfg);
  }

  hasRendered = true;
  const remix =
    cfg.presetKey !== "custom" && presetIsRemixedFromDOM(cfg.presetKey);
  setStatus(
    `fither — ${cfg.presetLabel || "custom"} (${cfg.renderStyle})${
      remix ? " · remixed" : ""
    } · ${contentW}×${contentH} + margin ${margin}px`
  );
}

function computeLayoutFromImage() {
  if (!srcImg) return;
  const iw = srcImg.width;
  const ih = srcImg.height;
  const scale = Math.min(1, MAX_CONTENT_SIDE / Math.max(iw, ih));
  contentW = Math.max(1, Math.round(iw * scale));
  contentH = Math.max(1, Math.round(ih * scale));
  margin = Math.max(12, Math.round(MARGIN_FRAC * Math.max(contentW, contentH)));
  resizeCanvas(contentW + 2 * margin, contentH + 2 * margin);
}

function drawOrganicGrid(cfg, drawBridges) {
  grayImg = srcImg.get();
  grayImg.resize(contentW, contentH);
  grayImg.filter(GRAY);
  grayImg.loadPixels();

  const spacing = contentW / cfg.gridCount;
  dots = new Array(cfg.gridCount);
  for (let gx = 0; gx < cfg.gridCount; gx++) dots[gx] = new Array(cfg.gridCount);

  for (let gy = 0; gy < cfg.gridCount; gy++) {
    for (let gx = 0; gx < cfg.gridCount; gx++) {
      const px = Math.floor(gx * spacing + spacing * 0.5);
      const py = Math.floor(gy * spacing + spacing * 0.5);
      const b = sampleBrightness01(px, py, cfg);
      const grad = localGradient01(px, py);
      const r = lerp(cfg.maxRadius, cfg.minRadius, b);
      dots[gx][gy] = { x: px + margin, y: py + margin, r, b, grad };
    }
  }

  connected = new Array(cfg.gridCount);
  for (let gx = 0; gx < cfg.gridCount; gx++) {
    connected[gx] = new Array(cfg.gridCount);
    for (let gy = 0; gy < cfg.gridCount; gy++) connected[gx][gy] = [false, false, false, false];
  }

  noStroke();
  fill(0);

  const maxLinks = Math.max(0, Math.min(8, cfg.maxLinksPerDot | 0));

  if (drawBridges && maxLinks > 0) {
    for (let gy = 0; gy < cfg.gridCount; gy++) {
      for (let gx = 0; gx < cfg.gridCount; gx++) {
        const a = dots[gx][gy];
        if (!a) continue;
        if (a.b > cfg.maxBright || a.grad > cfg.gradientThreshold) continue;

        let links = 0;
        for (let n = 0; n < neighbors.length; n++) {
          if (links >= maxLinks) break;

          const gx2 = gx + neighbors[n][0];
          const gy2 = gy + neighbors[n][1];
          if (gx2 < 0 || gy2 < 0 || gx2 >= cfg.gridCount || gy2 >= cfg.gridCount) continue;
          const b = dots[gx2][gy2];
          if (!b) continue;

          if (b.b > cfg.maxBright || b.grad > cfg.gradientThreshold) continue;
          if (Math.abs(a.b - b.b) > cfg.toneDiffLimit) continue;

          const d = dist(a.x, a.y, b.x, b.y);
          if (d < (a.r + b.r) * 0.8) continue;
          if (d > (a.r + b.r) * 1.5) continue;

          if (connected[gx][gy][n]) continue;
          connected[gx][gy][n] = true;

          for (let m = 0; m < neighbors.length; m++) {
            if (neighbors[m][0] === -neighbors[n][0] && neighbors[m][1] === -neighbors[n][1]) {
              connected[gx2][gy2][m] = true;
            }
          }

          if (d > spacing * cfg.maxConnectDist * 0.9) continue;
          drawBridge(a, b, cfg);
          links++;
        }
      }
    }
  }

  for (let gy = 0; gy < cfg.gridCount; gy++) {
    for (let gx = 0; gx < cfg.gridCount; gx++) {
      const d = dots[gx][gy];
      if (d) circle(d.x, d.y, d.r * 2);
    }
  }
}

function drawThresholdDither(cfg) {
  grayImg = srcImg.get();
  grayImg.resize(contentW, contentH);
  grayImg.filter(GRAY);
  grayImg.loadPixels();
  const t = clamp(cfg.threshold, 0.01, 0.99);
  loadPixels();
  for (let y = 0; y < contentH; y++) {
    for (let x = 0; x < contentW; x++) {
      const b = sampleBrightness01(x, y, cfg);
      const c = b < t ? 0 : 255;
      const cx = margin + x;
      const cy = margin + y;
      const i = 4 * (cy * width + cx);
      pixels[i] = c;
      pixels[i + 1] = c;
      pixels[i + 2] = c;
      pixels[i + 3] = 255;
    }
  }
  updatePixels();
}

function drawOrderedDither(cfg) {
  const size = cfg.renderStyle === "ordered8" ? 8 : 4;
  const M = size === 8 ? BAYER8 : BAYER4;
  const denom = size * size;
  grayImg = srcImg.get();
  grayImg.resize(contentW, contentH);
  grayImg.filter(GRAY);
  grayImg.loadPixels();
  loadPixels();
  for (let y = 0; y < contentH; y++) {
    for (let x = 0; x < contentW; x++) {
      const b = sampleBrightness01(x, y, cfg);
      const t = (M[y % size][x % size] + 0.5) / denom;
      const c = b < t ? 0 : 255;
      const cx = margin + x;
      const cy = margin + y;
      const i = 4 * (cy * width + cx);
      pixels[i] = c;
      pixels[i + 1] = c;
      pixels[i + 2] = c;
      pixels[i + 3] = 255;
    }
  }
  updatePixels();
}

/** Classic AM halftone: fixed grid, dot radius from darkness (screenprint / newsprint). */
function drawHalftoneGrid(cfg, stipple) {
  grayImg = srcImg.get();
  grayImg.resize(contentW, contentH);
  grayImg.filter(GRAY);
  grayImg.loadPixels();
  background(255);
  noStroke();
  fill(0);
  const nx = Math.max(4, cfg.gridCount);
  const ny = Math.max(4, Math.round((contentH / contentW) * nx));
  const cellW = contentW / nx;
  const cellH = contentH / ny;
  const jitter = cfg.stippleJitter ?? 0.42;
  const gamma = cfg.halftoneGamma ?? 0.88;
  const gain = clamp((cfg.maxRadius / 30) * 0.95, 0.18, 0.58);
  const minR = (cfg.minRadius / 12) * 0.08 * Math.min(cellW, cellH);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      let cx = (i + 0.5) * cellW;
      let cy = (j + 0.5) * cellH;
      if (stipple) {
        cx += (noise(i * 1.1, j * 1.1) - 0.5) * cellW * jitter * 2.2;
        cy += (noise(i * 1.1 + 40, j * 1.1 + 20) - 0.5) * cellH * jitter * 2.2;
      }
      cx = clamp(cx, 0.5, contentW - 0.5);
      cy = clamp(cy, 0.5, contentH - 0.5);
      const ix = clampInt(Math.floor(cx), 0, contentW - 1);
      const iy = clampInt(Math.floor(cy), 0, contentH - 1);
      const b = sampleBrightness01(ix, iy, cfg);
      const darkness = 1 - b;
      let r = gain * Math.min(cellW, cellH) * Math.pow(darkness, gamma);
      r = Math.max(minR, r);
      if (r > 0.35) {
        circle(margin + cx, margin + cy, r * 2);
      }
    }
  }
}

function gray01At(x, y) {
  const xi = clampInt(x, 0, grayImg.width - 1);
  const yi = clampInt(y, 0, grayImg.height - 1);
  return (grayImg.pixels[4 * (yi * grayImg.width + xi)] ?? 0) / 255;
}

function sobelMagNorm(x, y) {
  const gx =
    -gray01At(x - 1, y - 1) +
    gray01At(x + 1, y - 1) -
    2 * gray01At(x - 1, y) +
    2 * gray01At(x + 1, y) -
    gray01At(x - 1, y + 1) +
    gray01At(x + 1, y + 1);
  const gy =
    -gray01At(x - 1, y - 1) -
    2 * gray01At(x, y - 1) -
    gray01At(x + 1, y - 1) +
    gray01At(x - 1, y + 1) +
    2 * gray01At(x, y + 1) +
    gray01At(x + 1, y + 1);
  return Math.sqrt(gx * gx + gy * gy) / 5.65;
}

/**
 * Overlapping rotated squares (diamonds) with random size & alpha — clusters read as darker noise.
 * Uses image luminance + sliders for density and look.
 */
function drawDiamondOverlayDither(cfg) {
  grayImg = srcImg.get();
  grayImg.resize(contentW, contentH);
  grayImg.filter(GRAY);
  grayImg.loadPixels();

  const seed = Math.floor(
    cfg.gridCount * 7919 +
      cfg.contrast * 1000 +
      cfg.minRadius * 300 +
      cfg.maxRadius * 17 +
      cfg.stippleJitter * 500
  );
  randomSeed(seed);

  const densityMul = clamp(cfg.gridCount / 72, 0.4, 2.4);
  const linkBoost = 1 + cfg.maxLinksPerDot * 0.09;
  const n = clamp(floor(1400 * densityMul * linkBoost), 900, 32000);

  const minPx = max(1.5, cfg.minRadius * 2.0);
  const maxPx = max(minPx + 0.5, cfg.maxRadius * 4.2);

  background(255);
  noStroke();
  rectMode(CENTER);

  for (let i = 0; i < n; i++) {
    let cx = random(0, contentW);
    let cy = random(0, contentH);
    const j = cfg.stippleJitter * 10;
    cx += (noise(cx * 0.04 + j, cy * 0.04) - 0.5) * cfg.stippleJitter * 14;
    cy += (noise(cx * 0.04 + 20, cy * 0.04 + 11) - 0.5) * cfg.stippleJitter * 14;

    const ix = clampInt(floor(cx), 0, contentW - 1);
    const iy = clampInt(floor(cy), 0, contentH - 1);
    let b = brightness01At(ix, iy);
    b = applyContrast01(b, cfg.contrast);
    b = applyLumaGamma01(b, cfg.halftoneGamma);
    if (cfg.quantizeLevels > 1) {
      b = quantize01(b, cfg.quantizeLevels);
    }
    if (b > cfg.maxBright && random() > 0.12) continue;

    const grad = localGradient01(ix, iy);
    if (grad < cfg.gradientThreshold * 0.35 && random() > 0.45) continue;

    const sz = random(minPx, maxPx);
    const tone = 1 - b;
    const baseA = random(0.05, 0.78) * (0.35 + tone * 0.95);
    const bridgeW = lerp(0.85, 1.15, cfg.bridgeWaist);
    let a = baseA * clamp(cfg.contrast, 0.55, 1.85) * bridgeW * clamp(cfg.bridgeScale / 3.77, 0.55, 1.45);
    a *= 1 - clamp(cfg.toneDiffLimit * 0.35, 0, 0.25);
    a *= 1 - clamp(cfg.edgeTaper * grad * 1.2, 0, 0.35);
    a = clamp(a, 0.03, 0.98);
    const a255 = floor(a * 255);

    push();
    translate(margin + cx, margin + cy);
    rotate(PI / 4);
    fill(0, a255);
    square(0, 0, sz);
    pop();
  }

  rectMode(CORNER);
}

function drawHalftoneWithEdges(cfg) {
  drawHalftoneGrid(cfg, false);
  grayImg = srcImg.get();
  grayImg.resize(contentW, contentH);
  grayImg.filter(GRAY);
  grayImg.loadPixels();
  const thr = cfg.edgeMag ?? 0.14;
  loadPixels();
  for (let y = 1; y < contentH - 1; y++) {
    for (let x = 1; x < contentW - 1; x++) {
      if (sobelMagNorm(x, y) > thr) {
        const cx = margin + x;
        const cy = margin + y;
        const p = 4 * (cy * width + cx);
        pixels[p] = 0;
        pixels[p + 1] = 0;
        pixels[p + 2] = 0;
        pixels[p + 3] = 255;
      }
    }
  }
  updatePixels();
}

/** Tone curve (gamma=1 → linear). Aligns with halftone “darkness^gamma” feel via complement on 0..1 luma. */
function applyLumaGamma01(b, gamma) {
  const g = gamma != null ? clamp(gamma, 0.5, 1.2) : 1;
  const x = clamp(b, 0, 1);
  if (Math.abs(g - 1) < 1e-6) return x;
  return 1 - Math.pow(1 - x, g);
}

function hash01(ix, iy) {
  const n = Math.sin(ix * 12.9898 + iy * 78.233 + 1) * 43758.5453;
  return n - Math.floor(n);
}

/** Light 3×3 box blur on a 0..1 float grid (min/max radius → smoothing before diffusion). */
function maybeBoxBlurFloat01(buf, w, h, strength) {
  if (strength < 0.02) return;
  const passes = strength > 0.22 ? 2 : 1;
  const tmp = new Float32Array(buf.length);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = clampInt(x + dx, 0, w - 1);
            const yy = clampInt(y + dy, 0, h - 1);
            s += buf[yy * w + xx];
          }
        }
        tmp[y * w + x] = s / 9;
      }
    }
    buf.set(tmp);
  }
}

/**
 * Error diffusion at a resolution driven by gridCount, then upscaled (every slider affects the result).
 * Organic-style parameters modulate tone, blur, noise, and error gain.
 */
function drawErrorDiffusion(cfg) {
  grayImg = srcImg.get();
  grayImg.resize(contentW, contentH);
  grayImg.filter(GRAY);
  grayImg.loadPixels();

  const levels = cfg.quantizeLevels > 1 ? (cfg.quantizeLevels | 0) : 2;
  const { kernel, divisor } = getDiffusionKernel(cfg.renderStyle);

  const cw = contentW;
  const ch = contentH;
  /** Slider 1…140 → diffusion width; 140 = full resolution (matches slider max). */
  const nw = clamp(Math.round(((cfg.gridCount | 0) / 140) * cw), 4, cw);
  const nh = Math.max(4, Math.min(ch, Math.round((nw * ch) / cw)));

  const buf = new Float32Array(nw * nh);
  const nOff = cfg.stippleJitter * 17.1 + cfg.maxConnectDist * 9.3;

  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const px = clampInt(Math.floor(((x + 0.5) / nw) * cw), 0, cw - 1);
      const py = clampInt(Math.floor(((y + 0.5) / nh) * ch), 0, ch - 1);
      let b = brightness01At(px, py);
      b = Math.min(b, cfg.maxBright);
      b = applyLumaGamma01(b, cfg.halftoneGamma);
      b = applyContrast01(b, cfg.contrast);
      const jN =
        (noise(x * 0.37 + nOff, y * 0.41) - 0.5) * cfg.stippleJitter * 0.16 +
        (hash01(x * 0.17 + cfg.bridgeScale, y * 0.19) - 0.5) * cfg.maxConnectDist * 0.055;
      buf[y * nw + x] = clamp(b + jN, 0, 1);
    }
  }

  const blurAmt = clamp((cfg.minRadius + cfg.maxRadius) / 36, 0, 0.38);
  maybeBoxBlurFloat01(buf, nw, nh, blurAmt);

  const outBin = new Uint8Array(nw * nh);

  loadPixels();
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const i = y * nw + x;
      const oldV = clamp(buf[i], 0, 1);
      const newV = quantize01(oldV, levels);
      let err = oldV - newV;

      const px = clampInt(Math.floor(((x + 0.5) / nw) * cw), 0, cw - 1);
      const py = clampInt(Math.floor(((y + 0.5) / nh) * ch), 0, ch - 1);
      const g = localGradient01(px, py);

      let damp = 1 - clamp(cfg.edgeTaper * g * 2.8, 0, 0.92);
      damp *= 1 - clamp(cfg.edgeMag * g * 2.2, 0, 0.48);
      if (cfg.gradientThreshold > 0.001) {
        damp *= clamp(1 - (g / cfg.gradientThreshold) * 0.28, 0.5, 1);
      }
      damp *= 1 - clamp(cfg.toneDiffLimit * g * 1.6, 0, 0.35);

      const bridgeGain = clamp(cfg.bridgeScale * 0.24, 0.38, 2.1) * lerp(0.86, 1.12, cfg.bridgeWaist);
      err *= damp * bridgeGain * (1 + cfg.maxLinksPerDot * 0.022);
      err *= clamp(1 + (hash01(x, y + cfg.maxConnectDist) - 0.5) * cfg.toneDiffLimit * 0.9, 0.65, 1.35);

      outBin[i] = newV < 0.5 ? 0 : 255;

      for (let k = 0; k < kernel.length; k++) {
        const { dx, dy, w } = kernel[k];
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= nw || ny >= nh) continue;
        buf[ny * nw + nx] += (err * w) / divisor;
      }
    }
  }

  for (let fy = 0; fy < ch; fy++) {
    for (let fx = 0; fx < cw; fx++) {
      const sx = Math.min(nw - 1, Math.floor((fx / cw) * nw));
      const sy = Math.min(nh - 1, Math.floor((fy / ch) * nh));
      const c = outBin[sy * nw + sx];
      const cx = margin + fx;
      const cy = margin + fy;
      const p = 4 * (cy * width + cx);
      pixels[p] = c;
      pixels[p + 1] = c;
      pixels[p + 2] = c;
      pixels[p + 3] = 255;
    }
  }
  updatePixels();
}

function getDiffusionKernel(style) {
  // Each kernel entry diffuses error to pixels ahead (left->right scan)
  // w = integer weight, divisor = sum of weights
  if (style === "fs") {
    return {
      divisor: 16,
      kernel: [
        { dx: 1, dy: 0, w: 7 },
        { dx: -1, dy: 1, w: 3 },
        { dx: 0, dy: 1, w: 5 },
        { dx: 1, dy: 1, w: 1 },
      ],
    };
  }
  if (style === "atkinson") {
    return {
      divisor: 8,
      kernel: [
        { dx: 1, dy: 0, w: 1 },
        { dx: 2, dy: 0, w: 1 },
        { dx: -1, dy: 1, w: 1 },
        { dx: 0, dy: 1, w: 1 },
        { dx: 1, dy: 1, w: 1 },
        { dx: 0, dy: 2, w: 1 },
      ],
    };
  }
  if (style === "burkes") {
    return {
      divisor: 32,
      kernel: [
        { dx: 1, dy: 0, w: 8 },
        { dx: 2, dy: 0, w: 4 },
        { dx: -2, dy: 1, w: 2 },
        { dx: -1, dy: 1, w: 4 },
        { dx: 0, dy: 1, w: 8 },
        { dx: 1, dy: 1, w: 4 },
        { dx: 2, dy: 1, w: 2 },
      ],
    };
  }
  if (style === "stucki") {
    return {
      divisor: 42,
      kernel: [
        { dx: 1, dy: 0, w: 8 },
        { dx: 2, dy: 0, w: 4 },
        { dx: -2, dy: 1, w: 2 },
        { dx: -1, dy: 1, w: 4 },
        { dx: 0, dy: 1, w: 8 },
        { dx: 1, dy: 1, w: 4 },
        { dx: 2, dy: 1, w: 2 },
        { dx: -2, dy: 2, w: 1 },
        { dx: -1, dy: 2, w: 2 },
        { dx: 0, dy: 2, w: 4 },
        { dx: 1, dy: 2, w: 2 },
        { dx: 2, dy: 2, w: 1 },
      ],
    };
  }
  if (style === "jarvis") {
    return {
      divisor: 48,
      kernel: [
        { dx: 1, dy: 0, w: 7 },
        { dx: 2, dy: 0, w: 5 },
        { dx: -2, dy: 1, w: 3 },
        { dx: -1, dy: 1, w: 5 },
        { dx: 0, dy: 1, w: 7 },
        { dx: 1, dy: 1, w: 5 },
        { dx: 2, dy: 1, w: 3 },
        { dx: -2, dy: 2, w: 1 },
        { dx: -1, dy: 2, w: 3 },
        { dx: 0, dy: 2, w: 5 },
        { dx: 1, dy: 2, w: 3 },
        { dx: 2, dy: 2, w: 1 },
      ],
    };
  }
  // sierra2
  return {
    divisor: 16,
    kernel: [
      { dx: 1, dy: 0, w: 4 },
      { dx: 2, dy: 0, w: 3 },
      { dx: -2, dy: 1, w: 1 },
      { dx: -1, dy: 1, w: 2 },
      { dx: 0, dy: 1, w: 3 },
      { dx: 1, dy: 1, w: 2 },
      { dx: 2, dy: 1, w: 1 },
      { dx: -1, dy: 2, w: 1 },
      { dx: 0, dy: 2, w: 2 },
      { dx: 1, dy: 2, w: 1 },
    ],
  };
}

function sampleBrightness01(x, y, cfg) {
  let b = brightness01At(x, y);
  b = applyContrast01(b, cfg.contrast);
  if (cfg.quantizeLevels > 1) {
    b = quantize01(b, cfg.quantizeLevels);
  }
  return clamp(b, 0, 1);
}

function applyContrast01(b, contrast) {
  const mid = 0.5;
  return clamp((b - mid) * contrast + mid, 0, 1);
}

function quantize01(b, levels) {
  const L = Math.max(2, levels | 0);
  const step = 1 / (L - 1);
  return Math.round(b / step) * step;
}

function drawBridge(a, b, cfg) {
  const steps = 28;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = Math.atan2(dy, dx);
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);

  const tone = (a.b + b.b) * 0.5;
  const darknessFactor = 1.2 - tone;
  const baseW = Math.min(a.r, b.r) * cfg.bridgeScale * 0.7 * darknessFactor;
  const waistW = baseW * clamp(cfg.bridgeWaist, 0.02, 1.0);

  const taperStrength = clamp(cfg.edgeTaper, 0.0, 1.0);
  const edgeLimitA = TWO_PI * a.r * 0.15;
  const edgeLimitB = TWO_PI * b.r * 0.15;
  const totalDist = dist(a.x, a.y, b.x, b.y);

  beginShape();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = lerp(a.x, b.x, t);
    const cy = lerp(a.y, b.y, t);

    const taper = Math.pow(Math.sin(Math.PI * t), 1.2);
    let w = lerp(baseW, waistW, taper);

    let edgeBlend = 1.0;
    if (t * totalDist < edgeLimitA) {
      const fade = (t * totalDist) / edgeLimitA;
      edgeBlend = lerp(0.6, 1.0, fade);
    } else if ((1 - t) * totalDist < edgeLimitB) {
      const fade = ((1 - t) * totalDist) / edgeLimitB;
      edgeBlend = lerp(0.6, 1.0, fade);
    }

    const endTaper = lerp(1.0, Math.sin(Math.PI * t), taperStrength);
    w *= edgeBlend * endTaper;
    vertex(cx - nx * w, cy - ny * w);
  }

  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const cx = lerp(a.x, b.x, t);
    const cy = lerp(a.y, b.y, t);

    const taper = Math.pow(Math.sin(Math.PI * t), 1.2);
    let w = lerp(baseW, waistW, taper);

    let edgeBlend = 1.0;
    if (t * totalDist < edgeLimitA) {
      const fade = (t * totalDist) / edgeLimitA;
      edgeBlend = lerp(0.6, 1.0, fade);
    } else if ((1 - t) * totalDist < edgeLimitB) {
      const fade = ((1 - t) * totalDist) / edgeLimitB;
      edgeBlend = lerp(0.6, 1.0, fade);
    }

    const endTaper = lerp(1.0, Math.sin(Math.PI * t), taperStrength);
    w *= edgeBlend * endTaper;
    vertex(cx + nx * w, cy + ny * w);
  }
  endShape(CLOSE);
}

function localGradient01(x, y) {
  const x1 = clampInt(x - 1, 0, grayImg.width - 1);
  const x2 = clampInt(x + 1, 0, grayImg.width - 1);
  const y1 = clampInt(y - 1, 0, grayImg.height - 1);
  const y2 = clampInt(y + 1, 0, grayImg.height - 1);

  const bL = brightness01At(x1, y);
  const bR = brightness01At(x2, y);
  const bU = brightness01At(x, y1);
  const bD = brightness01At(x, y2);

  const dx = bR - bL;
  const dy = bD - bU;
  return Math.sqrt(dx * dx + dy * dy);
}

function brightness01At(x, y) {
  const idx = 4 * (y * grayImg.width + x);
  const v = grayImg.pixels[idx] ?? 255;
  return v / 255;
}

function readCfg() {
  const presetKey = document.getElementById("presetSelect").value;
  const p = DITHER_PRESETS[presetKey];
  return {
    presetKey,
    presetLabel: p && p.label ? p.label : "Custom",
    renderStyle:
      presetKey === "custom" ? lastNonCustomRenderStyle : p?.renderStyle || "organic",

    gridCount: parseInt(document.getElementById("gridCount").value, 10),
    minRadius: parseFloat(document.getElementById("minRadius").value),
    maxRadius: parseFloat(document.getElementById("maxRadius").value),

    bridgeScale: parseFloat(document.getElementById("bridgeScale").value),
    bridgeWaist: parseFloat(document.getElementById("bridgeWaist").value),
    maxConnectDist: parseFloat(document.getElementById("maxConnectDist").value),
    toneDiffLimit: parseFloat(document.getElementById("toneDiffLimit").value),
    gradientThreshold: parseFloat(document.getElementById("gradientThreshold").value),
    edgeTaper: parseFloat(document.getElementById("edgeTaper").value),

    maxBright: parseFloat(document.getElementById("maxBright").value),
    maxLinksPerDot: parseInt(document.getElementById("maxLinksPerDot").value, 10),
    contrast: parseFloat(document.getElementById("contrast").value),
    quantizeLevels: parseInt(document.getElementById("quantizeLevels").value, 10),

    threshold: parseFloat(document.getElementById("threshold").value),

    stippleJitter: parseFloat(document.getElementById("stippleJitter").value),
    edgeMag: parseFloat(document.getElementById("edgeMag").value),
    halftoneGamma: parseFloat(document.getElementById("halftoneGamma").value),
  };
}

/** True when any slider differs from the saved defaults for this preset (named preset + tweaks = “remix”). */
function presetIsRemixedFromDOM(presetKey) {
  if (presetKey === "custom") return false;
  const def = DITHER_PRESETS[presetKey];
  if (!def) return false;

  const intFields = new Set(["gridCount", "maxLinksPerDot", "quantizeLevels"]);
  const domFields = [
    "threshold",
    "gridCount",
    "minRadius",
    "maxRadius",
    "bridgeScale",
    "bridgeWaist",
    "maxConnectDist",
    "toneDiffLimit",
    "gradientThreshold",
    "edgeTaper",
    "maxBright",
    "maxLinksPerDot",
    "contrast",
    "quantizeLevels",
    "stippleJitter",
    "halftoneGamma",
    "edgeMag",
  ];

  const eps = 1e-4;

  for (const field of domFields) {
    if (!(field in def)) continue;
    const el = document.getElementById(field);
    if (!el) continue;
    const presetVal = def[field];
    if (intFields.has(field)) {
      const domVal = parseInt(el.value, 10);
      if (domVal !== presetVal) return true;
    } else {
      const domVal = parseFloat(el.value);
      if (!Number.isFinite(domVal) || Math.abs(domVal - presetVal) > eps) return true;
    }
  }
  return false;
}

function populatePresets() {
  const sel = document.getElementById("presetSelect");
  const keys = Object.keys(DITHER_PRESETS).filter((k) => k !== "custom");
  keys.sort((a, b) => DITHER_PRESETS[a].label.localeCompare(DITHER_PRESETS[b].label));
  sel.innerHTML = "";
  const optCustom = document.createElement("option");
  optCustom.value = "custom";
  optCustom.textContent = DITHER_PRESETS.custom.label;
  sel.appendChild(optCustom);
  for (const k of keys) {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = DITHER_PRESETS[k].label;
    sel.appendChild(o);
  }
}

function applyPresetToUI(key, silent) {
  const def = DITHER_PRESETS[key];
  if (!def || key === "custom") return;
  applyingPreset = true;
  try {
    if (def.threshold != null) setVal("threshold", def.threshold);

    if (def.gridCount != null) setVal("gridCount", def.gridCount);
    if (def.minRadius != null) setVal("minRadius", def.minRadius);
    if (def.maxRadius != null) setVal("maxRadius", def.maxRadius);
    if (def.bridgeScale != null) setVal("bridgeScale", def.bridgeScale);
    if (def.bridgeWaist != null) setVal("bridgeWaist", def.bridgeWaist);
    if (def.maxConnectDist != null) setVal("maxConnectDist", def.maxConnectDist);
    if (def.toneDiffLimit != null) setVal("toneDiffLimit", def.toneDiffLimit);
    if (def.gradientThreshold != null) setVal("gradientThreshold", def.gradientThreshold);
    if (def.edgeTaper != null) setVal("edgeTaper", def.edgeTaper);
    if (def.maxBright != null) setVal("maxBright", def.maxBright);
    if (def.maxLinksPerDot != null) setVal("maxLinksPerDot", def.maxLinksPerDot);
    if (def.contrast != null) setVal("contrast", def.contrast);
    if (def.quantizeLevels != null) setVal("quantizeLevels", def.quantizeLevels);

    setVal("stippleJitter", def.stippleJitter != null ? def.stippleJitter : 0.42);
    setVal("halftoneGamma", def.halftoneGamma != null ? def.halftoneGamma : 0.88);
    setVal("edgeMag", def.edgeMag != null ? def.edgeMag : 0.14);

    document.getElementById("presetSelect").value = key;
    updateLastNonCustomRenderStyle();
  } finally {
    applyingPreset = false;
  }
  if (!silent) syncUIOutputs();
}

function updateLastNonCustomRenderStyle() {
  const key = document.getElementById("presetSelect").value;
  if (key !== "custom" && DITHER_PRESETS[key]) {
    lastNonCustomRenderStyle = DITHER_PRESETS[key].renderStyle || "organic";
  }
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (el) el.value = String(v);
}

/** Gemini model id (Google AI Studio). Change if your key only supports e.g. gemini-1.5-flash. */
const GEMINI_MODEL = "gemini-2.0-flash";

const LS_GEMINI_KEY = "geminiApiKey";
const LS_AI_BEHAVIOR = "geminiAiBehavior";

/** Shown when “How the AI should act” is empty; edit the textarea to replace permanently. */
const DEFAULT_AI_BEHAVIOR = `You are fither's copilot: opinionated about print, zines, and halftone. You only output JSON for this app—no markdown, no small talk.

Bias: match the user's creative goal (e.g. newsprint → error diffusion or ordered; soft illustration → halftone/stipple; bold graphic → threshold or high-contrast diffusion). Prefer fewer slider overrides when a preset alone fits; use overrides to nudge contrast, grid density, or gamma. If unsure, choose a safe, popular preset (e.g. organic natural or Atkinson) with light overrides.`;

function clampAndSetVal(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  const min = parseFloat(el.min);
  const max = parseFloat(el.max);
  const step = parseFloat(el.step || "0");
  let x = Number(v);
  if (!Number.isFinite(x)) return;
  x = clamp(x, min, max);
  if (Number.isFinite(step) && step > 0) {
    x = Math.round((x - min) / step) * step + min;
    x = clamp(x, min, max);
  }
  const s = String(Number.isInteger(x) ? x : Number(x.toFixed(6)));
  el.value = s;
  const numEl = document.getElementById(`${id}Num`);
  if (numEl) numEl.value = s;
}

function applyGeminiSuggestion(obj) {
  if (!obj || typeof obj !== "object") return;
  let key = obj.presetKey;
  if (typeof key !== "string" || !DITHER_PRESETS[key]) {
    key = "organic_natural_connections";
  }
  applyPresetToUI(key, true);
  if (obj.overrides && typeof obj.overrides === "object") {
    for (const [k, val] of Object.entries(obj.overrides)) {
      if (document.getElementById(k)) clampAndSetVal(k, val);
    }
  }
  updateLastNonCustomRenderStyle();
  syncUIOutputs();
  sizeNumInputWidths();
}

function buildGeminiFullPrompt(userPrompt) {
  const behaviorInput = document.getElementById("aiBehavior");
  const behaviorText = (behaviorInput?.value || "").trim();
  const persona = behaviorText.length > 0 ? behaviorText : DEFAULT_AI_BEHAVIOR;

  const presetKeys = Object.keys(DITHER_PRESETS).filter((k) => k !== "custom");
  const technical = `OUTPUT RULES (strict):
Respond with a single JSON object only—no markdown, no code fences, no commentary.
Fields:
- "presetKey": string, exactly one of: ${JSON.stringify(presetKeys)}
- "overrides": optional object with numeric values only. Allowed keys: threshold, gridCount, minRadius, maxRadius, bridgeScale, bridgeWaist, maxConnectDist, toneDiffLimit, gradientThreshold, edgeTaper, maxBright, maxLinksPerDot, contrast, quantizeLevels, stippleJitter, halftoneGamma, edgeMag
Use 0–4 overrides only when the preset needs a nudge; otherwise omit "overrides" or leave it {}.`;

  return `${persona}\n\n---\n${technical}\n\n---\nUser request: ${userPrompt}`;
}

function parseGeminiJsonText(text) {
  if (!text) throw new Error("Empty response from Gemini.");
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Could not parse JSON from Gemini.");
    return JSON.parse(m[0]);
  }
}

async function runGeminiSuggest() {
  const keyInput = document.getElementById("geminiApiKey");
  const promptInput = document.getElementById("aiPrompt");
  const suggestBtn = document.getElementById("aiSuggestBtn");
  const apiKey = keyInput?.value?.trim();
  const userPrompt = promptInput?.value?.trim();

  if (!userPrompt) {
    setStatus("Describe the look you want (e.g. newsprint halftone).");
    return;
  }

  const fullPrompt = buildGeminiFullPrompt(userPrompt);

  try {
    setStatus("Asking Gemini…");
    if (suggestBtn) suggestBtn.disabled = true;

    let text;

    if (apiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }],
            generationConfig: {
              temperature: 0.25,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        const msg = data.error?.message || `${res.status} ${res.statusText}`;
        setStatus(`Gemini: ${msg}`);
        return;
      }

      text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        setStatus("Empty response from Gemini.");
        return;
      }
    } else {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(
          data.error ||
            `AI server: ${res.status}. Run npm start with GEMINI_API_KEY in .env, or paste your own key above.`
        );
        return;
      }
      text = data.text;
      if (!text) {
        setStatus("Empty response from AI server.");
        return;
      }
    }

    const parsed = parseGeminiJsonText(text);
    applyGeminiSuggestion(parsed);
    const label = DITHER_PRESETS[parsed.presetKey]?.label || parsed.presetKey || "preset";
    setStatus(`AI applied: ${label} — render updated.`);
    if (srcImg) {
      hasRendered = false;
      scheduleRender();
    }
  } catch (e) {
    setStatus(`AI suggest failed: ${e.message || String(e)}`);
  } finally {
    if (suggestBtn) suggestBtn.disabled = false;
  }
}

function wireAiPanel() {
  const btn = document.getElementById("aiModeBtn");
  const panel = document.getElementById("aiPanel");
  const keyInput = document.getElementById("geminiApiKey");
  const behaviorInput = document.getElementById("aiBehavior");
  const suggestBtn = document.getElementById("aiSuggestBtn");

  const savedKey = localStorage.getItem(LS_GEMINI_KEY);
  if (savedKey && keyInput) keyInput.value = savedKey;

  const savedBehavior = localStorage.getItem(LS_AI_BEHAVIOR);
  if (behaviorInput) {
    if (savedBehavior == null || savedBehavior.trim().length === 0) {
      behaviorInput.value = DEFAULT_AI_BEHAVIOR;
    } else {
      behaviorInput.value = savedBehavior;
    }
  }

  keyInput?.addEventListener("change", () => {
    localStorage.setItem(LS_GEMINI_KEY, keyInput.value.trim());
  });
  keyInput?.addEventListener("blur", () => {
    localStorage.setItem(LS_GEMINI_KEY, keyInput.value.trim());
  });

  const persistBehavior = () => {
    if (behaviorInput) localStorage.setItem(LS_AI_BEHAVIOR, behaviorInput.value);
  };
  behaviorInput?.addEventListener("change", persistBehavior);
  behaviorInput?.addEventListener("blur", persistBehavior);

  btn?.addEventListener("click", () => {
    if (!panel) return;
    const show = panel.hidden;
    panel.hidden = !show;
    btn.setAttribute("aria-expanded", show ? "true" : "false");
    btn.setAttribute("aria-pressed", show ? "true" : "false");
  });

  suggestBtn?.addEventListener("click", () => {
    runGeminiSuggest();
  });

  document.getElementById("aiPrompt")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runGeminiSuggest();
    }
  });
}

function wireUI() {
  wireNumericPairs();

  document.getElementById("presetSelect").addEventListener("change", (e) => {
    const key = e.target.value;
    if (key === "custom") {
      syncUIOutputs();
      if (srcImg) {
        hasRendered = false;
        setStatus("Rendering...");
        scheduleRender();
      }
      return;
    }
    applyPresetToUI(key, false);
    updateLastNonCustomRenderStyle();
    syncUIOutputs();
    if (srcImg) {
      hasRendered = false;
      setStatus("Rendering...");
      scheduleRender();
    }
  });

  const fileInput = document.getElementById("fileInput");
  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadFileAsImage(file);
    layoutDirty = true;
    hasRendered = false;
    setStatus(`Loaded: ${file.name}. Rendering...`);
    scheduleRender();
  });

  document.getElementById("renderBtn").addEventListener("click", () => {
    if (!srcImg) return setStatus("Upload an image first.");
    hasRendered = false;
    setStatus("Rendering...");
    scheduleRender(true);
  });

  document.getElementById("downloadBtn").addEventListener("click", () => {
    if (!hasRendered) return setStatus("Render first, then download.");
    const key = document.getElementById("presetSelect").value;
    const name = key === "custom" ? "fither_export" : key;
    const canvas = document.querySelector("#canvasMount canvas");
    if (!canvas) return setStatus("No canvas to export.");
    canvas.toBlob(
      (blob) => {
        if (!blob) return setStatus("Could not export PNG.");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${name}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        const label = `${name.replace(/_/g, " ")} · ${new Date().toLocaleString()}`;
        if (typeof window.fitherGalleryAddExport === "function") {
          window.fitherGalleryAddExport(blob, label);
        }
        setStatus(`Saved ${name}.png — also added to fither inspo (this browser).`);
      },
      "image/png"
    );
  });

  const ids = [
    "gridCount",
    "minRadius",
    "maxRadius",
    "bridgeScale",
    "bridgeWaist",
    "maxConnectDist",
    "toneDiffLimit",
    "gradientThreshold",
    "edgeTaper",
    "maxBright",
    "maxLinksPerDot",
    "contrast",
    "quantizeLevels",
    "threshold",
    "stippleJitter",
    "halftoneGamma",
    "edgeMag",
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.addEventListener("input", () => {
      syncUIOutputs();
      if (srcImg) {
        hasRendered = false;
        setStatus("Rendering...");
        scheduleRender();
      }
    });
  }
}

function wireNumericPairs() {
  const pairs = [
    ["threshold", "thresholdNum"],
    ["gridCount", "gridCountNum"],
    ["minRadius", "minRadiusNum"],
    ["maxRadius", "maxRadiusNum"],
    ["bridgeScale", "bridgeScaleNum"],
    ["bridgeWaist", "bridgeWaistNum"],
    ["maxConnectDist", "maxConnectDistNum"],
    ["toneDiffLimit", "toneDiffLimitNum"],
    ["gradientThreshold", "gradientThresholdNum"],
    ["edgeTaper", "edgeTaperNum"],
    ["maxBright", "maxBrightNum"],
    ["maxLinksPerDot", "maxLinksPerDotNum"],
    ["contrast", "contrastNum"],
    ["quantizeLevels", "quantizeLevelsNum"],
    ["stippleJitter", "stippleJitterNum"],
    ["halftoneGamma", "halftoneGammaNum"],
    ["edgeMag", "edgeMagNum"],
  ];

  for (const [sliderId, numId] of pairs) {
    const slider = document.getElementById(sliderId);
    const num = document.getElementById(numId);
    if (!slider || !num) continue;

    slider.addEventListener("input", () => {
      num.value = slider.value;
      sizeNumInputWidths();
    });

    const applyNumToSlider = () => {
      // Parse + clamp to slider min/max/step
      const min = parseFloat(slider.min);
      const max = parseFloat(slider.max);
      const step = parseFloat(slider.step || "0");
      let v = parseFloat(num.value);
      if (!Number.isFinite(v)) v = parseFloat(slider.value);
      v = clamp(v, min, max);
      if (Number.isFinite(step) && step > 0) {
        v = Math.round((v - min) / step) * step + min;
        v = clamp(v, min, max);
        v = Number(v.toFixed(6));
      }
      slider.value = String(v);
      num.value = String(v);
      sizeNumInputWidths();

      if (srcImg) {
        hasRendered = false;
        setStatus("Rendering...");
        scheduleRender();
      }
    };

    num.addEventListener("change", applyNumToSlider);
    num.addEventListener("blur", applyNumToSlider);
    num.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyNumToSlider();
    });
  }
}

function syncNumericInputsFromSliders() {
  const pairs = [
    ["threshold", "thresholdNum"],
    ["gridCount", "gridCountNum"],
    ["minRadius", "minRadiusNum"],
    ["maxRadius", "maxRadiusNum"],
    ["bridgeScale", "bridgeScaleNum"],
    ["bridgeWaist", "bridgeWaistNum"],
    ["maxConnectDist", "maxConnectDistNum"],
    ["toneDiffLimit", "toneDiffLimitNum"],
    ["gradientThreshold", "gradientThresholdNum"],
    ["edgeTaper", "edgeTaperNum"],
    ["maxBright", "maxBrightNum"],
    ["maxLinksPerDot", "maxLinksPerDotNum"],
    ["contrast", "contrastNum"],
    ["quantizeLevels", "quantizeLevelsNum"],
    ["stippleJitter", "stippleJitterNum"],
    ["halftoneGamma", "halftoneGammaNum"],
    ["edgeMag", "edgeMagNum"],
  ];
  for (const [sliderId, numId] of pairs) {
    const slider = document.getElementById(sliderId);
    const num = document.getElementById(numId);
    if (!slider || !num) continue;
    num.value = slider.value;
  }
  sizeNumInputWidths();
}

/** Number fields size to content so decimals are not clipped. */
function sizeNumInputWidths() {
  document.querySelectorAll(".num[type='number']").forEach((el) => {
    const len = Math.max(1, String(el.value ?? "").length);
    const chWide = Math.min(24, Math.max(8, 3.2 + len * 0.92));
    el.style.width = `min(100%, ${chWide}ch)`;
  });
}

function scheduleRender(immediate = false) {
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  if (immediate) {
    redraw();
    return;
  }
  renderTimer = setTimeout(() => {
    renderTimer = null;
    redraw();
  }, 120);
}

function syncUIOutputs() {
  syncNumericInputsFromSliders();
  const presetKey = document.getElementById("presetSelect").value;
  const rs =
    presetKey === "custom"
      ? lastNonCustomRenderStyle
      : DITHER_PRESETS[presetKey]?.renderStyle || "organic";
  const thrRow = document.getElementById("thresholdRow");
  if (thrRow) {
    thrRow.style.display = rs === "threshold" ? "grid" : "none";
  }
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function loadFileAsImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    loadImage(
      url,
      (img) => {
        srcImg = img;
        URL.revokeObjectURL(url);
        resolve();
      },
      (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      }
    );
  });
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function clampInt(v, a, b) {
  return Math.max(a, Math.min(b, v | 0));
}
