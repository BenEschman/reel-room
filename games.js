// Client-side presentation for each game. All outcomes come from the server.

export const LINES20 = [
  [1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2],
  [0,0,1,2,2],[2,2,1,0,0],[1,0,0,0,1],[1,2,2,2,1],[1,0,1,2,1],
  [1,2,1,0,1],[0,1,0,1,0],[2,1,2,1,2],[0,1,1,1,0],[2,1,1,1,2],
  [1,1,0,1,1],[1,1,2,1,1],[0,2,0,2,0],[2,0,2,0,2],[0,2,2,2,0],
];

const fmtShort = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + 'K';
  return Math.floor(n).toLocaleString('en-US');
};
const pickW = (t) => { let s = 0; for (const [, w] of t) s += w; let r = Math.random() * s; for (const [v, w] of t) if ((r -= w) < 0) return v; return t[0][0]; };
const sym = (cls, inner, label = '') => `<div class="sym ${cls}">${inner}${label ? `<em>${label}</em>` : ''}</div>`;
const letter = (ch, color) => `<div class="sym letter" style="--c:${color}">${ch}</div>`;
const payRow = (icon, pays, b, lineBet) => `<tr><td class="pi">${icon}</td>${pays.map((p) => `<td>${fmtShort(p * b * lineBet)}</td>`).join('')}</tr>`;

/* Original wrapped-mummy wild, drawn here */
const MUMMY_SVG = `<svg viewBox="0 0 64 64" class="svg-sym"><defs><radialGradient id="mg" cx=".5" cy=".4"><stop offset="0" stop-color="#fffbe9"/><stop offset="1" stop-color="#d8c79a"/></radialGradient></defs>
<ellipse cx="32" cy="33" rx="22" ry="25" fill="url(#mg)" stroke="#7a6436" stroke-width="2"/>
<g stroke="#a68f5b" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M12 22 Q32 15 52 24"/><path d="M10 31 Q32 38 54 29"/><path d="M12 42 Q32 36 52 45"/><path d="M16 51 Q32 55 48 50"/></g>
<rect x="15" y="25" width="34" height="9" rx="4" fill="#2a1d0e"/><circle cx="24" cy="29.5" r="3.4" fill="#7dfcff"/><circle cx="40" cy="29.5" r="3.4" fill="#7dfcff"/>
<path d="M24 44 Q32 49 40 44" stroke="#2a1d0e" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>`;
const PYRAMID_SVG = `<svg viewBox="0 0 64 64" class="svg-sym"><defs><linearGradient id="pg" x1="0" x2="1"><stop offset="0" stop-color="#ffe07a"/><stop offset=".5" stop-color="#f5b52e"/><stop offset=".5" stop-color="#c98712"/><stop offset="1" stop-color="#8a5a08"/></linearGradient></defs><path d="M32 6 L60 56 H4 Z" fill="url(#pg)" stroke="#5a3a00" stroke-width="2"/><circle cx="32" cy="34" r="6" fill="#fff" stroke="#5a3a00" stroke-width="2"/><circle cx="32" cy="34" r="2.6" fill="#1a6"/></svg>`;

/* ================================================================== */
const wrappedRiches = {
  name: 'Wrapped Riches',
  blurb: 'Egyptian 5×3, 20 lines. Scarabs collect coins, and 3 pyramids release a mummy that roams the tomb eating coins and growing with every diamond.',
  tags: ['Cash Collect', 'Mummy Walk bonus', 'Growing collector'],
  tagline: 'Scarab on reel 5 collects every coin · 3 pyramids = Mummy Walk bonus',
  cover: `<div class="cover-row">${MUMMY_SVG}<span class="big-emoji">🪲</span></div>`,
  cols: 5, rows: 3,
  symName: (s) => ({ mask: 'Pharaoh', ankh: 'Ankh', cat: 'Cat', wild: 'Mummy' }[s] || s),
  randomCell(c) {
    const t = [['mask', 3], ['ankh', 4], ['cat', 5], ['A', 8], ['K', 9], ['Q', 10], ['J', 11], ['coin', 4]];
    if (c >= 1 && c <= 3) t.push(['wild', 2]);
    if (c % 2 === 0) t.push(['pyramid', 2.5]);
    if (c === 4) t.push(['scarab', 2.5]);
    const s = pickW(t);
    if (s === 'coin') return { s, v: pickW([[0.5, 3], [1, 3], [2, 2], [5, 1]]) };
    return { s };
  },
  renderCell(c, b) {
    switch (c.s) {
      case 'wild': return sym('wild', MUMMY_SVG, 'WILD');
      case 'pyramid': return sym('scatter', PYRAMID_SVG, 'BONUS');
      case 'scarab': return sym('collector', '<span>🪲</span>', 'COLLECT');
      case 'coin': return sym('coin' + (c.l ? ' jp' : ''), `<span class="coin-face">${c.l || fmtShort(c.v * b)}</span>`);
      case 'mask': return sym('hi', '<span>👑</span>');
      case 'ankh': return sym('hi ankh', '<span>☥</span>');
      case 'cat': return sym('hi', '<span>🐈‍⬛</span>');
      default: return letter(c.s, { A: '#ff5a5a', K: '#5ab0ff', Q: '#b47bff', J: '#4fe08a' }[c.s]);
    }
  },
  rules(b) {
    const lb = 1 / 20;
    const P = { mask: [25, 100, 500], ankh: [20, 62.5, 300], cat: [15, 50, 200], A: [10, 25, 100], K: [7.5, 20, 75], Q: [5, 15, 50], J: [5, 12.5, 37.5] };
    const icon = { mask: '👑', ankh: '☥', cat: '🐈‍⬛', A: 'A', K: 'K', Q: 'Q', J: 'J' };
    return `<h3>Wrapped Riches</h3>
    <p><b>Coins</b> land on any reel showing a cash value. When a <b>🪲 Scarab</b> lands on reel 5, it collects the value of every coin on screen. Jackpot coins: MINI = 25× bet, MAJOR = 100× bet.</p>
    <p><b>Mummy</b> is wild on reels 2–4. <b>3 Pyramids</b> (reels 1, 3, 5) pay 2× bet and open the <b>Mummy Walk</b> bonus.</p>
    <p><b>Mummy Walk:</b> a 6×5 tomb fills with coins. Each move, new coins, 💎 diamonds and ☥ ankhs drop in, and the mummy shuffles toward the best loot, eating everything it walks over. Ankhs give <b>+2 moves</b>. Diamonds make it <b>grow</b>: 3 💎 = 2×2, 7 = 3×3, 12 = 4×4 (each growth also gives +1 move). Bigger mummy, bigger bites. You start with 8 moves.</p>
    <table class="pay"><thead><tr><th></th><th>×3</th><th>×4</th><th>×5</th></tr></thead><tbody>${Object.keys(P).map((k) => payRow(icon[k], P[k], b, lb)).join('')}</tbody></table>
    <p class="fine">Pays shown at your current bet. 20 fixed lines, left to right. Max win 5,000× bet. Simulated RTP ≈ 96%.</p>`;
  },
  async play(res, x) {
    const b = x.bet();
    const s = res.spins[0];
    let acc = 0;
    const pyrBefore = (c) => s.grid.slice(0, c).flat().filter((z) => z.s === 'pyramid').length;
    await x.spinTo(s.grid, { anticipation: (c) => c === 4 && pyrBefore(4) >= 2 });
    if (s.wins.length) {
      await x.showLineWins(s.wins);
      acc += s.wins.reduce((a, w) => a + w.pay, 0);
      x.setWin(acc * b);
    }
    if (s.collect > 0) {
      const pos = [];
      s.grid.forEach((col, c) => col.forEach((z, r) => { if (z.s === 'coin' || z.s === 'scarab') pos.push([c, r]); }));
      x.highlight(pos);
      x.sfx.win();
      await x.showOverlay(`<div class="feat collect"><small>SCARAB COLLECT</small><b>${x.fmt(s.collect * b)}</b></div>`, 1500);
      x.hideOverlay(); x.clearHighlight();
      acc += s.collect;
      x.setWin(acc * b);
    }
    if (s.scatterPay > 0) { acc += s.scatterPay; x.setWin(acc * b); }
    if (!res.walk) return;
    const pos = []; s.grid.forEach((col, c) => col.forEach((z, r) => z.s === 'pyramid' && pos.push([c, r])));
    x.highlight(pos); await x.sleep(900); x.clearHighlight();
    x.sfx.feature();
    await x.showOverlay(`<div class="feat"><small>THE TOMB OPENS</small><b>MUMMY WALK</b><small>Eat 💎 to grow bigger</small></div>`, 2200);
    x.hideOverlay();
    await playMummyWalk(res.walk, x, acc);
  },
};

/* ---- Mummy Walk bonus board ---- */
const MW_W = 6, MW_H = 5;
const MW_GROW_AT = [0, 0, 3, 7, 12];
function mwItem(it, b) {
  if (it.t === 'coin') return `<div class="mw-item coin${it.l ? ' jp' : ''}"><span class="coin-face">${it.l || fmtShort(it.v * b)}</span></div>`;
  if (it.t === 'diamond') return `<div class="mw-item dia"><span>💎</span></div>`;
  return `<div class="mw-item ankh"><span>☥</span><em>+2</em></div>`;
}
async function playMummyWalk(walk, x, acc0) {
  const b = x.bet();
  document.body.classList.add('in-feature');
  const el = x.showBonus(`
    <div class="mw-hud">
      <div><small>MOVES</small><b id="mw-moves">8</b></div>
      <div class="mw-meter"><small>💎 <span id="mw-dia">0</span> · <span id="mw-next"></span></small><div class="bar"><i id="mw-fill"></i></div></div>
      <div><small>BONUS</small><b id="mw-win">0</b></div>
    </div>
    <div class="mw-board" id="mw-board">
      ${Array.from({ length: MW_H }, (_, yy) => Array.from({ length: MW_W }, (_, xx) => `<div class="mw-cell" data-x="${xx}" data-y="${yy}"></div>`).join('')).join('')}
      <div class="mw-mummy" id="mw-mummy">${MUMMY_SVG}</div>
      <div class="mw-pop" id="mw-pop"></div>
    </div>`);
  const cell = (cx, cy) => el.querySelector(`.mw-cell[data-x="${cx}"][data-y="${cy}"]`);
  const mummy = el.querySelector('#mw-mummy');
  let size = 1, diamonds = 0, shown = 0;
  const place = (px, py, sz) => {
    mummy.style.left = (px / MW_W) * 100 + '%';
    mummy.style.top = (py / MW_H) * 100 + '%';
    mummy.style.width = (sz / MW_W) * 100 + '%';
    mummy.style.height = (sz / MW_H) * 100 + '%';
    mummy.dataset.size = sz;
  };
  const meter = () => {
    el.querySelector('#mw-dia').textContent = diamonds;
    if (size >= 4) { el.querySelector('#mw-next').textContent = 'MAX SIZE'; el.querySelector('#mw-fill').style.width = '100%'; return; }
    const lo = MW_GROW_AT[size] || 0, hi = MW_GROW_AT[size + 1];
    el.querySelector('#mw-next').textContent = `${hi - diamonds} to grow`;
    el.querySelector('#mw-fill').style.width = ((diamonds - lo) / (hi - lo)) * 100 + '%';
  };
  const winEl = el.querySelector('#mw-win');
  const setBonusWin = (v) => { shown = v; winEl.textContent = x.fmt(v * b); x.setWin((acc0 + v) * b, 'MUMMY WALK'); };
  const popText = (txt, px, py, cls = '') => {
    const p = document.createElement('div');
    p.className = 'mw-float ' + cls; p.textContent = txt;
    p.style.left = ((px + 0.5) / MW_W) * 100 + '%'; p.style.top = ((py + 0.3) / MW_H) * 100 + '%';
    el.querySelector('#mw-board').appendChild(p);
    setTimeout(() => p.remove(), 1100);
  };
  // initial board
  for (let i = 0; i < MW_W; i++) for (let j = 0; j < MW_H; j++) {
    const it = walk.initial[i][j];
    if (it) cell(i, j).innerHTML = mwItem(it, b);
  }
  place(walk.start.x, walk.start.y, 1);
  el.querySelector('#mw-moves').textContent = 8;
  meter();
  await x.sleep(x.speed(900));
  let running = 0;
  for (const f of walk.frames) {
    el.querySelector('#mw-moves').textContent = f.moves + 1;
    // drops
    for (const d of f.drops) { const c = cell(d.x, d.y); c.innerHTML = mwItem(d, b); c.firstElementChild.classList.add('in'); }
    if (f.drops.length) { x.sfx.tick(); await x.sleep(x.speed(450)); }
    el.querySelector('#mw-moves').textContent = f.moves;
    const pending = f.collected.slice();
    const eatAt = (px, py, sz) => {
      for (let k = pending.length - 1; k >= 0; k--) {
        const it = pending[k];
        if (it.x >= px && it.x < px + sz && it.y >= py && it.y < py + sz) {
          pending.splice(k, 1);
          const c = cell(it.x, it.y);
          c.firstElementChild?.classList.add('eaten');
          setTimeout(() => (c.innerHTML = ''), 260);
          if (it.t === 'coin') { running += it.v; popText('+' + (it.l || fmtShort(it.v * b)), it.x, it.y, it.l ? 'jp' : ''); x.sfx.tick(); }
          else if (it.t === 'diamond') { diamonds++; popText('💎', it.x, it.y, 'dia'); x.sfx.stop(); }
          else { popText('+2 MOVES', it.x, it.y, 'ankh'); x.sfx.win(); }
        }
      }
      setBonusWin(running); meter();
    };
    let cx = null, cy = null;
    for (const st of f.path) {
      cx = st.x; cy = st.y;
      place(cx, cy, size);
      mummy.classList.remove('step'); void mummy.offsetWidth; mummy.classList.add('step');
      await x.sleep(x.speed(300));
      eatAt(cx, cy, size);
    }
    if (f.grew) {
      size = f.size;
      x.sfx.feature();
      mummy.classList.add('grow');
      place(f.x, f.y, size);
      await x.showOverlay(`<div class="feat"><small>MUMMY GROWS!</small><b>${size}×${size}</b><small>+1 move</small></div>`, 1300);
      x.hideOverlay();
      mummy.classList.remove('grow');
      eatAt(f.x, f.y, size);
    }
    running = f.total; diamonds = f.diamonds; setBonusWin(running); meter();
    el.querySelector('#mw-moves').textContent = f.moves;
    await x.sleep(x.speed(f.collected.length ? 350 : 200));
  }
  x.sfx.big();
  await x.showOverlay(`<div class="feat"><small>MUMMY WALK COMPLETE</small><b>${x.fmt(walk.total * b)}</b></div>`, 2200);
  x.hideOverlay();
  x.hideBonus();
  document.body.classList.remove('in-feature');
}

/* ================================================================== */
const SS = { cake: '🎂', donut: '🍩', candy: '🍬', choco: '🍫', grape: '🍇', melon: '🍉', peach: '🍑', apple: '🍎' };
const sugarStorm = {
  name: 'Sugar Storm',
  blurb: '6×5 scatter pays. 8+ matching anywhere wins, winners pop and new candy tumbles in. Bombs multiply in free spins.',
  tags: ['Pay Anywhere', 'Tumbles', 'Multiplier Bombs'],
  tagline: '8+ of a kind anywhere wins · 4 lollipops = 10 free spins with bombs',
  cover: `<div class="cover-row"><span class="big-emoji">🍭</span><span class="big-emoji">🍩</span><span class="big-emoji">💣</span></div>`,
  cols: 6, rows: 5,
  symName: (s) => s,
  randomCell() {
    const s = pickW([['cake', 2], ['donut', 3.5], ['candy', 4.5], ['choco', 5], ['grape', 6.5], ['melon', 7.5], ['peach', 8.5], ['apple', 9.5], ['lolly', 1]]);
    return { s };
  },
  renderCell(c) {
    if (c.s === 'lolly') return sym('scatter', '<span>🍭</span>', 'BONUS');
    if (c.s === 'bomb') return sym('bomb', `<span class="bomb-face">×${c.m}</span>`);
    return sym('candy ' + c.s, `<span>${SS[c.s]}</span>`);
  },
  rules(b) {
    const P = { cake: [10, 25, 50], donut: [2.5, 10, 25], candy: [2, 5, 15], choco: [1.5, 2, 12], grape: [1, 1.5, 10], melon: [0.8, 1.2, 8], peach: [0.5, 1, 5], apple: [0.25, 0.75, 2] };
    return `<h3>Sugar Storm</h3>
    <p>Wins pay for <b>8 or more</b> of the same symbol <b>anywhere</b> on the 6×5 grid. Winning symbols pop and new ones tumble in — keep going until no new wins.</p>
    <p><b>4+ 🍭 lollipops</b> pay 3× / 5× / 100× bet (4 / 5 / 6) and award <b>10 free spins</b>. In free spins, <b>💣 multiplier bombs</b> (×2 to ×100) can drop. At the end of each tumble sequence with a win, all bombs on screen are added together and multiply that spin's win. 3+ lollipops in free spins = +5 spins.</p>
    <table class="pay"><thead><tr><th></th><th>8–9</th><th>10–11</th><th>12+</th></tr></thead><tbody>${Object.keys(P).map((k) => payRow(SS[k], P[k].map((v) => v * 0.88), b, 1)).join('')}</tbody></table>
    <p class="fine">Pays shown at your current bet. Max win 5,000× bet. Simulated RTP ≈ 95%.</p>`;
  },
  async play(res, x) {
    let acc = 0;
    const b = x.bet();
    for (let i = 0; i < res.spins.length; i++) {
      const s = res.spins[i];
      const label = () => (i ? `FREE SPIN ${i}/${res.fsAwarded}` : 'WIN');
      if (i === 1) {
        x.sfx.feature();
        await x.showOverlay(`<div class="feat"><small>SWEET!</small><b>10 FREE SPINS</b><small>Multiplier bombs are live</small></div>`, 2000);
        x.hideOverlay();
        document.body.classList.add('in-feature');
      }
      if (i > 0) x.setWin(acc * b, label());
      await x.spinTo(s.steps[0].grid);
      let spinWin = 0;
      for (let k = 0; k < s.steps.length; k++) {
        const st = s.steps[k];
        if (!st.wins.length) break;
        const syms = new Set(st.wins.map((w) => w.sym));
        const pos = [];
        st.grid.forEach((col, c) => col.forEach((z, r) => syms.has(z.s) && pos.push([c, r])));
        x.highlight(pos);
        x.setWinNote(st.wins.map((w) => `${w.count}× ${SS[w.sym]} ${x.fmt(w.pay * b)}`).join('   '));
        x.sfx.win();
        spinWin += st.win;
        x.setWin((acc + spinWin) * b, label());
        await x.sleep(x.speed(900));
        pos.forEach(([c, r]) => x.cells[c][r].classList.add('pop'));
        await x.sleep(x.speed(280));
        x.clearHighlight();
        const next = s.steps[k + 1];
        if (next) {
          const removed = st.grid.map((col) => col.filter((z) => syms.has(z.s)).length);
          next.grid.forEach((col, c) => col.forEach((z, r) => x.setCell(c, r, z, r < removed[c] ? 'drop' : 'shift')));
          await x.sleep(x.speed(380));
        }
      }
      x.setWinNote('');
      if (s.bombSum > 0 && s.tumbleWin > 0) {
        const pos = [];
        const last = s.steps[s.steps.length - 1].grid;
        last.forEach((col, c) => col.forEach((z, r) => z.s === 'bomb' && pos.push([c, r])));
        x.highlight(pos);
        x.sfx.big();
        await x.showOverlay(`<div class="feat"><small>BOMBS</small><b>×${s.bombSum}</b><small>${x.fmt(s.tumbleWin * b)} → ${x.fmt(s.tumbleWin * s.bombSum * b)}</small></div>`, 1700);
        x.hideOverlay(); x.clearHighlight();
        spinWin = s.tumbleWin * s.bombSum;
      }
      acc += spinWin + s.scatterPay;
      x.setWin(acc * b, label());
      if (i === 0 && s.lollies >= 4) {
        const pos = []; s.steps[s.steps.length - 1].grid.forEach((col, c) => col.forEach((z, r) => z.s === 'lolly' && pos.push([c, r])));
        x.highlight(pos); await x.sleep(1000); x.clearHighlight();
      }
      if (s.retrigger) { x.sfx.feature(); await x.showOverlay(`<div class="feat"><b>+${s.retrigger} SPINS</b></div>`, 1200); x.hideOverlay(); }
      if (i > 0) await x.sleep(x.speed(250));
    }
    document.body.classList.remove('in-feature');
  },
};

/* ================================================================== */
const GEM = { yellow: '#ffd23f', green: '#3ee07a', orange: '#ff8a2a', blue: '#3fa9ff', purple: '#c060ff' };
const gem = (k) => `<div class="gem" style="--g:${GEM[k]}"></div>`;
const prismPop = {
  name: 'Prism Pop',
  blurb: 'Classic neon gem slot. Wins pay both ways, and star wilds expand and lock for a free respin.',
  tags: ['Pays Both Ways', 'Expanding Wilds', 'Crystal Picks'],
  tagline: 'Stars expand & respin · 3 prisms = Crystal Picks jackpot game',
  cover: `<div class="cover-row">${gem('purple')}<span class="star-face">✦</span>${gem('green')}</div>`,
  cols: 5, rows: 3,
  symName: (s) => ({ bar: 'BAR', seven: '7', star: 'Star' }[s] || s + ' gem'),
  randomCell(c) {
    const t = [['bar', 1.3], ['seven', 2.2], ['yellow', 4.5], ['green', 5], ['orange', 5.5], ['blue', 7], ['purple', 7]];
    if (c >= 1 && c <= 3) t.push(['star', 0.6]);
    if (c % 2 === 0) t.push(['prism', 1.4]);
    return { s: pickW(t) };
  },
  renderCell(c) {
    if (c.s === 'star') return sym('wild star' + (c.x ? ' expanded' : ''), '<span class="star-face">✦</span>', 'WILD');
    if (c.s === 'prism') return sym('scatter prism', '<span class="prism-face"></span>', 'BONUS');
    if (c.s === 'bar') return sym('bar', '<span class="bar-face">BAR</span>');
    if (c.s === 'seven') return sym('seven', '<span class="seven-face">7</span>');
    return sym('gemcell', gem(c.s));
  },
  rules(b) {
    const P = { bar: [50, 200, 250], seven: [25, 60, 120], yellow: [10, 25, 50], green: [8, 20, 40], orange: [7, 15, 30], blue: [5, 10, 14], purple: [5, 10, 14] };
    const icon = { bar: '<b>BAR</b>', seven: '<b style="color:#ff3b5c">7</b>' };
    return `<h3>Prism Pop</h3>
    <p>10 fixed lines that pay <b>both ways</b> — left to right and right to left.</p>
    <p><b>✦ Star wilds</b> land on reels 2, 3 and 4. When one lands it <b>expands</b> to fill the reel, locks in place, and the other reels <b>respin</b> for free. Each new star earns another respin (up to 3).</p>
    <p><b>3 Prisms</b> (reels 1, 3, 5) start <b>Crystal Picks</b>: tap crystals to reveal jackpots. Match 3 of the same to win it: <b>MINI</b> 10× · <b>MINOR</b> 25× · <b>MAJOR</b> 100× · <b>GRAND</b> 500× bet.</p>
    <table class="pay"><thead><tr><th></th><th>×3</th><th>×4</th><th>×5</th></tr></thead><tbody>${Object.keys(P).map((k) => payRow(icon[k] || gem(k), P[k].map((v) => v * 0.72), b, 1 / 10)).join('')}</tbody></table>
    <p class="fine">Pays shown at your current bet. Low volatility. Simulated RTP ≈ 95%.</p>`;
  },
  async play(res, x) {
    let acc = 0;
    const b = x.bet();
    const held = new Set();
    for (let i = 0; i < res.spins.length; i++) {
      const s = res.spins[i];
      if (i > 0) {
        x.setWin(acc * b, `RESPIN ${i}`);
        await x.spinTo(s.grid, { only: (c) => !held.has(c) });
      } else {
        await x.spinTo(s.grid);
      }
      for (const r of s.expanded) {
        held.add(r);
        x.cells[r].forEach((el) => el.classList.add('expand'));
        x.sfx.feature();
        await x.sleep(x.speed(500));
      }
      if (s.wins.length) {
        await x.showLineWins(s.wins);
        acc += s.win;
        x.setWin(acc * b, i ? `RESPIN ${i}` : 'WIN');
      }
      held.forEach((r) => x.cells[r].forEach((el) => el.classList.add('locked')));
      if (i < res.spins.length - 1) await x.sleep(x.speed(400));
    }
    if (res.picks) {
      const pos = []; res.spins[0].grid.forEach((col, c) => col.forEach((z, r) => z.s === 'prism' && pos.push([c, r])));
      x.highlight(pos); await x.sleep(900); x.clearHighlight();
      x.sfx.feature();
      await x.showOverlay(`<div class="feat"><small>3 PRISMS</small><b>CRYSTAL PICKS</b><small>Match 3 to win a jackpot</small></div>`, 2000);
      x.hideOverlay();
      await playCrystalPicks(res.picks, x, acc);
    }
  },
};

/* ---- Crystal Picks bonus ---- */
const JP = [['GRAND', 500], ['MAJOR', 100], ['MINOR', 25], ['MINI', 10]];
async function playCrystalPicks(pk, x, acc0) {
  const b = x.bet();
  document.body.classList.add('in-feature');
  const el = x.showBonus(`
    <div class="cp-ladder">${JP.map(([k, v]) => `<div class="cp-rung ${k.toLowerCase()}" data-k="${k}"><b>${k}</b><span>${x.fmt(v * b)}</span><i class="pips"><u></u><u></u><u></u></i></div>`).join('')}</div>
    <p class="cp-hint" id="cp-hint">${x.auto ? 'Auto-picking…' : 'Tap a crystal'}</p>
    <div class="cp-grid">${Array.from({ length: 12 }, (_, i) => `<button class="cp-tile" data-i="${i}"><span class="cp-crystal"></span></button>`).join('')}</div>`);
  const counts = {};
  let step = 0;
  const reveal = (tile, k, dim = false) => {
    tile.classList.add('open', k.toLowerCase());
    if (dim) tile.classList.add('dim');
    tile.innerHTML = `<span class="cp-face"><b>${k}</b></span>`;
    tile.disabled = true;
  };
  await new Promise((resolve) => {
    const take = (tile) => {
      if (step >= pk.sequence.length || tile.disabled) return;
      const k = pk.sequence[step++];
      reveal(tile, k);
      counts[k] = (counts[k] || 0) + 1;
      el.querySelector(`.cp-rung[data-k="${k}"] .pips u:nth-child(${counts[k]})`)?.classList.add('on');
      x.sfx.tick();
      if (step === pk.sequence.length) { el.querySelectorAll('.cp-tile').forEach((t) => (t.disabled = true)); resolve(); }
    };
    el.querySelectorAll('.cp-tile').forEach((t) => (t.onclick = () => take(t)));
    const autoPick = async () => {
      while (step < pk.sequence.length) {
        if (!x.auto) { await x.sleep(300); continue; }
        const open = [...el.querySelectorAll('.cp-tile:not(:disabled)')];
        take(open[Math.floor(Math.random() * open.length)]);
        await x.sleep(x.speed(450));
      }
    };
    autoPick();
  });
  el.querySelector(`.cp-rung[data-k="${pk.jackpot}"]`).classList.add('won');
  el.querySelectorAll('.cp-tile').forEach((t) => { if (t.classList.contains(pk.jackpot.toLowerCase())) t.classList.add('win'); });
  el.querySelector('#cp-hint').textContent = `${pk.jackpot}!`;
  await x.sleep(900);
  const closed = [...el.querySelectorAll('.cp-tile:not(.open)')];
  closed.forEach((t, i) => reveal(t, pk.rest[i] || 'MINI', true));
  x.sfx.big();
  x.setWin((acc0 + pk.value) * b, 'CRYSTAL PICKS');
  await x.showOverlay(`<div class="feat"><small>${pk.jackpot} JACKPOT</small><b>${x.fmt(pk.value * b)}</b></div>`, 2300);
  x.hideOverlay();
  x.hideBonus();
  document.body.classList.remove('in-feature');
}

/* ================================================================== */
const THUNDER = { eagle: '🦅', horse: '🐎', trident: '🔱' };
const orb = (c, b) => sym('orb' + (c.l ? ' jp ' + c.l.toLowerCase() : '') + (c.fresh ? ' fresh' : ''), `<span class="orb-face">${c.l || fmtShort(c.v * b)}</span>`);
const thunderVault = {
  name: 'Thunder Vault',
  blurb: 'Storm-god 5×3, 20 lines. Land 6+ lightning orbs to trigger Hold & Spin with four jackpots.',
  tags: ['Hold & Spin', '4 Jackpots', 'Respins'],
  tagline: '6+ orbs = Hold & Spin · fill all 15 spots for the GRAND (1,000×)',
  cover: `<div class="cover-row"><span class="big-emoji">⚡</span><div class="sym orb mini-orb"><span class="orb-face">GRAND</span></div><span class="big-emoji">🔱</span></div>`,
  cols: 5, rows: 3,
  symName: (s) => ({ eagle: 'Eagle', horse: 'Stallion', trident: 'Trident', wild: 'Storm' }[s] || s),
  randomCell(c) {
    const t = [['eagle', 2.5], ['horse', 3.5], ['trident', 4.5], ['A', 8], ['K', 9], ['Q', 10], ['J', 11], ['orb', 5]];
    if (c >= 1 && c <= 3) t.push(['wild', 2]);
    const s = pickW(t);
    if (s === 'orb') return { s, v: pickW([[1, 3], [2, 3], [5, 1], [10, 1]]) };
    return { s };
  },
  renderCell(c, b) {
    if (c.s === 'orb') return orb(c, b);
    if (c.s === 'wild') return sym('wild storm', '<span>⚡</span>', 'WILD');
    if (THUNDER[c.s]) return sym('hi', `<span>${THUNDER[c.s]}</span>`);
    return letter(c.s, { A: '#ffcf3f', K: '#3fd0ff', Q: '#ff6bd6', J: '#7cff6b' }[c.s]);
  },
  rules(b) {
    const P = { eagle: [48, 200, 1000], horse: [32, 120, 480], trident: [24, 80, 320], A: [16, 40, 160], K: [12, 32, 100], Q: [8, 24, 80], J: [8, 20, 60] };
    const icon = { ...THUNDER, A: 'A', K: 'K', Q: 'Q', J: 'J' };
    return `<h3>Thunder Vault</h3>
    <p><b>⚡ Storm</b> is wild on reels 2–4. <b>Lightning orbs</b> show a cash value or a jackpot.</p>
    <p>Land <b>6 or more orbs</b> to trigger <b>Hold & Spin</b>: orbs lock, you get <b>3 respins</b>, and every new orb resets the count to 3. When the respins run out, every orb pays.</p>
    <p>Jackpots: <b>MINI</b> 20× · <b>MINOR</b> 50× · <b>MAJOR</b> 250× · fill all 15 spots for the <b>GRAND</b> 1,000× (plus every orb).</p>
    <table class="pay"><thead><tr><th></th><th>×3</th><th>×4</th><th>×5</th></tr></thead><tbody>${Object.keys(P).map((k) => payRow(icon[k], P[k], b, 1 / 20)).join('')}</tbody></table>
    <p class="fine">Pays shown at your current bet. 20 fixed lines. Max win 5,000× bet. Simulated RTP ≈ 95%.</p>`;
  },
  async play(res, x) {
    const b = x.bet();
    let acc = 0;
    const orbsBefore = (c) => res.base.grid.slice(0, c).flat().filter((z) => z.s === 'orb').length;
    await x.spinTo(res.base.grid, { anticipation: (c) => c >= 3 && orbsBefore(c) >= 4 });
    if (res.base.wins.length) {
      await x.showLineWins(res.base.wins);
      acc += res.base.win;
      x.setWin(acc * b);
    }
    if (!res.hold) return;
    const h = res.hold;
    const pos0 = [];
    res.base.grid.forEach((col, c) => col.forEach((z, r) => z.s === 'orb' && pos0.push([c, r])));
    x.highlight(pos0);
    x.sfx.feature();
    await x.showOverlay(`<div class="feat"><small>⚡ ${pos0.length} ORBS ⚡</small><b>HOLD &amp; SPIN</b><small>3 respins · new orbs reset</small></div>`, 2000);
    x.hideOverlay(); x.clearHighlight();
    document.body.classList.add('in-feature');
    x.setGrid(h.frames[0].board);
    x.cells.flat().forEach((el) => el.classList.add('vault'));
    let prev = h.frames[0].board;
    x.setWin(acc * b, 'RESPINS 3');
    for (let f = 1; f < h.frames.length; f++) {
      const fr = h.frames[f];
      const empty = (c, r) => !prev[c][r];
      await x.spinTo(fr.board, { only: empty, rand: () => (Math.random() < 0.12 ? { s: 'orb', v: [1, 2, 3, 5][Math.floor(Math.random() * 4)] } : null), quick: true });
      x.cells.flat().forEach((el) => el.classList.add('vault'));
      x.setWin(acc * b, `RESPINS ${fr.left}`);
      prev = fr.board;
      await x.sleep(x.speed(250));
    }
    const all = [];
    prev.forEach((col, c) => col.forEach((z, r) => z && all.push([c, r])));
    x.highlight(all);
    if (h.grand) { x.sfx.big(); await x.showOverlay(`<div class="feat grand"><small>ALL 15 FILLED</small><b>GRAND JACKPOT</b><small>${x.fmt(1000 * b)}</small></div>`, 2600); x.hideOverlay(); }
    acc += h.win;
    x.setWin(acc * b, 'HOLD & SPIN');
    await x.sleep(900);
    x.clearHighlight();
    document.body.classList.remove('in-feature');
  },
};

export const GAMES = {
  'wrapped-riches': wrappedRiches,
  'sugar-storm': sugarStorm,
  'prism-pop': prismPop,
  'thunder-vault': thunderVault,
};
