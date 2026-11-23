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
  blurb: 'Egyptian 5×3, 20 lines. Gold coins carry cash values — land a scarab on reel 5 to collect them all.',
  tags: ['Cash Collect', 'Free Spins', 'Jackpot coins'],
  tagline: 'Scarab on reel 5 collects every coin · 3 pyramids = 10 free spins',
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
    <p><b>Mummy</b> is wild on reels 2–4. <b>3+ Pyramids</b> (reels 1, 3, 5) pay 2× / 5× / 20× bet and award <b>10 free spins</b>: coins land more often, coin collects are <b>doubled</b>, and scarabs can land on reels 3–5 (each scarab collects separately). 3 pyramids during free spins = +5 spins.</p>
    <table class="pay"><thead><tr><th></th><th>×3</th><th>×4</th><th>×5</th></tr></thead><tbody>${Object.keys(P).map((k) => payRow(icon[k], P[k], b, lb)).join('')}</tbody></table>
    <p class="fine">Pays shown at your current bet. 20 fixed lines, left to right. Max win 5,000× bet. Simulated RTP ≈ 94%.</p>`;
  },
  async play(res, x) {
    let acc = 0;
    const b = x.bet();
    for (let i = 0; i < res.spins.length; i++) {
      const s = res.spins[i];
      if (i === 1) {
        x.sfx.feature();
        await x.showOverlay(`<div class="feat"><small>BONUS</small><b>10 FREE SPINS</b><small>Coin collects doubled</small></div>`, 2000);
        x.hideOverlay();
        document.body.classList.add('in-feature');
      }
      if (i > 0) x.setWin(acc * b, `FREE SPIN ${i}/${res.fsAwarded}`);
      const pyrBefore = (c) => s.grid.slice(0, c).flat().filter((z) => z.s === 'pyramid').length;
      await x.spinTo(s.grid, { anticipation: (c) => c === 4 && pyrBefore(4) >= 2 });
      if (s.wins.length) {
        await x.showLineWins(s.wins);
        acc += s.wins.reduce((a, w) => a + w.pay, 0);
        x.setWin(acc * b, i ? `FREE SPIN ${i}/${res.fsAwarded}` : 'WIN');
      }
      if (s.collect > 0) {
        const pos = [];
        s.grid.forEach((col, c) => col.forEach((z, r) => { if (z.s === 'coin' || z.s === 'scarab') pos.push([c, r]); }));
        x.highlight(pos);
        x.sfx.win();
        await x.showOverlay(`<div class="feat collect"><small>${s.scarabs > 1 ? `${s.scarabs} SCARABS ` : ''}COLLECT${i ? ' ×2' : ''}</small><b>${x.fmt(s.collect * b)}</b></div>`, 1500);
        x.hideOverlay(); x.clearHighlight();
        acc += s.collect;
        x.setWin(acc * b, i ? `FREE SPIN ${i}/${res.fsAwarded}` : 'WIN');
      }
      if (s.scatterPay > 0) { acc += s.scatterPay; x.setWin(acc * b, 'WIN'); }
      if (s.retrigger) { x.sfx.feature(); await x.showOverlay(`<div class="feat"><b>+${s.retrigger} SPINS</b></div>`, 1200); x.hideOverlay(); }
      if (i > 0) await x.sleep(x.speed(250));
      else if (s.pyramids >= 3) { const pos = []; s.grid.forEach((col, c) => col.forEach((z, r) => z.s === 'pyramid' && pos.push([c, r]))); x.highlight(pos); await x.sleep(900); x.clearHighlight(); }
    }
    document.body.classList.remove('in-feature');
  },
};

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
  tags: ['Pays Both Ways', 'Expanding Wilds', 'Respins'],
  tagline: 'Stars on reels 2–4 expand, lock and respin · 10 lines, both ways',
  cover: `<div class="cover-row">${gem('purple')}<span class="star-face">✦</span>${gem('green')}</div>`,
  cols: 5, rows: 3,
  symName: (s) => ({ bar: 'BAR', seven: '7', star: 'Star' }[s] || s + ' gem'),
  randomCell(c) {
    const t = [['bar', 1.3], ['seven', 2.2], ['yellow', 4.5], ['green', 5], ['orange', 5.5], ['blue', 7], ['purple', 7]];
    if (c >= 1 && c <= 3) t.push(['star', 0.6]);
    return { s: pickW(t) };
  },
  renderCell(c) {
    if (c.s === 'star') return sym('wild star' + (c.x ? ' expanded' : ''), '<span class="star-face">✦</span>', 'WILD');
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
    <table class="pay"><thead><tr><th></th><th>×3</th><th>×4</th><th>×5</th></tr></thead><tbody>${Object.keys(P).map((k) => payRow(icon[k] || gem(k), P[k].map((v) => v * 0.82), b, 1 / 10)).join('')}</tbody></table>
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
  },
};

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
