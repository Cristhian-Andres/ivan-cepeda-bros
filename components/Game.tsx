"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./Game.module.css";

// Resolución interna estilo NES (16:9 apaisado)
const W = 400;
const H = 225;
const TILE = 16;
const COLS = 210;
const ROWS = 14;
const GROUND_ROW = 12; // tope del piso en y = 192
const MAX_LIVES = 3;

// Física (calibrada a 60 fps)
const ACC = 0.32;
const MAXVX = 2.2;
const GRAV = 0.5;
const JUMPV = -8.6;
const MAXFALL = 7;

type Phase = "menu" | "playing" | "dying" | "win" | "over";

// Códigos de tile
const T0 = 0; // vacío
const T_GROUND = 1;
const T_BRICK = 2;
const T_Q = 3; // bloque ?
const T_USED = 4; // bloque ? usado
const T_STONE = 5; // bloque de piedra (escaleras)
const T_PIPE_TL = 6;
const T_PIPE_TR = 7;
const T_PIPE_L = 8;
const T_PIPE_R = 9;
const T_COIN = 10; // moneda flotante (no sólida)

function isSolid(t: number): boolean {
  return t >= T_GROUND && t <= T_PIPE_R;
}

// ---------------------------------------------------------------------------
// Sprites pixel-art procedurales (misma técnica que el gato de Duck Hunt Facho)
// ---------------------------------------------------------------------------

// Iván Cepeda estilo Mario (16x24): pelo crespo oscuro, gafas, bigote y barba,
// saco azul oscuro abierto sobre camisa blanca.
const CEPEDA_COLORS: Record<string, string> = {
  H: "#241a12", // pelo crespo oscuro
  h: "#3f2e1f", // brillo del pelo
  S: "#e6b289", // piel
  s: "#c4906a", // sombra piel
  G: "#4a443c", // montura de las gafas
  E: "#cfe0e8", // lentes
  M: "#33261a", // bigote / barba
  W: "#f4f4f4", // camisa blanca
  N: "#22335c", // saco azul oscuro
  n: "#172547", // sombra del saco
  P: "#3a3d46", // pantalón
  B: "#5c3a22", // zapatos
};

const CEPEDA_HEAD = [
  "....HHHHHHHH....",
  "..HHHHHHHHHHHH..",
  ".HHHHHHHHHHHHH..",
  ".HHhHHHHHHHhHH..",
  ".HHSSSSSSSSHH...",
  ".HSSSSSSSSSSH...",
  ".HGGGGGGGGGGH...",
  ".HGEEGSSGEEGH...",
  ".HSSSSsSSSSSH...",
  ".HSMMMMMMMMSH...",
  "..SMSSssSSMS....",
  "..SMMMMMMMMS....",
];

const CEPEDA_BODY = [
  "...NNNWWNNN.....",
  "..NNNWWWWNNNN...",
  ".NNNNWWWWNNNNN..",
  ".NNNNWWWWNNNNN..",
  ".nNNNWWWWNNNNn..",
  ".SnNNWWWWNNNnS..",
  "..nNNNNNNNNNn...",
];

const CEPEDA_IDLE = [
  ...CEPEDA_HEAD,
  ...CEPEDA_BODY,
  "...PPP..PPP.....",
  "...PPP..PPP.....",
  "...PPP..PPP.....",
  "...PPP..PPP.....",
  "..BBBB..BBBB....",
];

const CEPEDA_WALK = [
  ...CEPEDA_HEAD,
  ...CEPEDA_BODY,
  "..PPP....PPP....",
  "..PPP....PPP....",
  ".PPP......PPP...",
  ".PPP......PPP...",
  "BBBB......BBBB..",
];

// Salto con el puño en alto (homenaje a la foto de campaña)
const CEPEDA_JUMP = [
  "....HHHHHHHH....",
  "..HHHHHHHHHHHH..",
  ".HHHHHHHHHHHHH..",
  ".HHhHHHHHHHhHH..",
  ".HHSSSSSSSSHH...",
  ".HSSSSSSSSSSH...",
  ".HGGGGGGGGGGH.SS",
  ".HGEEGSSGEEGH.SS",
  ".HSSSSsSSSSSH.N.",
  ".HSMMMMMMMMSH.N.",
  "..SMSSssSSMS.N..",
  "..SMMMMMMMMSNN..",
  "...NNNWWNNNN....",
  "..NNNWWWWNNNN...",
  ".NNNNWWWWNNNNN..",
  ".NNNNWWWWNNNNN..",
  ".nNNNWWWWNNNNn..",
  ".SnNNWWWWNNNn...",
  "..nNNNNNNNNNn...",
  "..PPP....PPP....",
  "..PPP....PPPB...",
  ".BPPP.....PPP...",
  "..BB......BBB...",
  "................",
];

const PLAYER_W = 12; // hitbox
const PLAYER_H = 22;
const SPRITE_W = 16;
const SPRITE_H = 24;

// Enemigo "corrupto" estilo goomba (16x12)
const GOOMBA_COLORS: Record<string, string> = {
  G: "#a9552e",
  D: "#6e3416",
  W: "#ffffff",
  B: "#1a1a1a",
};

const GOOMBA_MAP = [
  "....GGGGGGGG....",
  "..GGGGGGGGGGGG..",
  ".GGGGGGGGGGGGGG.",
  ".GGWWWGGGGWWWGG.",
  "GGWWBWGGGGWBWWGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  "GGGGGGGGGGGGGGGG",
  ".GGGGGGGGGGGGGG.",
  "..GGGGGGGGGGGG..",
  ".DDDDDG..GDDDDD.",
  ".DDDD......DDDD.",
];

function makeSprite(map: string[], colors: Record<string, string>, width = 16): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = map.length;
  const g = c.getContext("2d")!;
  map.forEach((row, y) => {
    for (let x = 0; x < row.length && x < width; x++) {
      const col = colors[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

// ---------------------------------------------------------------------------
// Casa de Nariño procedural (el "castillo" de llegada): fachada crema
// neoclásica al atardecer, pórtico con columnas, frontón y bandera de Colombia.
// ---------------------------------------------------------------------------
const CASA_W = 224;
const CASA_H = 132;

function makeCasaNarinoSprite(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = CASA_W;
  c.height = CASA_H;
  const g = c.getContext("2d")!;

  const wall = "#f0dfb0";
  const wallLight = "#f8ecc6";
  const cornice = "#c9b584";
  const colWhite = "#fbf3df";
  const glow = "#ffcf6e";
  const frame = "#a8946a";
  const dark = "#3a2414";

  // Cuerpo principal (dos pisos)
  g.fillStyle = wall;
  g.fillRect(0, 52, CASA_W, 80);
  // Cornisa entre pisos y zócalo
  g.fillStyle = cornice;
  g.fillRect(0, 90, CASA_W, 3);
  g.fillRect(0, 126, CASA_W, 2);
  // Parapeto y balaustrada
  g.fillStyle = cornice;
  g.fillRect(0, 48, CASA_W, 4);
  g.fillRect(0, 40, CASA_W, 2);
  for (let x = 2; x < CASA_W; x += 8) {
    g.fillRect(x, 42, 3, 6);
  }

  // Ventanas de las alas (luz cálida de atardecer como en la foto)
  const wing = (x0: number, x1: number) => {
    for (let x = x0; x + 9 <= x1; x += 14) {
      // piso superior
      g.fillStyle = frame;
      g.fillRect(x, 58, 9, 18);
      g.fillStyle = glow;
      g.fillRect(x + 1, 59, 7, 16);
      g.fillStyle = frame;
      g.fillRect(x + 1, 66, 7, 1);
      // piso inferior
      g.fillStyle = frame;
      g.fillRect(x, 98, 9, 22);
      g.fillStyle = glow;
      g.fillRect(x + 1, 99, 7, 20);
      g.fillStyle = frame;
      g.fillRect(x + 1, 108, 7, 1);
    }
  };
  wing(8, 62);
  wing(166, 220);

  // Ático central detrás del frontón
  g.fillStyle = cornice;
  g.fillRect(86, 28, 52, 2);
  g.fillStyle = wall;
  g.fillRect(88, 30, 48, 16);
  g.fillStyle = glow;
  g.fillRect(96, 34, 6, 8);
  g.fillRect(122, 34, 6, 8);

  // Pórtico central que sobresale
  g.fillStyle = wallLight;
  g.fillRect(68, 42, 88, 90);
  // Entablamento
  g.fillStyle = cornice;
  g.fillRect(66, 42, 92, 6);
  // Frontón triangular
  g.fillStyle = wallLight;
  g.beginPath();
  g.moveTo(64, 42);
  g.lineTo(160, 42);
  g.lineTo(112, 20);
  g.closePath();
  g.fill();
  g.strokeStyle = cornice;
  g.lineWidth = 2;
  g.stroke();
  // Emblema del frontón
  g.fillStyle = cornice;
  g.beginPath();
  g.arc(112, 34, 4, 0, Math.PI * 2);
  g.fill();

  // Columnas
  g.fillStyle = colWhite;
  const colXs = [73, 87, 101, 119, 133, 147];
  for (const cx of colXs) {
    g.fillRect(cx, 52, 7, 68);
    g.fillStyle = cornice;
    g.fillRect(cx - 1, 50, 9, 3);
    g.fillRect(cx - 1, 118, 9, 3);
    g.fillStyle = colWhite;
  }

  // Puerta central con luz cálida
  g.fillStyle = dark;
  g.fillRect(104, 100, 16, 28);
  g.fillStyle = glow;
  g.fillRect(106, 96, 12, 4);
  g.fillRect(110, 104, 4, 10);

  // Escalinata
  g.fillStyle = "#b8b09a";
  g.fillRect(60, 128, 104, 2);
  g.fillStyle = "#a39b85";
  g.fillRect(54, 130, 116, 2);

  // Asta y bandera de Colombia
  g.fillStyle = "#888888";
  g.fillRect(111, 2, 2, 18);
  g.fillStyle = "#cccccc";
  g.fillRect(110, 0, 4, 2);
  g.fillStyle = "#ffd23f";
  g.fillRect(113, 3, 20, 6);
  g.fillStyle = "#2b4ea0";
  g.fillRect(113, 9, 20, 3);
  g.fillStyle = "#ce2424";
  g.fillRect(113, 12, 20, 3);

  return c;
}

// Patrón del signo "?" para los bloques sorpresa (5x8)
const Q_MARK = [
  "01110",
  "10001",
  "00001",
  "00010",
  "00100",
  "00000",
  "00100",
];

function pseudo(j: number): number {
  const v = Math.sin(j * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

// ---------------------------------------------------------------------------
// Construcción del nivel 1-1: pocos obstáculos, meta en la Casa de Nariño
// ---------------------------------------------------------------------------
const CASA_COL = 186;
const CASA_X = CASA_COL * TILE;
const GOAL_X = CASA_X + 104; // puerta de la casa
const SPAWN_X = 3 * TILE;
const ENEMY_SPAWNS = [27, 58, 95, 126];

function buildLevel(): number[][] {
  const map: number[][] = Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(T0));

  // Piso con huecos para saltar
  const segs: [number, number][] = [
    [0, 49],
    [52, 84],
    [88, 131],
    [134, 165],
    [168, 209],
  ];
  for (const [a, b] of segs) {
    for (let c = a; c <= b; c++) {
      map[GROUND_ROW][c] = T_GROUND;
      map[GROUND_ROW + 1][c] = T_GROUND;
    }
  }

  // Tuberías (col, alto en tiles)
  const pipe = (c: number, h: number) => {
    for (let i = 0; i < h; i++) {
      const r = GROUND_ROW - 1 - i;
      if (i === h - 1) {
        map[r][c] = T_PIPE_TL;
        map[r][c + 1] = T_PIPE_TR;
      } else {
        map[r][c] = T_PIPE_L;
        map[r][c + 1] = T_PIPE_R;
      }
    }
  };
  pipe(30, 2);
  pipe(62, 3);
  pipe(118, 2);

  // Bloques flotantes (fila 8 = 4 tiles sobre el piso)
  const row = 8;
  map[row][20] = T_BRICK;
  map[row][21] = T_Q;
  map[row][22] = T_BRICK;
  map[row][23] = T_Q;
  map[row][24] = T_BRICK;

  map[row][45] = T_Q;
  map[row][46] = T_Q;

  map[row][70] = T_BRICK;
  map[row][71] = T_BRICK;
  map[row][72] = T_Q;
  map[row][73] = T_BRICK;
  map[row][74] = T_BRICK;
  map[4][72] = T_Q;

  map[row][100] = T_Q;
  map[row][101] = T_BRICK;
  map[row][102] = T_BRICK;
  map[row][103] = T_Q;

  map[row][140] = T_BRICK;
  map[row][141] = T_Q;
  map[row][142] = T_Q;
  map[row][143] = T_BRICK;

  // Monedas flotantes
  const coin = (c: number, r: number) => {
    map[r][c] = T_COIN;
  };
  coin(31, 9);
  coin(63, 7);
  [85, 86, 87].forEach((c, i) => coin(c, 9 - (i === 1 ? 1 : 0)));
  [90, 91, 92, 93].forEach((c) => coin(c, 11));
  coin(71, 5);
  coin(72, 5);
  coin(73, 5);
  coin(119, 9);
  [146, 147, 148].forEach((c) => coin(c, 10));

  // Escalera de piedra antes de la meta
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k <= i; k++) {
      map[11 - k][172 + i] = T_STONE;
    }
  }

  return map;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  dead: boolean;
  deadT: number;
}

function makeEnemies(): Enemy[] {
  return ENEMY_SPAWNS.map((c) => ({
    x: c * TILE,
    y: (GROUND_ROW - 1) * TILE + 4,
    vx: -0.55,
    vy: 0,
    w: 14,
    h: 12,
    dead: false,
    deadT: 0,
  }));
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [coins, setCoins] = useState(0);
  const [gameOverVisible, setGameOverVisible] = useState(false);
  const [winVisible, setWinVisible] = useState(false);

  const phaseRef = useRef<Phase>("menu");
  const apiRef = useRef<{ startGame: () => void } | null>(null);
  const inputRef = useRef({ left: false, right: false, jump: false });

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    try {
      setBest(Number(localStorage.getItem("cb-best") || 0));
    } catch {}
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const sprIdle = makeSprite(CEPEDA_IDLE, CEPEDA_COLORS);
    const sprWalk = makeSprite(CEPEDA_WALK, CEPEDA_COLORS);
    const sprJump = makeSprite(CEPEDA_JUMP, CEPEDA_COLORS);
    const sprGoomba = makeSprite(GOOMBA_MAP, GOOMBA_COLORS);
    const sprCasa = makeCasaNarinoSprite();

    // ----- audio chiptune por WebAudio (sin assets) -----
    let actx: AudioContext | null = null;
    let musicTimer = 0;
    let musicStep = 0;
    const MELODY = [523, 659, 784, 659, 880, 784, 659, 523, 587, 698, 880, 698, 784, 659, 587, 523];

    function ensureAudio() {
      if (!actx) {
        try {
          actx = new AudioContext();
        } catch {}
      }
      actx?.resume().catch(() => {});
    }

    function beep(freq: number, dur: number, type: OscillatorType = "square", vol = 0.14, slide = 0) {
      if (!actx) return;
      const t0 = actx.currentTime;
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(actx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    }

    const sfxJump = () => beep(360, 0.18, "square", 0.1, 420);
    const sfxCoin = () => {
      beep(988, 0.07, "square", 0.1);
      window.setTimeout(() => beep(1319, 0.18, "square", 0.1), 70);
    };
    const sfxStomp = () => beep(300, 0.12, "triangle", 0.18, -200);
    const sfxBump = () => beep(140, 0.08, "square", 0.1);
    const sfxDie = () => beep(520, 0.5, "sawtooth", 0.12, -400);
    const sfxWin = () => {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        window.setTimeout(() => beep(f, 0.22, "square", 0.12), i * 120),
      );
    };

    function startMusic() {
      stopMusic();
      musicTimer = window.setInterval(() => {
        if (document.hidden || phaseRef.current !== "playing") return;
        const f = MELODY[musicStep % MELODY.length];
        musicStep++;
        if (f) beep(f, 0.12, "square", 0.035);
      }, 160);
    }
    function stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = 0;
    }

    // ----- estado del juego -----
    let map = buildLevel();

    const s = {
      score: 0,
      coins: 0,
      lives: MAX_LIVES,
      t: 0,
      camX: 0,
      player: {
        x: SPAWN_X,
        y: GROUND_ROW * TILE - PLAYER_H,
        vx: 0,
        vy: 0,
        w: PLAYER_W,
        h: PLAYER_H,
        face: 1,
        onGround: false,
      },
      enemies: makeEnemies(),
      jumpHeldPrev: false,
      jumpBuf: 0,
      coyote: 0,
      walkT: 0,
      winT: 0,
      winScored: false,
      pops: [] as { x: number; y: number; vy: number; t: number }[],
      fireworks: [] as { x: number; y: number; vx: number; vy: number; t: number; col: string }[],
      fwTimer: 0,
    };

    function syncHud() {
      setScore(s.score);
      setLives(s.lives);
      setCoins(s.coins);
    }

    function resetPlayer() {
      s.player.x = SPAWN_X;
      s.player.y = GROUND_ROW * TILE - PLAYER_H;
      s.player.vx = 0;
      s.player.vy = 0;
      s.player.face = 1;
      s.player.onGround = false;
      s.camX = 0;
      s.enemies = makeEnemies();
    }

    function startGame() {
      ensureAudio();
      map = buildLevel();
      s.score = 0;
      s.coins = 0;
      s.lives = MAX_LIVES;
      s.winT = 0;
      s.winScored = false;
      s.pops = [];
      s.fireworks = [];
      resetPlayer();
      setGameOverVisible(false);
      setWinVisible(false);
      syncHud();
      musicStep = 0;
      startMusic();
      setPhaseBoth("playing");
    }
    apiRef.current = { startGame };

    function saveBest() {
      setBest((b) => {
        const nb = Math.max(b, s.score);
        try {
          localStorage.setItem("cb-best", String(nb));
        } catch {}
        return nb;
      });
    }

    function gameOver() {
      stopMusic();
      saveBest();
      setPhaseBoth("over");
      window.setTimeout(() => setGameOverVisible(true), 700);
    }

    function die() {
      if (phaseRef.current !== "playing") return;
      sfxDie();
      s.player.vy = -7;
      s.player.vx = 0;
      setPhaseBoth("dying");
    }

    function winLevel() {
      if (phaseRef.current !== "playing") return;
      stopMusic();
      sfxWin();
      s.winT = 0;
      if (!s.winScored) {
        s.winScored = true;
        s.score += 1000;
        syncHud();
      }
      saveBest();
      setPhaseBoth("win");
      window.setTimeout(() => setWinVisible(true), 1600);
    }

    // ----- colisiones con tiles -----
    function solidAt(col: number, row: number): boolean {
      if (col < 0 || col >= COLS) return true; // muros en los bordes del nivel
      if (row < 0 || row >= ROWS) return false;
      return isSolid(map[row][col]);
    }

    type Body = { x: number; y: number; w: number; h: number; vy: number; onGround?: boolean };

    function moveX(o: Body, dx: number): boolean {
      o.x += dx;
      const top = Math.floor(o.y / TILE);
      const bot = Math.floor((o.y + o.h - 1) / TILE);
      if (dx > 0) {
        const c = Math.floor((o.x + o.w - 1) / TILE);
        for (let r = top; r <= bot; r++) {
          if (solidAt(c, r)) {
            o.x = c * TILE - o.w;
            return true;
          }
        }
      } else if (dx < 0) {
        const c = Math.floor(o.x / TILE);
        for (let r = top; r <= bot; r++) {
          if (solidAt(c, r)) {
            o.x = (c + 1) * TILE;
            return true;
          }
        }
      }
      return false;
    }

    function moveY(o: Body, dy: number, onHeadBump?: (c: number, r: number) => void): boolean {
      o.y += dy;
      const left = Math.floor(o.x / TILE);
      const right = Math.floor((o.x + o.w - 1) / TILE);
      if (dy >= 0) {
        const r = Math.floor((o.y + o.h - 1) / TILE);
        for (let c = left; c <= right; c++) {
          if (solidAt(c, r)) {
            o.y = r * TILE - o.h;
            o.vy = 0;
            o.onGround = true;
            return true;
          }
        }
        o.onGround = false;
      } else {
        const r = Math.floor(o.y / TILE);
        for (let c = left; c <= right; c++) {
          if (solidAt(c, r)) {
            o.y = (r + 1) * TILE;
            o.vy = 0;
            onHeadBump?.(c, r);
            return true;
          }
        }
      }
      return false;
    }

    function headBump(c: number, r: number) {
      const t = map[r][c];
      if (t === T_Q) {
        map[r][c] = T_USED;
        s.score += 100;
        s.coins += 1;
        s.pops.push({ x: c * TILE + 8, y: r * TILE, vy: -2.4, t: 1 });
        sfxCoin();
        syncHud();
      } else {
        sfxBump();
      }
    }

    function collectCoins() {
      const p = s.player;
      const left = Math.floor(p.x / TILE);
      const right = Math.floor((p.x + p.w - 1) / TILE);
      const top = Math.floor(p.y / TILE);
      const bot = Math.floor((p.y + p.h - 1) / TILE);
      for (let r = top; r <= bot; r++) {
        for (let c = left; c <= right; c++) {
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS && map[r][c] === T_COIN) {
            map[r][c] = T0;
            s.score += 100;
            s.coins += 1;
            s.pops.push({ x: c * TILE + 8, y: r * TILE, vy: -2, t: 1 });
            sfxCoin();
            syncHud();
          }
        }
      }
    }

    function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // ----- update -----
    function update(dt: number) {
      const n = Math.min(dt, 50) / 16.6667;
      s.t += dt;
      const ph = phaseRef.current;
      const p = s.player;

      // partículas siempre
      for (const pop of s.pops) {
        pop.y += pop.vy * n;
        pop.vy += 0.08 * n;
        pop.t -= dt * 0.0022;
      }
      s.pops = s.pops.filter((x) => x.t > 0);
      for (const f of s.fireworks) {
        f.x += f.vx * n;
        f.y += f.vy * n;
        f.vy += 0.05 * n;
        f.t -= dt * 0.0012;
      }
      s.fireworks = s.fireworks.filter((x) => x.t > 0);

      if (ph === "dying") {
        p.vy = Math.min(p.vy + GRAV * n, MAXFALL);
        p.y += p.vy * n;
        if (p.y > H + 60) {
          s.lives -= 1;
          syncHud();
          if (s.lives <= 0) {
            gameOver();
          } else {
            resetPlayer();
            setPhaseBoth("playing");
          }
        }
        return;
      }

      if (ph === "win") {
        s.winT += dt;
        // camina solo hacia la puerta de la casa
        if (p.x < GOAL_X + 14) {
          p.x += 1.1 * n;
          s.walkT += dt;
        }
        p.vy = Math.min(p.vy + GRAV * n, MAXFALL);
        moveY(p, p.vy * n);
        // fuegos artificiales sobre la casa
        s.fwTimer -= dt;
        if (s.fwTimer <= 0) {
          s.fwTimer = 280;
          const fx = CASA_X + 30 + Math.random() * 170;
          const fy = 25 + Math.random() * 50;
          const cols = ["#ffd23f", "#2b4ea0", "#ce2424", "#ffffff"];
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            s.fireworks.push({
              x: fx,
              y: fy,
              vx: Math.cos(a) * (0.8 + Math.random() * 0.8),
              vy: Math.sin(a) * (0.8 + Math.random() * 0.8),
              t: 1,
              col: cols[i % cols.length],
            });
          }
        }
        return;
      }

      if (ph !== "playing") return;

      // entrada
      const inp = inputRef.current;
      if (inp.left && !inp.right) {
        p.vx = Math.max(p.vx - ACC * n, -MAXVX);
        p.face = -1;
      } else if (inp.right && !inp.left) {
        p.vx = Math.min(p.vx + ACC * n, MAXVX);
        p.face = 1;
      } else {
        p.vx *= Math.pow(0.78, n);
        if (Math.abs(p.vx) < 0.05) p.vx = 0;
      }

      // salto con buffer y coyote time
      if (inp.jump && !s.jumpHeldPrev) s.jumpBuf = 8;
      s.jumpHeldPrev = inp.jump;
      if (s.jumpBuf > 0) s.jumpBuf -= n;
      if (p.onGround) s.coyote = 7;
      else if (s.coyote > 0) s.coyote -= n;
      if (s.jumpBuf > 0 && s.coyote > 0) {
        p.vy = JUMPV;
        p.onGround = false;
        s.coyote = 0;
        s.jumpBuf = 0;
        sfxJump();
      }
      if (!inp.jump && p.vy < -3.5) p.vy = -3.5; // salto variable

      p.vy = Math.min(p.vy + GRAV * n, MAXFALL);
      if (moveX(p, p.vx * n)) p.vx = 0;
      moveY(p, p.vy * n, headBump);

      if (Math.abs(p.vx) > 0.3 && p.onGround) s.walkT += dt;

      collectCoins();

      // caída al vacío
      if (p.y > H + 30) {
        s.lives -= 1;
        syncHud();
        if (s.lives <= 0) gameOver();
        else resetPlayer();
        return;
      }

      // enemigos
      for (const e of s.enemies) {
        if (e.dead) {
          e.deadT -= dt;
          continue;
        }
        // solo se activan cuando están cerca de la cámara
        if (e.x > s.camX + W + 40) continue;
        const dir = Math.sign(e.vx) || -1;
        const sp = Math.abs(e.vx);
        if (moveX(e, dir * sp * n)) e.vx = -dir * sp;
        e.vy = Math.min(e.vy + GRAV * n, MAXFALL);
        moveY(e, e.vy * n);

        if (overlap(p, e)) {
          if (p.vy > 0 && p.y + p.h - e.y < 10) {
            e.dead = true;
            e.deadT = 450;
            p.vy = -5.5;
            s.score += 200;
            sfxStomp();
            syncHud();
          } else {
            die();
            return;
          }
        }
      }
      s.enemies = s.enemies.filter((e) => (!e.dead || e.deadT > 0) && e.y < H + 60);

      // meta: la Casa de Nariño
      if (p.x + p.w >= GOAL_X) winLevel();

      // cámara
      s.camX = Math.max(0, Math.min(p.x - W * 0.4, COLS * TILE - W));
    }

    // ----- dibujo -----
    function drawSky() {
      ctx!.fillStyle = "#5c94fc";
      ctx!.fillRect(0, 0, W, H);
    }

    function drawMountains() {
      // cordillera andina al fondo (parallax lento)
      const par = s.camX * 0.2;
      ctx!.fillStyle = "#7ba3e8";
      for (let i = 0; i < 7; i++) {
        const bx = i * 230 - (par % 230) - 115;
        const h = 50 + pseudo(i + 31) * 35;
        ctx!.beginPath();
        ctx!.moveTo(bx, GROUND_ROW * TILE);
        ctx!.lineTo(bx + 115, GROUND_ROW * TILE - h);
        ctx!.lineTo(bx + 230, GROUND_ROW * TILE);
        ctx!.closePath();
        ctx!.fill();
      }
    }

    function drawClouds() {
      const par = s.camX * 0.35;
      ctx!.fillStyle = "#ffffff";
      for (let i = 0; i < 8; i++) {
        const cx = ((i * 170 + pseudo(i) * 90 - par) % (W + 200)) - 100;
        const cy = 18 + pseudo(i + 50) * 55;
        const r = 9 + pseudo(i + 90) * 6;
        ctx!.beginPath();
        ctx!.arc(cx, cy, r, 0, Math.PI * 2);
        ctx!.arc(cx + r, cy + 3, r * 0.85, 0, Math.PI * 2);
        ctx!.arc(cx - r, cy + 3, r * 0.85, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawHills() {
      const par = s.camX * 0.55;
      ctx!.fillStyle = "#27a127";
      for (let i = 0; i < 6; i++) {
        const hx = ((i * 290 + pseudo(i + 7) * 120 - par) % (W + 300)) - 150;
        const hw = 60 + pseudo(i + 13) * 50;
        ctx!.beginPath();
        ctx!.arc(hx, GROUND_ROW * TILE, hw, Math.PI, 0);
        ctx!.fill();
      }
    }

    function drawBushes() {
      ctx!.fillStyle = "#3fbf3f";
      for (let i = 0; i < 18; i++) {
        const bx = pseudo(i + 300) * COLS * TILE - s.camX;
        if (bx < -60 || bx > W + 60) continue;
        const bw = 14 + pseudo(i + 310) * 14;
        ctx!.beginPath();
        ctx!.arc(bx, GROUND_ROW * TILE, bw, Math.PI, 0);
        ctx!.arc(bx + bw * 0.8, GROUND_ROW * TILE, bw * 0.7, Math.PI, 0);
        ctx!.fill();
      }
    }

    function drawCasa() {
      const x = CASA_X - s.camX;
      if (x > W || x + CASA_W < 0) return;
      ctx!.drawImage(sprCasa, Math.round(x), GROUND_ROW * TILE - CASA_H);
      // letrero de meta
      ctx!.fillStyle = "rgba(0,0,0,0.55)";
      ctx!.fillRect(x + 76, GROUND_ROW * TILE - CASA_H - 14, 72, 11);
      ctx!.fillStyle = "#ffe94e";
      ctx!.font = "7px monospace";
      ctx!.textAlign = "center";
      ctx!.fillText("CASA DE NARIÑO", x + 112, GROUND_ROW * TILE - CASA_H - 6);
      ctx!.textAlign = "left";
    }

    function drawTile(t: number, x: number, y: number) {
      const g = ctx!;
      switch (t) {
        case T_GROUND:
          g.fillStyle = "#c8702a";
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = "#f0a868";
          g.fillRect(x, y, TILE, 2);
          g.fillRect(x, y, 2, TILE);
          g.fillStyle = "#7e4012";
          g.fillRect(x, y + TILE - 2, TILE, 2);
          g.fillRect(x + TILE - 2, y, 2, TILE);
          g.fillStyle = "#9c5418";
          g.fillRect(x + 4, y + 5, 3, 3);
          g.fillRect(x + 10, y + 9, 3, 3);
          break;
        case T_BRICK:
          g.fillStyle = "#b5481d";
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = "#6e2810";
          g.fillRect(x, y + 7, TILE, 1);
          g.fillRect(x, y + 15, TILE, 1);
          g.fillRect(x + 7, y, 1, 7);
          g.fillRect(x + 3, y + 8, 1, 7);
          g.fillRect(x + 11, y + 8, 1, 7);
          g.fillStyle = "#dd7040";
          g.fillRect(x, y, TILE, 1);
          break;
        case T_Q: {
          const pulse = Math.floor(s.t / 250) % 2 === 0;
          g.fillStyle = pulse ? "#ec9f19" : "#f7b733";
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = "#8a5500";
          g.fillRect(x, y, TILE, 1);
          g.fillRect(x, y + 15, TILE, 1);
          g.fillRect(x, y, 1, TILE);
          g.fillRect(x + 15, y, 1, TILE);
          g.fillRect(x + 1, y + 1, 2, 2);
          g.fillRect(x + 13, y + 1, 2, 2);
          g.fillRect(x + 1, y + 13, 2, 2);
          g.fillRect(x + 13, y + 13, 2, 2);
          g.fillStyle = "#ffffff";
          Q_MARK.forEach((row, py) => {
            for (let px = 0; px < row.length; px++) {
              if (row[px] === "1") g.fillRect(x + 5 + px * 1.4, y + 3 + py * 1.4, 1.5, 1.5);
            }
          });
          break;
        }
        case T_USED:
          g.fillStyle = "#9a6a38";
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = "#6e4a22";
          g.fillRect(x, y, TILE, 1);
          g.fillRect(x, y + 15, TILE, 1);
          g.fillRect(x, y, 1, TILE);
          g.fillRect(x + 15, y, 1, TILE);
          g.fillRect(x + 2, y + 2, 2, 2);
          g.fillRect(x + 12, y + 2, 2, 2);
          g.fillRect(x + 2, y + 12, 2, 2);
          g.fillRect(x + 12, y + 12, 2, 2);
          break;
        case T_STONE:
          g.fillStyle = "#b8b8b8";
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = "#e0e0e0";
          g.fillRect(x, y, TILE, 2);
          g.fillRect(x, y, 2, TILE);
          g.fillStyle = "#6e6e6e";
          g.fillRect(x, y + TILE - 2, TILE, 2);
          g.fillRect(x + TILE - 2, y, 2, TILE);
          break;
        case T_PIPE_TL:
          g.fillStyle = "#43b047";
          g.fillRect(x - 2, y, TILE + 2, TILE);
          g.fillStyle = "#8fdc8f";
          g.fillRect(x - 1, y + 1, 4, TILE - 2);
          g.fillStyle = "#1e7022";
          g.fillRect(x - 2, y, TILE + 2, 2);
          g.fillRect(x - 2, y + TILE - 2, TILE + 2, 2);
          break;
        case T_PIPE_TR:
          g.fillStyle = "#43b047";
          g.fillRect(x, y, TILE + 2, TILE);
          g.fillStyle = "#1e7022";
          g.fillRect(x + TILE - 2, y + 1, 4, TILE - 2);
          g.fillRect(x, y, TILE + 2, 2);
          g.fillRect(x, y + TILE - 2, TILE + 2, 2);
          break;
        case T_PIPE_L:
          g.fillStyle = "#43b047";
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = "#8fdc8f";
          g.fillRect(x + 1, y, 4, TILE);
          break;
        case T_PIPE_R:
          g.fillStyle = "#43b047";
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = "#1e7022";
          g.fillRect(x + TILE - 3, y, 3, TILE);
          break;
        case T_COIN: {
          const wob = Math.abs(Math.sin(s.t * 0.005 + x * 0.1));
          const cw = 3 + wob * 4;
          g.fillStyle = "#c98a00";
          g.beginPath();
          g.ellipse(x + 8, y + 8, cw, 6.5, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#ffd23f";
          g.beginPath();
          g.ellipse(x + 8, y + 8, Math.max(1, cw - 1.5), 5, 0, 0, Math.PI * 2);
          g.fill();
          break;
        }
      }
    }

    function drawMap() {
      const c0 = Math.max(0, Math.floor(s.camX / TILE));
      const c1 = Math.min(COLS - 1, Math.ceil((s.camX + W) / TILE));
      for (let r = 0; r < ROWS; r++) {
        for (let c = c0; c <= c1; c++) {
          const t = map[r][c];
          if (t !== T0) drawTile(t, Math.round(c * TILE - s.camX), r * TILE);
        }
      }
      // franja inferior para cubrir el borde del canvas
      ctx!.fillStyle = "#7e4012";
      ctx!.fillRect(0, (GROUND_ROW + 2) * TILE - 1, W, H - (GROUND_ROW + 2) * TILE + 1);
    }

    function drawEnemies() {
      for (const e of s.enemies) {
        const x = Math.round(e.x - s.camX);
        if (x < -20 || x > W + 20) continue;
        if (e.dead) {
          // aplastado
          ctx!.globalAlpha = Math.max(0, e.deadT / 450);
          ctx!.drawImage(sprGoomba, x - 1, e.y + e.h - 5, 16, 5);
          ctx!.globalAlpha = 1;
          continue;
        }
        const flip = Math.floor(s.t / 160) % 2 === 0;
        ctx!.save();
        ctx!.translate(x + e.w / 2, Math.round(e.y));
        if (flip) ctx!.scale(-1, 1);
        ctx!.drawImage(sprGoomba, -8, 0, 16, 12);
        ctx!.restore();
      }
    }

    function drawPlayer() {
      const p = s.player;
      const ph = phaseRef.current;
      let spr = sprIdle;
      if (ph === "dying") {
        spr = sprJump;
      } else if (!p.onGround) {
        spr = sprJump;
      } else if (Math.abs(p.vx) > 0.3 || ph === "win") {
        spr = Math.floor(s.walkT / 110) % 2 === 0 ? sprWalk : sprIdle;
      }
      const x = Math.round(p.x - s.camX + p.w / 2);
      const y = Math.round(p.y + p.h - SPRITE_H);
      ctx!.save();
      ctx!.translate(x, y + SPRITE_H / 2);
      if (p.face < 0) ctx!.scale(-1, 1);
      if (ph === "dying") ctx!.rotate(Math.PI);
      ctx!.drawImage(spr, -SPRITE_W / 2, -SPRITE_H / 2, SPRITE_W, SPRITE_H);
      ctx!.restore();
    }

    function drawParticles() {
      for (const pop of s.pops) {
        ctx!.globalAlpha = Math.max(0, pop.t);
        ctx!.fillStyle = "#ffd23f";
        const x = pop.x - s.camX;
        ctx!.beginPath();
        ctx!.ellipse(x, pop.y, 4, 5.5, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.globalAlpha = 1;
      }
      for (const f of s.fireworks) {
        ctx!.globalAlpha = Math.max(0, f.t);
        ctx!.fillStyle = f.col;
        ctx!.fillRect(f.x - s.camX - 1, f.y - 1, 3, 3);
        ctx!.globalAlpha = 1;
      }
    }

    function draw() {
      drawSky();
      drawMountains();
      drawClouds();
      drawHills();
      drawBushes();
      drawCasa();
      drawMap();
      drawEnemies();
      drawPlayer();
      drawParticles();
    }

    let raf = 0;
    let last = performance.now();
    function loop(now: number) {
      const dt = now - last;
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    // ----- teclado (desktop) -----
    const onKeyDown = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", " ", "a", "d", "w"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.left = true;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.right = true;
      if (e.key === "ArrowUp" || e.key === " " || e.key === "w") inputRef.current.jump = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") inputRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d") inputRef.current.right = false;
      if (e.key === "ArrowUp" || e.key === " " || e.key === "w") inputRef.current.jump = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onVisibility = () => {
      if (!document.hidden) last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      stopMusic();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      actx?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = () => apiRef.current?.startGame();

  // controles táctiles
  const press = (key: "left" | "right" | "jump", down: boolean) => (e: React.PointerEvent) => {
    e.preventDefault();
    inputRef.current[key] = down;
  };

  const playing = phase === "playing" || phase === "dying" || phase === "win";

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} width={W} height={H} className={styles.canvas} />

      {playing && (
        <>
          <div className={styles.hud}>
            <div className={styles.scoreBox}>
              PUNTOS
              <br />
              <span>{score}</span>
            </div>
            <div className={styles.scoreBox}>
              MONEDAS
              <br />
              <span>{coins}</span>
            </div>
            <div className={styles.scoreBox}>
              VIDAS
              <br />
              <span>
                {Array.from({ length: MAX_LIVES }, (_, i) => (
                  <span key={i} className={i < lives ? styles.lifeOk : styles.lifeLost}>
                    ♥
                  </span>
                ))}
              </span>
            </div>
            <div className={styles.scoreBox}>
              MÁXIMO
              <br />
              <span>{best}</span>
            </div>
          </div>

          <div className={styles.worldTag}>MUNDO 1-1</div>

          <div className={styles.touchControls}>
            <div className={styles.padLeft}>
              <button
                className={styles.padBtn}
                onPointerDown={press("left", true)}
                onPointerUp={press("left", false)}
                onPointerLeave={press("left", false)}
                onPointerCancel={press("left", false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                ◀
              </button>
              <button
                className={styles.padBtn}
                onPointerDown={press("right", true)}
                onPointerUp={press("right", false)}
                onPointerLeave={press("right", false)}
                onPointerCancel={press("right", false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                ▶
              </button>
            </div>
            <button
              className={styles.jumpBtn}
              onPointerDown={press("jump", true)}
              onPointerUp={press("jump", false)}
              onPointerLeave={press("jump", false)}
              onPointerCancel={press("jump", false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              A
            </button>
          </div>

          <p className={styles.creditInGame}>
            By{" "}
            <a
              href="https://www.instagram.com/cristhian_lunaa"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cristhian Luna
            </a>{" "}
            - Team Cauca
          </p>
        </>
      )}

      {phase === "dying" && (
        <div className={styles.banner}>
          <p className={styles.bannerBad}>¡TE ATRAPARON!</p>
        </div>
      )}

      {phase === "menu" && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h1 className={styles.title}>
              CEPEDA
              <br />
              BROS
            </h1>
            <p className={styles.subtitle}>RUMBO A LA CASA DE NARIÑO</p>
            <div className={styles.scoresRow}>
              <div className={styles.scoreItem}>
                MÁXIMO<b>{best}</b>
              </div>
            </div>
            <button className={styles.btn} onClick={handleStart}>
              ▶ EMPEZAR
            </button>
            <p className={styles.hint}>
              MUÉVETE CON ◀ ▶ Y SALTA CON A
              <br />
              EN PC: FLECHAS + ESPACIO
              <br />
              LLEGA A LA CASA DE NARIÑO
            </p>
          </div>
          <p className={styles.credit}>
            By{" "}
            <a
              href="https://www.instagram.com/cristhian_lunaa"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cristhian Luna
            </a>{" "}
            - Team Cauca
          </p>
        </div>
      )}

      {winVisible && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h1 className={styles.titleWin}>¡GANASTE!</h1>
            <p className={styles.subtitle}>LLEGASTE A LA CASA DE NARIÑO</p>
            <div className={styles.scoresRow}>
              <div className={styles.scoreItem}>
                PUNTOS<b>{score}</b>
              </div>
              <div className={styles.scoreItem}>
                MÁXIMO<b>{best}</b>
              </div>
            </div>
            <button className={styles.btn} onClick={handleStart}>
              ↺ JUGAR DE NUEVO
            </button>
          </div>
        </div>
      )}

      {gameOverVisible && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <h1 className={styles.titleBad}>GAME OVER</h1>
            <div className={styles.scoresRow}>
              <div className={styles.scoreItem}>
                PUNTOS<b>{score}</b>
              </div>
              <div className={styles.scoreItem}>
                MÁXIMO<b>{best}</b>
              </div>
            </div>
            <button className={styles.btn} onClick={handleStart}>
              ↺ REINTENTAR
            </button>
          </div>
        </div>
      )}

      <div className={styles.scanlines} />
    </div>
  );
}
