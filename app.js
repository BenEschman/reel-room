import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { GAMES, LINES20 } from './games.js';

const SUPABASE_URL = 'https://fnndsroudkrwrgnjgekr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_g2mVr3w9WTpd5UrqsUrCIw_hDL6NOPO';
const EMAIL_DOMAIN = '@players.example.com';
const BETS = [10, 20, 50, 100, 250, 500, 1000];

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.floor(n).toLocaleString('en-US');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

const state = {
  profile: null,
  balance: 0,
  game: null,
  betIdx: store.get('betIdx', 3),
  busy: false,
  turbo: store.get('turbo', false),
  sound: store.get('sound', true),
  autoLeft: 0,
  cells: [],
};

/* ---------------- sound ---------------- */
let actx = null;
function beep(freq = 440, dur = 0.06, type = 'square', vol = 0.04) {
  if (!state.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch { /* no audio */ }
}
const sfx = {
  stop: () => beep(180, 0.05, 'triangle', 0.06),
  win: () => [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.05), i * 90)),
  big: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'square', 0.04), i * 110)),
  tick: () => beep(900, 0.03, 'sine', 0.03),
  feature: () => [392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sawtooth', 0.03), i * 120)),
};

/* ---------------- ui helpers ---------------- */
function toast(msg, ms = 2600) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), ms);
}
function modal(html) { $('modal-body').innerHTML = html; $('modal').classList.remove('hidden'); }
$('modal-x').onclick = () => $('modal').classList.add('hidden');
$('modal').onclick = (e) => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); };

function setBalance(n, animate = false) {
  const el = $('balance');
  const from = state.balance;
  state.balance = n;
  if (!animate || n <= from) { el.textContent = fmt(n); return; }
  const t0 = performance.now(), d = 600;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / d);
    el.textContent = fmt(from + (n - from) * k);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const bet = () => BETS[state.betIdx];
function renderBet() { $('bet').textContent = fmt(bet()); }

/* ---------------- auth ---------------- */
let signupMode = false;
$('auth-toggle').onclick = () => {
  signupMode = !signupMode;
  $('auth-submit').textContent = signupMode ? 'Create account' : 'Sign in';
  $('auth-toggle').textContent = signupMode ? 'Have an account? Sign in' : 'New here? Create an account';
  $('password').autocomplete = signupMode ? 'new-password' : 'current-password';
  $('auth-error').textContent = '';
};
$('auth-form').onsubmit = async (e) => {
  e.preventDefault();
  const username = $('username').value.trim();
  const password = $('password').value;
  $('auth-error').textContent = '';
  $('auth-submit').disabled = true;
  try {
    if (signupMode) {
      const { data, error } = await sb.functions.invoke('signup', { body: { username, password } });
      if (error) throw new Error(await fnError(error));
      if (data?.error) throw new Error(data.error);
    }
    const { error } = await sb.auth.signInWithPassword({ email: username.toLowerCase() + EMAIL_DOMAIN, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong username or password' : error.message);
  } catch (err) {
    $('auth-error').textContent = err.message;
  } finally {
    $('auth-submit').disabled = false;
  }
};
async function fnError(error) {
  try { const j = await error.context.json(); return j.error || error.message; } catch { return error.message; }
}
$('signout-btn').onclick = async () => { await sb.auth.signOut(); };

sb.auth.onAuthStateChange((_evt, session) => {
  if (session) enterApp(); else showAuth();
});
function showAuth() {
  state.profile = null;
  $('app').classList.add('hidden');
  $('auth').classList.remove('hidden');
}
let entered = false;
async function enterApp() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return showAuth();
  const { data: p, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (error || !p) { toast('Could not load profile'); return; }
  state.profile = p;
  setBalance(p.balance);
  $('hello-name').textContent = p.username;
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  updateBonus();
  $('admin-btn').classList.toggle('hidden', !p.is_admin);
  if (!entered) { entered = true; route(); }
}

/* ---------------- bonus ---------------- */
let bonusTimer = null;
function updateBonus() {
  clearInterval(bonusTimer);
  const btn = $('bonus-btn');
  const tick = () => {
    const last = state.profile?.last_bonus_at ? new Date(state.profile.last_bonus_at).getTime() : 0;
    const left = last + 4 * 3600e3 - Date.now();
    if (left <= 0) { btn.textContent = '+5,000 free'; btn.disabled = false; btn.classList.add('pulse'); return; }
    btn.classList.remove('pulse'); btn.disabled = true;
    const h = Math.floor(left / 3600e3), m = Math.floor((left % 3600e3) / 60e3), s = Math.floor((left % 60e3) / 1e3);
    btn.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  tick(); bonusTimer = setInterval(tick, 1000);
}
$('bonus-btn').onclick = async () => {
  const { data, error } = await sb.rpc('claim_bonus');
  if (error) return toast('Could not claim bonus');
  if (data.ok) { sfx.win(); toast('+5,000 coins!'); }
  state.profile.last_bonus_at = new Date(new Date(data.next_at).getTime() - 4 * 3600e3).toISOString();
  setBalance(data.balance, true);
  updateBonus();
};

/* ---------------- admin: add coins ---------------- */
$('admin-btn').onclick = () => {
  modal(`<h3>Add coins</h3>
    <form id="admin-form" class="admin-form">
      <label>Player<input id="admin-user" value="${esc(state.profile.username)}" required /></label>
      <label>Amount<input id="admin-amt" type="number" step="1" value="100000" required /></label>
      <div class="quick">${[10000, 100000, 1000000, 10000000].map((v) => `<button type="button" class="btn small ghost" data-v="${v}">+${fmt(v)}</button>`).join('')}</div>
      <button class="btn gold" type="submit">Add coins</button>
      <p class="fine">Use a negative amount to take coins away. Every grant is logged.</p>
      <p id="admin-msg" class="error"></p>
    </form>`);
  document.querySelectorAll('.quick [data-v]').forEach((b) => (b.onclick = () => ($('admin-amt').value = b.dataset.v)));
  $('admin-form').onsubmit = async (e) => {
    e.preventDefault();
    const user = $('admin-user').value.trim();
    const amt = parseInt($('admin-amt').value, 10);
    const { data, error } = await sb.rpc('admin_add_coins', { p_username: user, p_amount: amt });
    if (error) {
      $('admin-msg').textContent = /no_such_player/.test(error.message) ? 'No player with that name' : /not_admin/.test(error.message) ? 'Admins only' : 'Could not add coins';
      return;
    }
    if (user.toLowerCase() === state.profile.username.toLowerCase()) { setBalance(data, true); state.profile.balance = data; }
    $('modal').classList.add('hidden');
    toast(`${amt > 0 ? '+' : ''}${fmt(amt)} coins → ${user} (now ${fmt(data)})`);
  };
};

/* ---------------- leaderboard ---------------- */
$('board-btn').onclick = async () => {
  modal('<h3>Leaderboard</h3><p class="fine">Loading…</p>');
  const { data, error } = await sb.from('profiles').select('username,balance,biggest_win,spins_count').order('balance', { ascending: false }).limit(25);
  if (error) return modal('<h3>Leaderboard</h3><p>Could not load.</p>');
  const rows = data.map((p, i) => `<tr class="${p.username === state.profile.username ? 'me' : ''}"><td>${i + 1}</td><td>${esc(p.username)}</td><td>${fmt(p.balance)}</td><td>${fmt(p.biggest_win)}</td><td>${fmt(p.spins_count)}</td></tr>`).join('');
  modal(`<h3>Leaderboard</h3><table class="board"><thead><tr><th>#</th><th>Player</th><th>Coins</th><th>Best win</th><th>Spins</th></tr></thead><tbody>${rows}</tbody></table>`);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- routing ---------------- */
function route() {
  const id = location.hash.replace('#', '');
  if (GAMES[id]) openGame(id); else openLobby();
}
window.addEventListener('hashchange', () => { if (!state.busy) route(); });
$('home-btn').onclick = () => { if (!state.busy) location.hash = ''; };
$('back-btn').onclick = () => { if (!state.busy) location.hash = ''; };

function openLobby() {
  state.game = null; state.autoLeft = 0;
  document.body.className = '';
  $('game').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  $('game-list').innerHTML = Object.entries(GAMES).map(([id, g]) => `
    <a class="game-card theme-${id}" href="#${id}">
      <div class="gc-art">${g.cover}</div>
      <div class="gc-body"><h3>${g.name}</h3><p>${g.blurb}</p><div class="chips">${g.tags.map((t) => `<span>${t}</span>`).join('')}</div></div>
    </a>`).join('');
}

function openGame(id) {
  const g = GAMES[id];
  state.game = id;
  document.body.className = 'theme-' + id;
  $('lobby').classList.add('hidden');
  $('game').classList.remove('hidden');
  $('game-title').textContent = g.name;
  $('feature-bar').textContent = g.tagline;
  $('bonus').classList.add('hidden'); $('reels').classList.remove('hidden');
  buildReels(g.cols, g.rows);
  const start = Array.from({ length: g.cols }, (_, c) => Array.from({ length: g.rows }, () => g.randomCell(c)));
  setGrid(start);
  setWin(0, 'WIN');
  hideOverlay();
}

/* ---------------- reels ---------------- */
function buildReels(cols, rows) {
  const el = $('reels');
  el.style.setProperty('--cols', cols);
  el.style.setProperty('--rows', rows);
  el.innerHTML = '';
  state.cells = [];
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'col';
    state.cells.push([]);
    for (let r = 0; r < rows; r++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      col.appendChild(cell);
      state.cells[c].push(cell);
    }
    el.appendChild(col);
  }
}
function setCell(c, r, data, extra = '') {
  const g = GAMES[state.game];
  const el = state.cells[c][r];
  el.className = 'cell ' + extra;
  el.innerHTML = data ? g.renderCell(data, bet()) : '<div class="sym empty"></div>';
}
function setGrid(grid) {
  grid.forEach((col, c) => col.forEach((cell, r) => setCell(c, r, cell)));
}
function speed(ms) { return state.turbo ? ms * 0.4 : ms; }

// Animate reels: columns blur through random symbols, stopping left to right.
async function spinTo(grid, { only = null, anticipation = null, rand = null, quick = false } = {}) {
  const g = GAMES[state.game];
  const cols = grid.length, rows = grid[0].length;
  const animating = (c, r) => !only || only(c, r);
  const stopAt = [];
  let t = speed(quick ? 260 : 420);
  for (let c = 0; c < cols; c++) {
    if (anticipation && anticipation(c)) t += speed(700);
    stopAt.push(t);
    t += speed(quick ? 70 : 130);
  }
  const t0 = performance.now();
  return new Promise((resolve) => {
    const stopped = new Array(cols).fill(false);
    const iv = setInterval(() => {
      const el = performance.now() - t0;
      let all = true;
      for (let c = 0; c < cols; c++) {
        if (stopped[c]) continue;
        if (el >= stopAt[c]) {
          stopped[c] = true;
          let any = false;
          for (let r = 0; r < rows; r++) if (animating(c, r)) { setCell(c, r, grid[c][r], 'land'); any = true; }
          if (any) sfx.stop();
          if (anticipation && anticipation(c + 1) && c + 1 < cols) state.cells[c + 1].forEach((x) => x.classList.add('tease'));
        } else {
          all = false;
          for (let r = 0; r < rows; r++) if (animating(c, r)) setCell(c, r, rand ? rand(c) : g.randomCell(c), 'blur');
        }
      }
      if (all) { clearInterval(iv); resolve(); }
    }, 60);
  });
}

function highlight(cells) {
  clearHighlight();
  cells.forEach(([c, r]) => state.cells[c]?.[r]?.classList.add('hit'));
  $('reels').classList.add('dim');
}
function clearHighlight() {
  $('reels').classList.remove('dim');
  state.cells.flat().forEach((x) => x.classList.remove('hit'));
}
function lineCells(w, lines = LINES20) {
  const line = lines[w.line];
  const out = [];
  for (let i = 0; i < w.count; i++) {
    const reel = w.dir === -1 ? 4 - i : i;
    out.push([reel, line[reel]]);
  }
  return out;
}
async function showLineWins(wins) {
  if (!wins.length) return;
  const all = wins.flatMap((w) => lineCells(w));
  highlight(all);
  await sleep(speed(900));
  if (wins.length > 1 && !state.turbo) {
    for (const w of wins.slice(0, 6)) {
      highlight(lineCells(w));
      setWinNote(`${w.count}× ${GAMES[state.game].symName(w.sym)} pays ${fmt(w.pay * bet())}`);
      await sleep(550);
    }
  }
  setWinNote('');
  clearHighlight();
}

function setWin(n, label = 'WIN') {
  $('win-label').textContent = label;
  $('win-amount').textContent = fmt(n);
  $('win-amount').classList.toggle('on', n > 0);
}
function setWinNote(t) { $('feature-bar').textContent = t || (state.game ? GAMES[state.game].tagline : ''); }

async function showOverlay(html, ms = 1600, cls = '') {
  const o = $('overlay');
  o.className = 'overlay ' + cls;
  o.innerHTML = html;
  await sleep(speed(ms));
}
function hideOverlay() { $('overlay').className = 'overlay hidden'; }

async function bigWinCheck(total) {
  const x = total / bet();
  if (x >= 50) { sfx.big(); await showOverlay(`<div class="bw"><small>${x >= 250 ? 'EPIC' : x >= 100 ? 'MEGA' : 'BIG'} WIN</small><b>${fmt(total)}</b></div>`, 2400, 'big'); hideOverlay(); }
  else if (total > 0) sfx.win();
}

/* ---------------- spin ---------------- */
const ctx = {
  sleep, speed, spinTo, setGrid, setCell, highlight, clearHighlight, showLineWins, lineCells,
  setWin, setWinNote, showOverlay, hideOverlay, sfx, fmt, bet,
  get cells() { return state.cells; },
  get auto() { return state.autoLeft > 0; },
  get turbo() { return state.turbo; },
  bonusEl: $('bonus'),
  showBonus(html) { $('reels').classList.add('hidden'); const b = $('bonus'); b.innerHTML = html; b.classList.remove('hidden'); return b; },
  hideBonus() { $('bonus').classList.add('hidden'); $('bonus').innerHTML = ''; $('reels').classList.remove('hidden'); },
};

async function doSpin() {
  if (state.busy || !state.game) return;
  const b = bet();
  if (state.balance < b) {
    state.autoLeft = 0; renderAuto();
    return toast(state.balance < BETS[0] ? 'Out of coins — grab your free coins up top' : 'Not enough coins for that bet');
  }
  state.busy = true;
  document.body.classList.add('busy');
  const gameId = state.game;
  setWin(0, 'WIN');
  setWinNote('');
  hideOverlay();
  clearHighlight();
  setBalance(state.balance - b);
  // start spinning visually while we wait for the server
  const g = GAMES[gameId];
  let waiting = true;
  const blur = setInterval(() => {
    if (!waiting) return;
    for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) setCell(c, r, g.randomCell(c), 'blur');
  }, 60);
  let res;
  try {
    const { data, error } = await sb.functions.invoke('spin', { body: { game: gameId, bet: b } });
    if (error) throw new Error(await fnError(error));
    res = data;
  } catch (err) {
    waiting = false; clearInterval(blur);
    setBalance(state.balance + b);
    setGrid(Array.from({ length: g.cols }, (_, c) => Array.from({ length: g.rows }, () => g.randomCell(c))));
    toast(err.message === 'insufficient_balance' ? 'Not enough coins' : 'Spin failed — try again');
    state.busy = false; document.body.classList.remove('busy'); state.autoLeft = 0; renderAuto();
    return;
  }
  waiting = false; clearInterval(blur);
  try {
    await g.play(res.result, ctx);
  } catch (e) { console.error(e); }
  setWin(res.payout, res.payout > 0 ? 'TOTAL WIN' : 'WIN');
  await bigWinCheck(res.payout);
  setBalance(res.balance, true);
  state.profile.balance = res.balance;
  state.busy = false;
  document.body.classList.remove('busy');
  if (state.autoLeft > 0 && state.game === gameId) {
    state.autoLeft--; renderAuto();
    if (state.autoLeft > 0) { await sleep(speed(500)); if (state.autoLeft > 0) doSpin(); }
  }
}
$('spin-btn').onclick = () => { if (state.autoLeft) { state.autoLeft = 0; renderAuto(); } else doSpin(); };
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && state.game && $('modal').classList.contains('hidden') && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault(); doSpin();
  }
});
$('bet-down').onclick = () => { if (state.busy) return; state.betIdx = Math.max(0, state.betIdx - 1); store.set('betIdx', state.betIdx); renderBet(); };
$('bet-up').onclick = () => { if (state.busy) return; state.betIdx = Math.min(BETS.length - 1, state.betIdx + 1); store.set('betIdx', state.betIdx); renderBet(); };
function renderAuto() {
  $('auto-btn').textContent = state.autoLeft ? `Stop (${state.autoLeft})` : 'Auto 10';
  $('auto-btn').classList.toggle('on', !!state.autoLeft);
  $('spin-btn').textContent = state.autoLeft ? 'STOP' : 'SPIN';
}
$('auto-btn').onclick = () => {
  if (state.autoLeft) { state.autoLeft = 0; renderAuto(); return; }
  state.autoLeft = 10; renderAuto();
  if (!state.busy) doSpin();
};
function renderToggles() {
  $('turbo-btn').classList.toggle('on', state.turbo);
  $('sound-btn').textContent = state.sound ? '🔊' : '🔇';
}
$('turbo-btn').onclick = () => { state.turbo = !state.turbo; store.set('turbo', state.turbo); renderToggles(); };
$('sound-btn').onclick = () => { state.sound = !state.sound; store.set('sound', state.sound); renderToggles(); };
$('info-btn').onclick = () => modal(GAMES[state.game].rules(bet()));

renderBet(); renderToggles(); renderAuto();
const { data: { session } } = await sb.auth.getSession();
if (!session) showAuth();
