// Slot math engine. Runs in Deno (edge function) and Node (simulation).
// All payouts are returned as multiples of the total bet.

export const MAX_WIN = 5000;

const cryptoRng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
};

function pick(rng, table) {
  // table: array of [value, weight]
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng() * total;
  for (const [v, w] of table) {
    if ((r -= w) < 0) return v;
  }
  return table[table.length - 1][0];
}

export const LINES20 = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],
  [1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],[0,1,1,1,0],[2,1,1,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0],
];

// Evaluate one direction of a line. cells: array of symbol names along the line.
function evalLine(cells, pays, wild) {
  let best = null;
  const candidates = new Set(cells.filter((s) => s !== wild && pays[s]));
  if (cells.every((s) => s === wild)) {
    // all wilds: pay as best symbol
    let top = null;
    for (const s of Object.keys(pays)) if (!top || pays[s][5] > pays[top][5]) top = s;
    candidates.add(top);
  }
  for (const sym of candidates) {
    let n = 0;
    while (n < cells.length && (cells[n] === sym || cells[n] === wild)) n++;
    const p = n >= 3 ? pays[sym][n] || 0 : 0;
    if (p > 0 && (!best || p > best.pay)) best = { sym, count: n, pay: p };
  }
  return best;
}

function lineWins(grid, lines, pays, wild, lineBet, bothWays = false) {
  const wins = [];
  lines.forEach((line, li) => {
    const cells = line.map((row, reel) => grid[reel][row].s);
    const l = evalLine(cells, pays, wild);
    if (l) wins.push({ line: li, dir: 1, sym: l.sym, count: l.count, pay: l.pay * lineBet });
    if (bothWays) {
      const r = evalLine([...cells].reverse(), pays, wild);
      if (r && !(l && l.count === 5)) wins.push({ line: li, dir: -1, sym: r.sym, count: r.count, pay: r.pay * lineBet });
    }
  });
  return wins;
}

const scale = (t, k) => Object.fromEntries(Object.entries(t).map(([s, a]) => [s, a.map((x) => x * k)]));
const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

/* ------------------------------------------------------------------ */
/* 1. WRAPPED RICHES – Egyptian theme, cash collect + free spins       */
/* ------------------------------------------------------------------ */
const WR_PAYS = scale({
  mask: [0,0,0,10,40,200],
  ankh: [0,0,0,8,25,120],
  cat:  [0,0,0,6,20,80],
  A:    [0,0,0,4,10,40],
  K:    [0,0,0,3,8,30],
  Q:    [0,0,0,2,6,20],
  J:    [0,0,0,2,5,15],
}, 2.5);
const WR_COINS = [
  [{ v: 0.5 }, 30], [{ v: 1 }, 28], [{ v: 2 }, 18], [{ v: 3 }, 10],
  [{ v: 5 }, 7], [{ v: 10 }, 4], [{ v: 25, l: 'MINI' }, 1.2], [{ v: 100, l: 'MAJOR' }, 0.25],
];
function wrCell(rng, reel, fs) {
  const t = [
    ['mask', 3], ['ankh', 4], ['cat', 5], ['A', 8], ['K', 9], ['Q', 10], ['J', 11],
    ['coin', fs ? 9 : 3.6],
  ];
  if (reel >= 1 && reel <= 3) t.push(['wild', 2]);
  if (reel % 2 === 0) t.push(['pyramid', fs ? 2.4 : 2.8]);
  if (reel === 4 || (fs && reel >= 2)) t.push(['scarab', fs ? 3 : 2.4]);
  const s = pick(rng, t);
  if (s === 'coin') return { s, ...pick(rng, WR_COINS) };
  return { s };
}
function wrSpin(rng, fs) {
  const grid = [];
  for (let r = 0; r < 5; r++) {
    const col = [];
    for (let y = 0; y < 3; y++) col.push(wrCell(rng, r, fs));
    grid.push(col);
  }
  const wins = lineWins(grid, LINES20, WR_PAYS, 'wild', 1 / 20);
  const cells = grid.flat();
  const coins = cells.filter((c) => c.s === 'coin');
  const scarabs = cells.filter((c) => c.s === 'scarab').length;
  const coinSum = sum(coins, (c) => c.v);
  const collect = scarabs > 0 && coins.length > 0 ? coinSum * scarabs * (fs ? 2 : 1) : 0;
  const pyramids = cells.filter((c) => c.s === 'pyramid').length;
  const scatterPay = pyramids >= 3 ? [0, 0, 0, 2, 5, 20][Math.min(5, pyramids)] : 0;
  const win = sum(wins, (w) => w.pay) + collect + scatterPay;
  return { grid, wins, collect, scarabs, scatterPay, pyramids, win };
}
// ---- Mummy Walk bonus: a mummy roams a 6x5 board eating coins & diamonds, growing as it goes
export const MW_W = 6, MW_H = 5;
const MW_GROW_AT = [0, 0, 3, 7, 12]; // total diamonds needed to reach size 2, 3, 4
const MW_COINS = [
  [{ v: 0.5 }, 30], [{ v: 1 }, 28], [{ v: 2 }, 18], [{ v: 3 }, 10],
  [{ v: 5 }, 7], [{ v: 10 }, 4], [{ v: 25, l: 'MINI' }, 1], [{ v: 100, l: 'MAJOR' }, 0.15],
];
const MW = { coin: 0.078, diamond: 0.035, ankh: 0.008, startMoves: 8 };
export function mummyWalk(rng = cryptoRng) {
  const board = Array.from({ length: MW_W }, () => Array(MW_H).fill(null)); // board[x][y]
  let size = 1, diamonds = 0, total = 0, moves = MW.startMoves;
  let x = Math.floor(rng() * MW_W), y = Math.floor(rng() * MW_H);
  const start = { x, y };
  const under = (px, py, sz, f) => { for (let i = px; i < px + sz; i++) for (let j = py; j < py + sz; j++) f(i, j); };
  const frames = [];
  const eat = (px, py, sz, out) => under(px, py, sz, (i, j) => {
    const it = board[i][j];
    if (!it) return;
    board[i][j] = null;
    out.push({ x: i, y: j, ...it });
    if (it.t === 'coin') total += it.v;
    else if (it.t === 'diamond') diamonds++;
    else if (it.t === 'ankh') moves += 2;
  });
  // seed the board
  for (let i = 0; i < MW_W; i++) for (let j = 0; j < MW_H; j++) {
    if (i === x && j === y) continue;
    if (rng() < 0.22) board[i][j] = { t: 'coin', ...pick(rng, MW_COINS) };
  }
  const initial = board.map((c) => c.map((it) => it && { ...it }));
  while (moves > 0 && frames.length < 60) {
    moves--;
    // 1. new items drop on empty cells
    const drops = [];
    for (let i = 0; i < MW_W; i++) for (let j = 0; j < MW_H; j++) {
      if (board[i][j] || (i >= x && i < x + size && j >= y && j < y + size)) continue;
      const r = rng();
      let it = null;
      if (r < MW.coin) it = { t: 'coin', ...pick(rng, MW_COINS) };
      else if (r < MW.coin + MW.diamond) it = { t: 'diamond' };
      else if (r < MW.coin + MW.diamond + MW.ankh) it = { t: 'ankh' };
      if (it) { board[i][j] = it; drops.push({ x: i, y: j, ...it }); }
    }
    // 2. pick the best spot within 2 steps
    let best = null;
    for (let nx = x - 2; nx <= x + 2; nx++) for (let ny = y - 2; ny <= y + 2; ny++) {
      if (nx < 0 || ny < 0 || nx > MW_W - size || ny > MW_H - size) continue;
      let sc = rng() * 0.3;
      under(nx, ny, size, (i, j) => {
        const it = board[i][j];
        if (!it) return;
        sc += it.t === 'coin' ? Math.min(it.v, 12) : it.t === 'diamond' ? (size < 4 ? 4 : 1) : 3;
      });
      if (!best || sc > best.sc) best = { nx, ny, sc };
    }
    // 3. walk there one step at a time, eating along the way
    const path = [];
    const collected = [];
    while (x !== best.nx || y !== best.ny) {
      x += Math.sign(best.nx - x); y += Math.sign(best.ny - y);
      path.push({ x, y });
      eat(x, y, size, collected);
    }
    // 4. grow
    let grew = 0;
    while (size < 4 && diamonds >= MW_GROW_AT[size + 1]) {
      size++; grew++; moves += 1;
      x = Math.min(x, MW_W - size); y = Math.min(y, MW_H - size);
      eat(x, y, size, collected);
    }
    frames.push({ drops, path, x, y, size, collected, grew, moves, total, diamonds });
  }
  return { start, initial, frames, total };
}

export function wrappedRiches(rng = cryptoRng) {
  const base = wrSpin(rng, false);
  const spins = [base];
  let walk = null;
  if (base.pyramids >= 3) walk = mummyWalk(rng);
  return { spins, walk, total: base.win + (walk ? walk.total : 0) };
}

/* ------------------------------------------------------------------ */
/* 2. SUGAR STORM – 6x5 scatter pays, tumbles, multiplier bombs        */
/* ------------------------------------------------------------------ */
const SS_PAYS = scale({
  cake:  [10, 25, 50],
  donut: [2.5, 10, 25],
  candy: [2, 5, 15],
  choco: [1.5, 2, 12],
  grape: [1, 1.5, 10],
  melon: [0.8, 1.2, 8],
  peach: [0.5, 1, 5],
  apple: [0.25, 0.75, 2],
}, 0.88);
const SS_BOMBS = [[2, 40], [3, 25], [5, 15], [10, 10], [25, 5], [50, 2], [100, 0.5]];
function ssCell(rng, fs) {
  const t = [
    ['cake', 2.2], ['donut', 3.6], ['candy', 4.4], ['choco', 5.2],
    ['grape', 6.6], ['melon', 7.4], ['peach', 8.6], ['apple', 9.6],
    ['lolly', fs ? 0.85 : 0.95],
  ];
  if (fs) t.push(['bomb', 1.3]);
  const s = pick(rng, t);
  if (s === 'bomb') return { s, m: pick(rng, SS_BOMBS) };
  return { s };
}
function ssPayFor(sym, n) {
  const p = SS_PAYS[sym];
  if (n >= 12) return p[2];
  if (n >= 10) return p[1];
  if (n >= 8) return p[0];
  return 0;
}
function ssSequence(rng, fs) {
  // grid[col][row], row 0 = top
  let grid = Array.from({ length: 6 }, () => Array.from({ length: 5 }, () => ssCell(rng, fs)));
  const steps = [];
  let tumbleWin = 0;
  for (let guard = 0; guard < 40; guard++) {
    const counts = {};
    grid.flat().forEach((c) => { if (SS_PAYS[c.s]) counts[c.s] = (counts[c.s] || 0) + 1; });
    const wins = [];
    for (const [sym, n] of Object.entries(counts)) {
      const pay = ssPayFor(sym, n);
      if (pay > 0) wins.push({ sym, count: n, pay });
    }
    const stepWin = sum(wins, (w) => w.pay);
    steps.push({ grid: grid.map((c) => c.map((x) => ({ ...x }))), wins, win: stepWin });
    if (!wins.length) break;
    tumbleWin += stepWin;
    const winSyms = new Set(wins.map((w) => w.sym));
    grid = grid.map((col) => {
      const kept = col.filter((c) => !winSyms.has(c.s));
      const fresh = Array.from({ length: 5 - kept.length }, () => ssCell(rng, fs));
      return [...fresh, ...kept];
    });
  }
  const final = grid.flat();
  const lollies = final.filter((c) => c.s === 'lolly').length;
  const bombSum = sum(final.filter((c) => c.s === 'bomb'), (c) => c.m);
  const multiplied = fs && tumbleWin > 0 && bombSum > 0 ? tumbleWin * bombSum : tumbleWin;
  const scatterPay = lollies >= 6 ? 100 : lollies === 5 ? 5 : lollies === 4 ? 3 : 0;
  return { steps, lollies, bombSum: fs ? bombSum : 0, tumbleWin, win: multiplied + scatterPay, scatterPay };
}
export function sugarStorm(rng = cryptoRng) {
  const spins = [ssSequence(rng, false)];
  let fsLeft = 0, fsAwarded = 0;
  if (spins[0].lollies >= 4) fsLeft = fsAwarded = 10;
  while (fsLeft > 0 && spins.length < 60) {
    fsLeft--;
    const s = ssSequence(rng, true);
    if (s.lollies >= 3) { fsLeft += 5; fsAwarded += 5; s.retrigger = 5; }
    spins.push(s);
  }
  return { spins, fsAwarded, total: sum(spins, (s) => s.win) };
}

/* ------------------------------------------------------------------ */
/* 3. PRISM POP – 10 lines both ways, expanding wild respins           */
/* ------------------------------------------------------------------ */
const PP_PAYS = scale({
  bar:    [0,0,0,50,200,250],
  seven:  [0,0,0,25,60,120],
  yellow: [0,0,0,10,25,50],
  green:  [0,0,0,8,20,40],
  orange: [0,0,0,7,15,30],
  blue:   [0,0,0,5,10,14],
  purple: [0,0,0,5,10,14],
}, 0.72);
function ppCell(rng, reel, first = false) {
  const t = [
    ['bar', 1.3], ['seven', 2.2], ['yellow', 4.5], ['green', 5], ['orange', 5.5], ['blue', 7], ['purple', 7],
  ];
  if (reel >= 1 && reel <= 3) t.push(['star', 0.4]);
  if (reel % 2 === 0 && first) t.push(['prism', PP_PRISM]);
  return { s: pick(rng, t) };
}
const PP_PRISM = 1.4;
const PP_JACKPOTS = [['MINI', 10, 60], ['MINOR', 25, 28], ['MAJOR', 100, 10], ['GRAND', 500, 2]];
export function crystalPicks(rng = cryptoRng) {
  const win = pick(rng, PP_JACKPOTS.map((j) => [j, j[2]]));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const pool = [win[0], win[0]];
  for (const j of PP_JACKPOTS) if (j !== win) { const n = Math.floor(rng() * 3); for (let i = 0; i < n; i++) pool.push(j[0]); }
  const sequence = [...shuffle(pool), win[0]];
  const counts = {}; sequence.forEach((k) => (counts[k] = (counts[k] || 0) + 1));
  const rest = [];
  while (sequence.length + rest.length < 12) {
    const opts = PP_JACKPOTS.filter((j) => j !== win && (counts[j[0]] || 0) < 2).map((j) => j[0]);
    const k = opts.length ? opts[Math.floor(rng() * opts.length)] : win[0];
    counts[k] = (counts[k] || 0) + 1; rest.push(k);
  }
  return { jackpot: win[0], value: win[1], sequence, rest: shuffle(rest), total: win[1] };
}
export function prismPop(rng = cryptoRng) {
  const held = [false, false, false, false, false];
  const spins = [];
  let grid = null;
  for (let i = 0; i < 4; i++) {
    const next = [];
    for (let r = 0; r < 5; r++) {
      if (held[r]) next.push(grid[r]);
      else next.push([0, 1, 2].map(() => ppCell(rng, r, i === 0)));
    }
    grid = next;
    let newWild = false;
    const expanded = [];
    for (let r = 1; r <= 3; r++) {
      if (!held[r] && grid[r].some((c) => c.s === 'star')) {
        held[r] = true; newWild = true; expanded.push(r);
        grid[r] = [{ s: 'star', x: 1 }, { s: 'star', x: 1 }, { s: 'star', x: 1 }];
      }
    }
    const wins = lineWins(grid, LINES20.slice(0, 10), PP_PAYS, 'star', 1 / 10, true);
    const win = sum(wins, (w) => w.pay);
    spins.push({ grid: grid.map((c) => c.map((x) => ({ ...x }))), wins, expanded, win });
    if (!newWild) break; // a new expanding wild earns a respin
  }
  const prisms = spins[0].grid.flat().filter((c) => c.s === 'prism').length;
  const picks = prisms >= 3 ? crystalPicks(rng) : null;
  return { spins, prisms, picks, total: sum(spins, (s) => s.win) + (picks ? picks.total : 0) };
}

/* ------------------------------------------------------------------ */
/* 4. THUNDER VAULT – hold & spin with jackpots                        */
/* ------------------------------------------------------------------ */
const TV_PAYS = scale({
  eagle:   [0,0,0,12,50,250],
  horse:   [0,0,0,8,30,120],
  trident: [0,0,0,6,20,80],
  A:       [0,0,0,4,10,40],
  K:       [0,0,0,3,8,25],
  Q:       [0,0,0,2,6,20],
  J:       [0,0,0,2,5,15],
}, 4);
const TV_ORBS = [
  [{ v: 1 }, 30], [{ v: 2 }, 25], [{ v: 3 }, 15], [{ v: 5 }, 10], [{ v: 8 }, 6], [{ v: 10 }, 4],
  [{ v: 20, l: 'MINI' }, 2], [{ v: 50, l: 'MINOR' }, 0.6], [{ v: 250, l: 'MAJOR' }, 0.08],
];
const TV_GRAND = 1000;
function tvCell(rng, reel) {
  const t = [
    ['eagle', 2.5], ['horse', 3.5], ['trident', 4.5], ['A', 8], ['K', 9], ['Q', 10], ['J', 11], ['orb', 7],
  ];
  if (reel >= 1 && reel <= 3) t.push(['wild', 2]);
  const s = pick(rng, t);
  if (s === 'orb') return { s, ...pick(rng, TV_ORBS) };
  return { s };
}
export function thunderVault(rng = cryptoRng) {
  const grid = [];
  for (let r = 0; r < 5; r++) grid.push([0, 1, 2].map(() => tvCell(rng, r)));
  const wins = lineWins(grid, LINES20, TV_PAYS, 'wild', 1 / 20);
  const base = { grid, wins, win: sum(wins, (w) => w.pay) };
  const orbCount = grid.flat().filter((c) => c.s === 'orb').length;
  let hold = null;
  if (orbCount >= 6) {
    // board[reel][row] = orb or null
    let board = grid.map((col) => col.map((c) => (c.s === 'orb' ? { ...c } : null)));
    const frames = [{ board: board.map((c) => c.slice()), left: 3 }];
    let left = 3;
    while (left > 0) {
      left--;
      let landed = false;
      board = board.map((col) => col.map((c) => {
        if (c) return c;
        if (rng() < 0.085) { landed = true; return { s: 'orb', ...pick(rng, TV_ORBS), fresh: true }; }
        return null;
      }));
      if (landed) left = 3;
      const full = board.flat().every(Boolean);
      frames.push({ board: board.map((col) => col.map((c) => c && { ...c })), left: full ? 0 : left });
      board = board.map((col) => col.map((c) => c && { s: c.s, v: c.v, l: c.l }));
      if (full) break;
    }
    const orbs = board.flat().filter(Boolean);
    const full = orbs.length === 15;
    const total = sum(orbs, (o) => o.v) + (full ? TV_GRAND : 0);
    hold = { frames, grand: full, win: total };
  }
  return { base, hold, total: base.win + (hold ? hold.win : 0) };
}

export const GAMES = {
  'wrapped-riches': wrappedRiches,
  'sugar-storm': sugarStorm,
  'prism-pop': prismPop,
  'thunder-vault': thunderVault,
};

export function play(gameId, rng = cryptoRng) {
  const fn = GAMES[gameId];
  if (!fn) throw new Error('unknown game');
  const r = fn(rng);
  r.total = Math.min(r.total, MAX_WIN);
  return r;
}

/* ------------------------------------------------------------------ */
/* Bonus buy: pay a fixed multiple of the bet for a spin that is       */
/* guaranteed to trigger the feature. Rejection sampling keeps the     */
/* feature's distribution identical to a naturally triggered one.      */
/* ------------------------------------------------------------------ */
export const HAS_FEATURE = {
  'wrapped-riches': (r) => !!r.walk,
  'sugar-storm': (r) => r.fsAwarded > 0,
  'prism-pop': (r) => !!r.picks,
  'thunder-vault': (r) => !!r.hold,
};
// Price in multiples of bet. Set from sim/buy.mjs so a bought bonus returns ~95-96%.
export const BUY_PRICE = { 'wrapped-riches': 49, 'sugar-storm': 52, 'prism-pop': 34, 'thunder-vault': 70 };
export function buyFeature(gameId, rng = cryptoRng) {
  const fn = GAMES[gameId], has = HAS_FEATURE[gameId];
  for (let i = 0; i < 50000; i++) {
    const r = fn(rng);
    if (has(r)) { r.total = Math.min(r.total, MAX_WIN); r.bought = true; return r; }
  }
  throw new Error('feature_not_found');
}
