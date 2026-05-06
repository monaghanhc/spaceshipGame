/**
 * Nebula Run — p5.js arcade survival (GitHub Pages).
 * Levels, power-ups, lives, combo, particles, high scores (localStorage).
 */

const W = 1000;
const H = 600;

/** Map pointer from canvas pixels → game space (for responsive canvas). */
function gamePointerX() {
  if (!width) return W / 2;
  return constrain((mouseX * W) / width, 0, W);
}

function gamePointerY() {
  if (!height) return H / 2;
  return constrain((mouseY * H) / height, 0, H);
}

function computeCanvasSize() {
  const pad = 12;
  let ax = typeof window !== "undefined" ? window.innerWidth : W;
  let ay = typeof window !== "undefined" ? window.innerHeight : H;
  if (typeof window !== "undefined" && window.visualViewport) {
    ax = window.visualViewport.width;
    ay = window.visualViewport.height;
  }
  const maxW = max(ax - pad * 2, 220);
  const maxH = max(ay - pad * 2, 200);
  const s = min(maxW / W, maxH / H);
  return { cw: floor(W * s), ch: floor(H * s) };
}

/**
 * Stops the browser from panning/scroll-bouncing the page while the finger
 * drags on the game (iOS/Safari/Chrome need non-passive preventDefault).
 */
function installTouchScrollBlock() {
  if (typeof document === "undefined") return;
  const cnv = document.querySelector("#game canvas");
  if (!cnv || cnv.dataset.nebTouchLock) return;
  cnv.dataset.nebTouchLock = "1";
  cnv.style.touchAction = "none";
  const block = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  cnv.addEventListener("touchstart", block, { passive: false });
  cnv.addEventListener("touchmove", block, { passive: false });
}

/** Safari/iOS: pinch zoom shifts the “screen”; cancel gesture scaling on the page. */
function installGesturePinchBlock() {
  if (typeof document === "undefined") return;
  if (document.documentElement.dataset.nebGestureLock) return;
  document.documentElement.dataset.nebGestureLock = "1";
  const stop = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  document.addEventListener("gestureend", stop, { passive: false });
}

/**
 * Safari often ignores canvas-only listeners — block default touch scrolling on the
 * whole document in capture phase so only the game responds to drag.
 */
function installDocumentTouchCapture() {
  if (typeof document === "undefined") return;
  if (document.documentElement.dataset.nebDocTouch) return;
  document.documentElement.dataset.nebDocTouch = "1";

  const block = (e) => {
    if (e.cancelable) e.preventDefault();
  };
  /* touchmove only: document touchstart+preventDefault can break p5/touch on some iOS versions. */
  document.addEventListener("touchmove", block, { passive: false, capture: true });

  const clampScroll = () => {
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };
  window.addEventListener("scroll", clampScroll, { passive: true });
}

const HS_KEY = "spaceshipGame_highscores_v2";
const MAX_ENT = 120;
const MAX_PICKUPS = 24;
const MAX_PARTICLES = 200;

let starX = [],
  starY = [],
  starSpeed = [];
let points = 0;
let end = null;
let gameScreen = 0;
let shipImg;
let ships;
let spawnTimer;
let bonusSpawnTimer;
let enemies;
let pickups;
let totalEnemy = 0;
let totalPickup = 0;
let spaceShip;

let level = 1;
let lives = 3;
let levelFlash = 0;
let damageFlash = 0;
let shieldUntil = 0;
let slowMoUntil = 0;
let scoreMultUntil = 0;
let scoreMultiplier = 1;
let combo = 0;
let comboPeakFrame = 0;
let shake = 0;
let particles = [];

function loadScores() {
  try {
    const raw = localStorage.getItem(HS_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

function saveScoreEntry(score, lvl) {
  const list = loadScores();
  list.push({
    score: floor(score),
    level: lvl,
    t: new Date().toISOString(),
  });
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem(HS_KEY, JSON.stringify(list.slice(0, 10)));
}

function drawStarField() {
  for (let i = 0; i < 100; i++) {
    const co = map(starSpeed[i], 1, 5, 80, 255);
    stroke(co, co, min(255, co + 40));
    strokeWeight(starSpeed[i] * 0.65);
    point(starX[i], starY[i]);
    const drift = (slowMoActive() ? 0.35 : 1) * (starSpeed[i] / 2);
    starX[i] -= drift;
    if (starX[i] < 0) starX[i] = W;
  }
}

function slowMoActive() {
  return millis() < slowMoUntil;
}

function shieldActive() {
  return millis() < shieldUntil;
}

function multActive() {
  return millis() < scoreMultUntil;
}

function effectiveScoreMultiplier() {
  let m = 1;
  if (multActive()) m *= 2;
  m *= 1 + min(combo, 12) * 0.06;
  return m;
}

function spawnIntervalMs() {
  return max(72, 300 - (level - 1) * 18 - floor(points / 2500) * 8);
}

function bonusIntervalMs() {
  return random(2800, 5200) - min(level * 120, 1400);
}

/** ---------- Audio (tiny Web Audio bleeps) ---------- */
let actx;
function beep(freq, dur = 0.06, vol = 0.08, type = "sine") {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch (e) {}
}

/** ---------- Timers ---------- */
class TimerP5 {
  constructor(ms) {
    this.totalTime = ms;
  }
  start() {
    this.savedTime = millis();
  }
  setDuration(ms) {
    this.totalTime = ms;
  }
  isFinished() {
    return millis() - this.savedTime > this.totalTime;
  }
}

/** ---------- Enemies ---------- */
class EnemyP5 {
  constructor(lvl) {
    const roll = random();
    const spdScale = 1 + (lvl - 1) * 0.1 + floor(points / 4000) * 0.04;

    if (roll < 0.14) {
      this.kind = "swift";
      this.r = 6;
      this.speed = random(3.8, 7.2) * spdScale;
      this.c = color(255, 80, 90);
    } else if (roll < 0.3) {
      this.kind = "heavy";
      this.r = 15;
      this.speed = random(0.9, 2.3) * spdScale;
      this.c = color(160, 90, 220);
    } else {
      this.kind = "rock";
      this.r = 8;
      this.speed = random(1.4, 4.8) * spdScale;
      this.c = color(random(120, 220), random(30, 90), random(140, 220));
    }

    this.x = random(this.r, W - this.r);
    this.y = -this.r * 3;
    this.rot = random(TWO_PI);
    this.spin = random(-0.08, 0.08);
  }

  move() {
    const sf = slowMoActive() ? 0.42 : 1;
    this.y += this.speed * sf;
    this.rot += this.spin * (slowMoActive() ? 0.55 : 1);
  }

  display() {
    push();
    translate(this.x, this.y);
    rotate(this.rot);
    noStroke();
    fill(red(this.c), green(this.c), blue(this.c), 220);
    const bumps = this.kind === "heavy" ? 7 : 5;
    beginShape();
    for (let i = 0; i < bumps; i++) {
      const a = (TWO_PI / bumps) * i;
      const rr = this.r * (0.75 + noise(this.x * 0.01, this.y * 0.01, i) * 0.35);
      vertex(cos(a) * rr, sin(a) * rr);
    }
    endShape(CLOSE);
    fill(255, 40);
    ellipse(0, 0, this.r * 0.6, this.r * 0.6);
    pop();
  }

  caught() {
    this.speed = 0;
    this.y = -4000;
    this.x = -9000;
  }
}

/** ---------- Pickups ---------- */
const PK = {
  SHIELD: "shield",
  SLOW: "slow",
  MULT: "mult",
  LIFE: "life",
  GEM: "gem",
};

class PickupP5 {
  constructor() {
    const r = random();
    if (r < 0.22) this.kind = PK.SHIELD;
    else if (r < 0.4) this.kind = PK.SLOW;
    else if (r < 0.58) this.kind = PK.MULT;
    else if (r < 0.68) this.kind = PK.LIFE;
    else this.kind = PK.GEM;

    this.r = 14;
    this.x = random(40, W - 40);
    this.y = -30;
    this.vy = random(1.8, 3.4);
    this.pulse = random(TWO_PI);
  }

  move() {
    const sf = slowMoActive() ? 0.5 : 1;
    this.y += this.vy * sf;
    this.pulse += 0.12;
  }

  display() {
    push();
    translate(this.x, this.y);
    const wobble = sin(this.pulse) * 3;
    noStroke();

    if (this.kind === PK.SHIELD) {
      fill(80, 220, 255, 200);
      ellipse(0, wobble, this.r * 2.2, this.r * 2.2);
      fill(180, 250, 255);
      ellipse(0, wobble, this.r * 1.2, this.r * 1.2);
    } else if (this.kind === PK.SLOW) {
      fill(120, 160, 255);
      ellipse(0, wobble, this.r * 2, this.r * 2);
      fill(220);
      textAlign(CENTER, CENTER);
      textSize(16);
      text("◎", 0, wobble);
    } else if (this.kind === PK.MULT) {
      fill(255, 220, 80);
      starShape(0, wobble, this.r * 1.6, 6);
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(14);
      text("×2", 0, wobble + 1);
    } else if (this.kind === PK.LIFE) {
      fill(80, 255, 140);
      rectMode(CENTER);
      rect(0, wobble, 8, 22, 3);
      rect(0, wobble, 22, 8, 3);
    } else {
      fill(200, 120, 255);
      ellipse(0, wobble, this.r * 1.7, this.r * 2);
      fill(255);
      ellipse(-4, wobble - 3, 6, 8);
    }
    pop();
  }

  collect() {
    this.y = -9999;
  }
}

function starShape(cx, cy, radius, points) {
  beginShape();
  for (let i = 0; i < points * 2; i++) {
    const a = (PI / points) * i;
    const rr = i % 2 === 0 ? radius : radius * 0.45;
    vertex(cx + cos(a - HALF_PI) * rr, cy + sin(a - HALF_PI) * rr);
  }
  endShape(CLOSE);
}

/** ---------- Ship / collision ---------- */
class ShipsP5 {
  constructor(tempR) {
    this.r = tempR;
    this.c = color(50, 100, 50, 10);
    this.x = W / 2;
    this.y = H / 2;
  }
  setLocation(tempX, tempY) {
    this.x = tempX;
    this.y = tempY;
  }
  displayShieldRing(active) {
    if (!active) return;
    push();
    stroke(80, 220, 255, 140 + sin(millis() * 0.012) * 60);
    strokeWeight(3);
    noFill();
    ellipse(this.x, this.y, this.r * 2.4, this.r * 2.4);
    stroke(180, 250, 255, 90);
    ellipse(this.x, this.y, this.r * 2.8, this.r * 2.8);
    pop();
  }
  display() {
    stroke(40, 80, 120, 80);
    strokeWeight(2);
    fill(this.c);
    ellipse(this.x, this.y, this.r * 2, this.r * 2);
  }
  intersectCircle(px, py, pr) {
    return dist(this.x, this.y, px, py) < this.r + pr;
  }
}

class ShipSprite {
  display(img, tilt) {
    const px = gamePointerX();
    const py = gamePointerY();
    push();
    translate(px + img.width / 2, py + img.height / 2);
    rotate(tilt);
    imageMode(CENTER);
    image(img, 0, 0);
    pop();
    noCursor();
  }
}

/** ---------- Particles ---------- */
function spawnBurst(x, y, col, n = 14) {
  for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
    const a = random(TWO_PI);
    const s = random(1.5, 6);
    particles.push({
      x,
      y,
      vx: cos(a) * s,
      vy: sin(a) * s,
      life: random(18, 42),
      col,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= 1;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = map(p.life, 0, 40, 0, 220);
    fill(red(p.col), green(p.col), blue(p.col), a);
    noStroke();
    ellipse(p.x, p.y, 5, 5);
  }
}

/** ---------- Level ---------- */
function syncLevelToScore() {
  const targetLevel = 1 + floor(points / 2400);
  if (targetLevel > level) {
    while (level < targetLevel) {
      level++;
      levelFlash = 110;
      spawnBurst(W / 2, H / 2, color(100, 200, 255), 48);
      beep(520, 0.1, 0.07);
      beep(780, 0.12, 0.06);
    }
    spawnTimer.setDuration(spawnIntervalMs());
  }
}

/** ---------- HUD ---------- */
function drawHud() {
  push();
  noStroke();
  fill(0, 0, 0, 120);
  rect(0, 0, W, 72);

  textStyle(BOLD);
  fill(220);
  textAlign(LEFT, TOP);
  textSize(15);
  text("NEBULA RUN", 18, 10);

  textSize(22);
  fill(255);
  text("SCORE  " + nf(floor(points), 1), 18, 28);

  textAlign(RIGHT, TOP);
  fill(180, 230, 255);
  text("LEVEL  " + level, W - 18, 12);
  fill(255, 200, 120);
  text("HIGH  " + nf(highScoreDisplay(), 1), W - 18, 38);

  textAlign(LEFT, TOP);
  textSize(14);
  fill(160);
  textStyle(NORMAL);
  const cx = W / 2 - 120;
  drawLives(cx, 22, lives);
  text("COMBO x" + nf(1 + min(combo, 12) * 0.06, 1, 2), cx + 140, 26);

  textAlign(CENTER, TOP);
  textSize(13);
  if (shieldActive()) {
    fill(120, 220, 255);
    text("SHIELD", W / 2, 12);
  } else if (slowMoActive()) {
    fill(160, 180, 255);
    text("CHRONO", W / 2, 12);
  } else if (multActive()) {
    fill(255, 220, 140);
    text("DOUBLE PTS", W / 2, 12);
  } else {
    fill(70, 90, 110);
    text("STATUS", W / 2, 12);
  }

  const low = (level - 1) * 2400;
  const high = level * 2400;
  const prog = constrain(map(points, low, high, 0, 1), 0, 1);
  noStroke();
  fill(30, 40, 70);
  rect(W / 2 - 120, 52, 240, 6, 3);
  fill(90, 200, 255);
  rect(W / 2 - 120, 52, 240 * prog, 6, 3);

  pop();

  if (levelFlash > 0) {
    levelFlash--;
    push();
    textStyle(BOLD);
    fill(255, 255, 255, map(levelFlash, 0, 120, 0, 200));
    textAlign(CENTER, CENTER);
    textSize(56 + sin(levelFlash * 0.2) * 6);
    text("LEVEL " + level, W / 2, H / 2 - 40);
    textStyle(NORMAL);
    pop();
  }

  if (damageFlash > 0) {
    damageFlash--;
    fill(255, 30, 40, map(damageFlash, 0, 25, 0, 120));
    rect(0, 0, W, H);
  }
}

function drawLives(x, y, n) {
  for (let i = 0; i < max(n, 0); i++) {
    fill(255, 90, 110);
    ellipse(x + i * 22, y, 12, 12);
    fill(255, 180, 190);
    ellipse(x + i * 22 - 2, y - 2, 4, 4);
  }
}

function highScoreDisplay() {
  const s = loadScores();
  return s.length ? s[0].score : 0;
}

/** ---------- Game over UI ---------- */
class EndGameP5 {
  constructor(scorePoints, lvl, ranks) {
    this.gameOverText = "MISSION FAIL";
    this.buttonText = "FLY AGAIN";
    this.pointsText = "FINAL SCORE  " + floor(scorePoints);
    this.levelText = "MAX LEVEL  " + lvl;
    this.buttonW = 220;
    this.buttonH = 52;
    this.buttonX = W / 2 - this.buttonW / 2;
    this.buttonY = H / 2 + 40;
    this.ranks = ranks;
  }
  drawEndScene() {
    fill(18, 8, 22, 230);
    rect(0, 0, W, H);

    textStyle(BOLD);
    fill(255, 80, 100);
    textAlign(CENTER, CENTER);
    textSize(52);
    text(this.gameOverText, W / 2, H / 4);

    textStyle(NORMAL);
    fill(230);
    textSize(22);
    text(this.pointsText, W / 2, H / 4 + 58);
    textSize(18);
    fill(180, 210, 255);
    text(this.levelText, W / 2, H / 4 + 92);

    stroke(100, 200, 255);
    fill(20, 40, 70);
    rect(this.buttonX, this.buttonY, this.buttonW, this.buttonH, 6);
    fill(200, 240, 255);
    textStyle(BOLD);
    textSize(22);
    text(this.buttonText, W / 2, this.buttonY + 27);
    textStyle(NORMAL);

    fill(200);
    textAlign(LEFT, TOP);
    textSize(16);
    text("TOP PILOTS", W / 2 - 160, H / 2 + 110);
    let y = H / 2 + 138;
    for (let i = 0; i < min(5, this.ranks.length); i++) {
      const e = this.ranks[i];
      const dt = e.t ? new Date(e.t).toLocaleDateString() : "";
      fill(i === 0 ? color(255, 220, 120) : 200);
      text((i + 1) + ".  " + nf(e.score, 1) + "  ·  L" + e.level + "  ·  " + dt, W / 2 - 160, y);
      y += 22;
    }
  }
  mouseOverButton() {
    const px = gamePointerX();
    const py = gamePointerY();
    return (
      px > this.buttonX &&
      px < this.buttonX + this.buttonW &&
      py > this.buttonY &&
      py < this.buttonY + this.buttonH
    );
  }
}

/** ---------- p5 lifecycle ---------- */
function preload() {
  shipImg = loadImage("alienShip.png");
}

function setup() {
  installDocumentTouchCapture();

  const { cw, ch } = computeCanvasSize();
  const c = createCanvas(cw, ch);
  c.parent("game");
  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  pixelDensity(width < 420 ? 1 : min(2, dpr));

  ships = new ShipsP5(64);
  spaceShip = new ShipSprite();
  enemies = new Array(MAX_ENT);
  pickups = new Array(MAX_PICKUPS);
  spawnTimer = new TimerP5(280);
  spawnTimer.start();
  bonusSpawnTimer = new TimerP5(3500);
  bonusSpawnTimer.start();

  for (let i = 0; i < 100; i++) {
    starX[i] = random(0, W);
    starY[i] = random(0, H);
    starSpeed[i] = random(1, 5);
  }

  installTouchScrollBlock();
  installGesturePinchBlock();

  if (typeof window !== "undefined" && window.visualViewport) {
    window.visualViewport.addEventListener(
      "resize",
      () => {
        windowResized();
      },
      { passive: true }
    );
    window.visualViewport.addEventListener(
      "scroll",
      () => {
        window.scrollTo(0, 0);
      },
      { passive: true }
    );
  }
}

function windowResized() {
  if (typeof width === "undefined" || width <= 0) return;
  const { cw, ch } = computeCanvasSize();
  resizeCanvas(cw, ch);
  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  pixelDensity(width < 420 ? 1 : min(2, dpr));
}

function draw() {
  push();
  scale(width / W, height / H);

  if (gameScreen === 0) {
    initScreen();
    if (!end) {
      drawStarField();
    }
  } else {
    playGameScreen();
  }

  pop();

  if (gameScreen === 0 || end) {
    cursor();
  } else {
    noCursor();
  }
}

function initScreen() {
  background(8, 6, 18);

  const narrow = width < 520;

  push();
  textStyle(BOLD);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(narrow ? 38 : 56);
  text("NEBULA RUN", W / 2, H / 2 - 110);
  textStyle(NORMAL);
  textSize(narrow ? 17 : 22);
  fill(160, 210, 255);
  text("Survive the storm. Chain combos. Grab tech drops.", W / 2, H / 2 - 52);
  textSize(narrow ? 15 : 18);
  fill(120, 180, 220);
  text(
    narrow
      ? "Drag to fly · Shield · Gems · Combo"
      : "Touch or mouse to pilot  ·  Shield / gems / combo score",
    W / 2,
    H / 2 - 18
  );

  fill(0, 200, 255);
  textSize(narrow ? 22 : 26);
  text("TAP TO LAUNCH", W / 2, H / 2 + 36);

  fill(100, 120, 160);
  textSize(narrow ? 14 : 16);
  text("Made by Hunter Monagahan", W / 2, H / 2 + 86);

  const board = loadScores();
  if (board.length) {
    fill(200);
    textAlign(CENTER, TOP);
    textSize(narrow ? 15 : 17);
    text("HALL OF FAME", W / 2, H / 2 + 130);
    let y = H / 2 + 158;
    for (let i = 0; i < min(5, board.length); i++) {
      const e = board[i];
      fill(i === 0 ? color(255, 220, 120) : 210);
      textSize(narrow ? 14 : 17);
      text((i + 1) + ".  " + nf(e.score, 1) + "  ·  Lvl " + e.level, W / 2, y);
      y += narrow ? 22 : 24;
    }
  }
  pop();
}

function playGameScreen() {
  if (end) {
    background(6, 4, 12);
    end.drawEndScene();
    return;
  }

  ships.setLocation(gamePointerX() + 52, gamePointerY() + 18);
  noCursor();

  push();
  applyShake();
  background(6, 4, 14);
  pop();

  drawStarField();

  const em = effectiveScoreMultiplier();
  points += (0.65 + level * 0.08) * em;
  comboPeakFrame++;
  if (comboPeakFrame > 140) {
    combo = min(combo + 1, 20);
    comboPeakFrame = 0;
  }

  syncLevelToScore();

  spawnTimer.setDuration(spawnIntervalMs());
  if (spawnTimer.isFinished()) {
    enemies[totalEnemy] = new EnemyP5(level);
    totalEnemy++;
    if (totalEnemy >= enemies.length) totalEnemy = 0;
    spawnTimer.start();
  }

  if (bonusSpawnTimer.isFinished()) {
    pickups[totalPickup] = new PickupP5();
    totalPickup++;
    if (totalPickup >= pickups.length) totalPickup = 0;
    bonusSpawnTimer.setDuration(bonusIntervalMs());
    bonusSpawnTimer.start();
  }

  for (let i = 0; i < pickups.length; i++) {
    const pu = pickups[i];
    if (!pu || pu.y < -200 || pu.y > H + 80) continue;
    pu.move();
    pu.display();
    if (pu.y > -50 && ships.intersectCircle(pu.x, pu.y, pu.r)) {
      applyPickup(pu);
      pu.collect();
      beep(660, 0.07, 0.07);
    }
  }

  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || e.y < -3500) continue;
    e.move();
    e.display();

    if (
      !e._nearMiss &&
      e.y > ships.y + 30 &&
      e.y < ships.y + 120 &&
      abs(e.x - ships.x) < 55
    ) {
      e._nearMiss = true;
      comboPeakFrame = max(0, comboPeakFrame - 35);
      combo = min(combo + 2, 20);
      points += 12 * em;
    }

    if (!ships.intersectCircle(e.x, e.y, e.r)) continue;

    if (shieldActive()) {
      spawnBurst(e.x, e.y, e.c, 22);
      e.caught();
      beep(420, 0.05, 0.06);
      points += 45 * em;
      continue;
    }

    lives--;
    combo = 0;
    comboPeakFrame = 0;
    shake = 18;
    damageFlash = 22;
    spawnBurst(ships.x, ships.y, color(255, 80, 80), 28);
    beep(140, 0.15, 0.1, "sawtooth");
    e.caught();

    if (lives <= 0) {
      saveScoreEntry(points, level);
      end = new EndGameP5(points, level, loadScores());
      beep(90, 0.35, 0.09, "triangle");
      return;
    }
  }

  updateParticles();
  drawParticles();

  drawHud();

  ships.displayShieldRing(shieldActive());
  ships.display();

  const tilt = map(gamePointerX(), 0, W, -0.18, 0.18);
  spaceShip.display(shipImg, tilt);

  if (shake > 0) shake *= 0.88;
}

function applyPickup(pu) {
  spawnBurst(pu.x, pu.y, color(120, 255, 200), 18);
  comboPeakFrame = 0;
  if (pu.kind === PK.SHIELD) {
    shieldUntil = millis() + 5500;
    beep(880, 0.06, 0.06);
  } else if (pu.kind === PK.SLOW) {
    slowMoUntil = millis() + 5500;
    beep(320, 0.08, 0.07);
  } else if (pu.kind === PK.MULT) {
    scoreMultUntil = millis() + 9000;
    beep(520, 0.06, 0.06);
    beep(740, 0.06, 0.06);
  } else if (pu.kind === PK.LIFE) {
    lives = min(lives + 1, 9);
    beep(600, 0.08, 0.07);
  } else if (pu.kind === PK.GEM) {
    points += 420 * effectiveScoreMultiplier();
    combo = min(combo + 4, 20);
    beep(990, 0.05, 0.05);
  }
}

function applyShake() {
  if (shake > 0.4) {
    translate(random(-shake, shake), random(-shake, shake));
  }
}

function mousePressed() {
  if (gameScreen === 0) {
    startGame();
    return;
  }
  if (end && end.mouseOverButton()) {
    resetGame();
  }
}

function startGame() {
  gameScreen = 1;
  end = null;
  points = 0;
  level = 1;
  lives = 3;
  combo = 0;
  comboPeakFrame = 0;
  shieldUntil = 0;
  slowMoUntil = 0;
  scoreMultUntil = 0;
  levelFlash = 0;
  shake = 0;
  particles = [];
  totalEnemy = 0;
  totalPickup = 0;
  for (let i = 0; i < enemies.length; i++) enemies[i] = undefined;
  for (let i = 0; i < pickups.length; i++) pickups[i] = undefined;
  spawnTimer.setDuration(spawnIntervalMs());
  spawnTimer.start();
  bonusSpawnTimer.setDuration(2000);
  bonusSpawnTimer.start();
  beep(440, 0.06, 0.06);
}

function resetGame() {
  startGame();
}

/** Reduce pull-to-refresh / scroll while dragging on the canvas (mobile). */
function touchMoved() {
  return false;
}
