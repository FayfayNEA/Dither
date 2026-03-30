// Failenn's dither — organic grid + tone-mapped bridges (Processing)

PImage img;

// --- grid + tone mapping ---
int gridCount = 50;
float minRadius = 2;
float maxRadius = 15;

// --- bridge shape + scaling ---
float bridgeScale = 1.2 * PI;
float bridgeWaist = 0.1;
float maxConnectDist = 1.2;
float toneDiffLimit = 0.15;
float gradientThreshold = 0.12;
float edgeTaper = 0.3;

// --- canvas: image-sized content + proportional white margin ---
// Longer side of the image is scaled down to at most this (px); margin scales with image size.
float maxContentSide = 1000;
float marginFraction = 0.06;
int contentW = 1;
int contentH = 1;
int marginPx = 0;

// --- app-ish behavior ---
String inputImagePath = "input.jpg";
String outputFileName = "failenn_dither.png";
boolean autoSaveAndExit = false;
boolean renderComplete = false;

Dot[][] dots;

class Dot {
  float x, y, r, b, grad;
  Dot(float x, float y, float r, float b, float grad) {
    this.x = x;
    this.y = y;
    this.r = r;
    this.b = b;
    this.grad = grad;
  }
}

void settings() {
  size(800, 800);
}

void setup() {
  loadOrPickImage();
  if (img == null) {
    println("Failenn's dither: no image. Exiting.");
    exit();
    return;
  }

  layoutCanvasFromImage();
  background(255);

  img.resize(contentW, contentH);
  img.filter(GRAY);
  img.loadPixels();

  float spacing = contentW / float(gridCount);
  dots = new Dot[gridCount][gridCount];

  for (int gy = 0; gy < gridCount; gy++) {
    for (int gx = 0; gx < gridCount; gx++) {
      int px = int(gx * spacing + spacing * 0.5);
      int py = int(gy * spacing + spacing * 0.5);
      float b = brightness(img.get(px, py)) / 255.0;
      float grad = localGradient(px, py);
      float r = lerp(maxRadius, minRadius, b);
      dots[gx][gy] = new Dot(px + marginPx, py + marginPx, r, b, grad);
    }
  }

  noStroke();
  fill(0);

  int[][] neighbors = { {1, 0}, {0, 1}, {1, 1}, {-1, 1} };
  boolean[][][] connected = new boolean[gridCount][gridCount][4];
  int maxLinksPerDot = 4;

  for (int gy = 0; gy < gridCount; gy++) {
    for (int gx = 0; gx < gridCount; gx++) {
      Dot a = dots[gx][gy];
      if (a == null) continue;
      if (a.b > 0.5 || a.grad > gradientThreshold) continue;

      int links = 0;
      for (int n = 0; n < neighbors.length; n++) {
        if (links >= maxLinksPerDot) break;

        int gx2 = gx + neighbors[n][0];
        int gy2 = gy + neighbors[n][1];
        if (gx2 < 0 || gy2 < 0 || gx2 >= gridCount || gy2 >= gridCount) continue;

        Dot b = dots[gx2][gy2];
        if (b == null) continue;

        if (b.b > 0.5 || b.grad > gradientThreshold) continue;
        if (abs(a.b - b.b) > toneDiffLimit) continue;
        if (a.b > 0.5 || b.b > 0.5) continue;

        float d = dist(a.x, a.y, b.x, b.y);

        if (d < (a.r + b.r) * 0.8) continue;
        if (d > (a.r + b.r) * 1.5) continue;

        if (connected[gx][gy][n]) continue;
        connected[gx][gy][n] = true;

        for (int m = 0; m < neighbors.length; m++) {
          if (neighbors[m][0] == -neighbors[n][0] && neighbors[m][1] == -neighbors[n][1]) {
            connected[gx2][gy2][m] = true;
          }
        }

        if (d > spacing * maxConnectDist * 0.9) continue;
        drawBridge(a, b);
        links++;
      }
    }
  }

  for (int gy = 0; gy < gridCount; gy++) {
    for (int gx = 0; gx < gridCount; gx++) {
      Dot d = dots[gx][gy];
      if (d != null) circle(d.x, d.y, d.r * 2);
    }
  }

  saveFrame(outputFileName);
  renderComplete = true;
  println("Failenn's dither — render complete. Press S save, R re-render, O new image.");
  if (autoSaveAndExit) {
    saveOutput();
    exit();
  }
  noLoop();
}

void layoutCanvasFromImage() {
  float iw = img.width;
  float ih = img.height;
  float scale = min(1.0, maxContentSide / max(iw, ih));
  contentW = max(1, round(iw * scale));
  contentH = max(1, round(ih * scale));
  marginPx = max(12, round(marginFraction * max(contentW, contentH)));
  surface.setSize(contentW + 2 * marginPx, contentH + 2 * marginPx);
}

void keyPressed() {
  if (key == 's' || key == 'S') {
    saveOutput();
  } else if (key == 'r' || key == 'R') {
    rerender();
  } else if (key == 'o' || key == 'O') {
    selectInput("Failenn's dither — pick an image:", "onImagePicked");
  }
}

void loadOrPickImage() {
  img = loadImage(inputImagePath);
  if (img != null) return;

  String[] fallbacks = {
    "0030_30A000085270030.jpeg",
    "0026_26A000085270026.jpeg",
    "0014_21A000005570014.jpg"
  };
  for (int i = 0; i < fallbacks.length; i++) {
    img = loadImage(fallbacks[i]);
    if (img != null) {
      inputImagePath = fallbacks[i];
      return;
    }
  }

  selectInput("Failenn's dither — pick an image:", "onImagePicked");
}

void onImagePicked(File selection) {
  if (selection == null) {
    println("No file selected.");
    return;
  }
  inputImagePath = selection.getAbsolutePath();
  img = loadImage(inputImagePath);
  if (img == null) {
    println("Failed to load: " + inputImagePath);
    return;
  }
  rerender();
}

void rerender() {
  background(255);
  loop();
  setup();
}

void saveOutput() {
  if (!renderComplete) {
    println("Nothing to save yet.");
    return;
  }
  saveFrame(outputFileName);
  println("Failenn's dither — saved: " + outputFileName);
}

void drawBridge(Dot a, Dot b) {
  int steps = 28;
  float dx = b.x - a.x;
  float dy = b.y - a.y;
  float angle = atan2(dy, dx);
  float nx = -sin(angle);
  float ny =  cos(angle);

  float tone = (a.b + b.b) * 0.5;
  float darknessFactor = 1.2 - tone;
  float baseW = min(a.r, b.r) * bridgeScale * 0.7 * darknessFactor;
  float waistW = baseW * constrain(bridgeWaist, 0.02, 1.0);

  float taperStrength = constrain(edgeTaper, 0.0, 1.0);
  float edgeLimitA = TWO_PI * a.r * 0.15;
  float edgeLimitB = TWO_PI * b.r * 0.15;
  float totalDist = dist(a.x, a.y, b.x, b.y);

  beginShape();
  for (int i = 0; i <= steps; i++) {
    float t = i / float(steps);
    float cx = lerp(a.x, b.x, t);
    float cy = lerp(a.y, b.y, t);

    float taper = pow(sin(PI * t), 1.2);
    float w = lerp(baseW, waistW, taper);

    float edgeBlend = 1.0;
    if (t * totalDist < edgeLimitA) {
      float fade = t * totalDist / edgeLimitA;
      edgeBlend = lerp(0.6, 1.0, fade);
    } else if ((1 - t) * totalDist < edgeLimitB) {
      float fade = (1 - t) * totalDist / edgeLimitB;
      edgeBlend = lerp(0.6, 1.0, fade);
    }

    float endTaper = lerp(1.0, sin(PI * t), taperStrength);
    w *= edgeBlend * endTaper;
    vertex(cx - nx * w, cy - ny * w);
  }

  for (int i = steps; i >= 0; i--) {
    float t = i / float(steps);
    float cx = lerp(a.x, b.x, t);
    float cy = lerp(a.y, b.y, t);

    float taper = pow(sin(PI * t), 1.2);
    float w = lerp(baseW, waistW, taper);

    float edgeBlend = 1.0;
    if (t * totalDist < edgeLimitA) {
      float fade = t * totalDist / edgeLimitA;
      edgeBlend = lerp(0.6, 1.0, fade);
    } else if ((1 - t) * totalDist < edgeLimitB) {
      float fade = (1 - t) * totalDist / edgeLimitB;
      edgeBlend = lerp(0.6, 1.0, fade);
    }

    float endTaper = lerp(1.0, sin(PI * t), taperStrength);
    w *= edgeBlend * endTaper;
    vertex(cx + nx * w, cy + ny * w);
  }

  endShape(CLOSE);
}

float localGradient(int x, int y) {
  int x1 = constrain(x-1, 0, img.width-1);
  int x2 = constrain(x+1, 0, img.width-1);
  int y1 = constrain(y-1, 0, img.height-1);
  int y2 = constrain(y+1, 0, img.height-1);

  float bL = brightness(img.get(x1, y)) / 255.0;
  float bR = brightness(img.get(x2, y)) / 255.0;
  float bU = brightness(img.get(x, y1)) / 255.0;
  float bD = brightness(img.get(x, y2)) / 255.0;

  float dx = bR - bL;
  float dy = bD - bU;
  return sqrt(dx*dx + dy*dy);
}
