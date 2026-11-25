// Table games UI. Every outcome comes from the `table` edge function; this file only renders.

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['♠', '♥', '♦', '♣'];
const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
const card = (c, cls = '', delay = 0) => {
  const st = delay ? ` style="animation-delay:${delay}ms"` : '';
  if (c == null) return `<div class="pcard back ${cls}"${st}></div>`;
  const s = Math.floor(c / 13), r = c % 13;
  return `<div class="pcard ${s === 1 || s === 2 ? 'red' : ''} ${cls}"${st}><b>${RANKS[r]}</b><i>${SUITS[s]}</i><u>${SUITS[s]}</u></div>`;
};
const CHIPS = [5, 25, 100, 500, 1000];
const chipHtml = (v, cls = '') => `<span class="chip c${v >= 1000 ? 1000 : v >= 500 ? 500 : v >= 100 ? 100 : v >= 25 ? 25 : 5} ${cls}">${v >= 1000 ? (v / 1000) + 'K' : v}</span>`;
const stepper = (id, label, values, idx) => `
  <div class="stepper" data-id="${id}"><button class="btn round" data-step="-1">−</button>
  <div class="bet-val"><small>${label}</small><span id="${id}">${values[idx].toLocaleString('en-US')}</span></div>
  <button class="btn round" data-step="1">+</button></div>`;
function bindStepper(root, id, values, get, set, onChange) {
  root.querySelectorAll(`.stepper[data-id="${id}"] [data-step]`).forEach((b) => (b.onclick = () => {
    const i = Math.max(0, Math.min(values.length - 1, get() + +b.dataset.step));
    set(i); root.querySelector('#' + id).textContent = values[i].toLocaleString('en-US'); onChange?.();
  }));
}
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};

/* ================================================================== */
/* BLACKJACK                                                           */
/* ================================================================== */
const BJ_BETS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
const blackjack = {
  name: 'Blackjack',
  blurb: 'Six decks, dealer stands on all 17s, blackjack pays 3:2. Double on any two, split up to four hands.',
  tags: ['3:2 Blackjack', 'Double', 'Split'],
  cover: `<div class="cover-row cards-cover">${card(51)}${card(11 + 13)}</div>`,
  rules: `<h3>Blackjack</h3>
    <p>Get closer to 21 than the dealer without going over. Face cards count 10, aces count 1 or 11.</p>
    <ul><li>Six-deck shoe, freshly shuffled every hand</li><li>Dealer stands on all 17s and checks for blackjack</li><li>Blackjack pays <b>3:2</b>, other wins pay 1:1</li><li>Double down on any first two cards, including after a split</li><li>Split pairs up to 4 hands; split aces get one card each</li><li>No insurance or surrender</li></ul>
    <p class="fine">Bets 10–5,000. House edge ≈ 0.5% with basic strategy.</p>`,
  mount(el, x) {
    let betIdx = store.get('bjBet', 3);
    let view = null, prev = null;
    el.innerHTML = `
      <div class="felt bj">
        <div class="bj-row"><div class="lbl">DEALER <span id="bj-dt"></span></div><div class="cards" id="bj-dealer"></div></div>
        <div class="bj-msg" id="bj-msg">Place your bet</div>
        <div class="bj-hands" id="bj-hands"></div>
        <p class="felt-text">BLACKJACK PAYS 3 TO 2 · DEALER STANDS ON ALL 17s</p>
      </div>
      <div class="t-controls" id="bj-ctl"></div>`;
    const ctl = el.querySelector('#bj-ctl');
    const renderControls = () => {
      if (!view || view.stage === 'done') {
        ctl.innerHTML = `${stepper('bj-bet', 'BET', BJ_BETS, betIdx)}<button class="btn gold big" id="bj-deal">DEAL</button>`;
        bindStepper(ctl, 'bj-bet', BJ_BETS, () => betIdx, (i) => { betIdx = i; store.set('bjBet', i); });
        ctl.querySelector('#bj-deal').onclick = () => go('deal', { bet: BJ_BETS[betIdx] });
      } else {
        const can = view.can || {};
        ctl.innerHTML = `
          <button class="btn act" data-a="hit">HIT</button>
          <button class="btn act" data-a="stand">STAND</button>
          <button class="btn act" data-a="double" ${can.double ? '' : 'disabled'}>DOUBLE</button>
          <button class="btn act" data-a="split" ${can.split ? '' : 'disabled'}>SPLIT</button>`;
        ctl.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => go(b.dataset.a)));
      }
    };
    const render = (fresh) => {
      const dEl = el.querySelector('#bj-dealer'), hEl = el.querySelector('#bj-hands');
      if (!view) { dEl.innerHTML = ''; hEl.innerHTML = ''; el.querySelector('#bj-dt').textContent = ''; renderControls(); return 0; }
      const done = view.stage === 'done';
      const pd = prev && !fresh ? prev.dealer.length : 0;
      let delay = 0;
      // player cards
      hEl.innerHTML = view.hands.map((h, i) => {
        const ph = prev && !fresh ? prev.hands[i] : null;
        const before = ph ? ph.cards.length : 0;
        const cards = h.cards.map((c, k) => {
          if (k < before) return card(c);
          delay += 160; return card(c, 'deal', delay);
        }).join('');
        const active = !done && i === view.active && view.hands.length > 1;
        const badge = h.result ? `<span class="badge ${h.result}">${{ win: 'WIN', lose: 'LOSE', push: 'PUSH', bust: 'BUST', blackjack: 'BLACKJACK' }[h.result]}</span>` : '';
        return `<div class="bj-hand ${active ? 'active' : ''}"><div class="cards">${cards}</div>
          <div class="lbl">${h.total}${h.doubled ? ' · doubled' : ''} ${chipHtml(h.bet)} ${badge}</div></div>`;
      }).join('');
      // dealer cards (hole card face down until the hand is over)
      const shown = done ? view.dealer : [view.dealer[0], null];
      let dDelay = delay;
      dEl.innerHTML = shown.map((c, k) => {
        if (k < pd && !(done && k === 1 && prev?.stage !== 'done')) return card(c);
        dDelay += k === 1 && done ? 250 : 420;
        return card(c, k === 1 && done && c != null ? 'flip' : 'deal', dDelay);
      }).join('');
      el.querySelector('#bj-dt').textContent = done ? view.dealerTotal : '';
      el.querySelector('#bj-hands').classList.toggle('resolved', done);
      renderControls();
      return dDelay;
    };
    const message = () => {
      const m = el.querySelector('#bj-msg');
      if (!view) { m.textContent = 'Place your bet'; return; }
      if (view.stage !== 'done') { m.textContent = view.hands.length > 1 ? `Hand ${view.active + 1} of ${view.hands.length}` : ''; return; }
      if (view.dealerBJ) { m.textContent = 'Dealer has blackjack'; return; }
      m.textContent = view.dealerTotal > 21 ? 'Dealer busts' : `Dealer has ${view.dealerTotal}`;
    };
    let busy = false;
    const go = async (action, params) => {
      if (busy) return;
      busy = true; ctl.classList.add('wait');
      const r = await x.call('blackjack', action, params);
      if (r) {
        prev = action === 'deal' ? null : view;
        view = r.view;
        const t = render(action === 'deal');
        await x.sleep(t + 300);
        message();
        if (view.stage === 'done') {
          const net = r.payout - (r.wager || 0);
          x.settle(r.balance);
          if (r.payout > 0 && view.hands.some((h) => h.result === 'win' || h.result === 'blackjack')) { x.sfx.win(); x.flash(`+${x.fmt(r.payout)}`); }
          else if (net < 0 || r.payout === 0) x.sfx.stop();
        } else x.settle(r.balance);
      }
      busy = false; ctl.classList.remove('wait');
    };
    (async () => { const r = await x.call('blackjack', 'load'); if (r) { view = r.view; render(true); message(); } else renderControls(); })();
  },
};

/* ================================================================== */
/* ULTIMATE TEXAS HOLD'EM                                              */
/* ================================================================== */
const UTH_ANTES = [10, 25, 50, 100, 250, 500, 1000, 2500];
const UTH_TRIPS = [0, 10, 25, 50, 100, 250, 500, 1000];
const uth = {
  name: "Ultimate Texas Hold'em",
  blurb: 'Play heads-up against the dealer. Bet big early with a strong hand, or check and wait for the flop and river.',
  tags: ['Ante + Blind', 'Up to 4× Play', 'Trips side bet'],
  cover: `<div class="cover-row cards-cover">${card(12)}${card(12 + 13)}${card(11 + 26)}</div>`,
  rules: `<h3>Ultimate Texas Hold'em</h3>
    <p>Post equal <b>Ante</b> and <b>Blind</b> bets (plus an optional <b>Trips</b>). You and the dealer each get two cards and share five community cards.</p>
    <ul><li><b>Before the flop:</b> check, or bet 3× or 4× the ante</li><li><b>After the flop:</b> if you checked, check again or bet 2×</li><li><b>After the river:</b> if you're still checking, bet 1× or fold (you lose ante and blind)</li></ul>
    <p>Best five-card hand wins. If you beat the dealer, <b>Play</b> pays 1:1, <b>Ante</b> pays 1:1 (it pushes if the dealer doesn't have at least a pair), and <b>Blind</b> pays by your hand: Royal 500:1, Straight Flush 50:1, Quads 10:1, Full House 3:1, Flush 3:2, Straight 1:1, anything else pushes. Ties push.</p>
    <p><b>Trips</b> pays on your hand even if you fold: Royal 50:1, SF 40:1, Quads 30:1, Full House 8:1, Flush 7:1, Straight 4:1, Trips 3:1.</p>
    <p class="fine">Tip: bet 4× with any pair (except 2s), any ace, and strong kings. House edge ≈ 2.2% of the ante with perfect play.</p>`,
  mount(el, x) {
    let anteIdx = store.get('uthAnte', 1), tripsIdx = store.get('uthTrips', 0);
    let view = null, prev = null;
    el.innerHTML = `
      <div class="felt uth">
        <div class="uth-row"><div class="lbl">DEALER <span id="u-dn"></span></div><div class="cards" id="u-dealer"></div></div>
        <div class="cards board" id="u-board"></div>
        <div class="uth-row"><div class="cards" id="u-player"></div><div class="lbl">YOU <span id="u-pn"></span></div></div>
        <div class="spots" id="u-spots"></div>
        <div class="bj-msg" id="u-msg"></div>
      </div>
      <div class="t-controls" id="u-ctl"></div>`;
    const ctl = el.querySelector('#u-ctl');
    const spot = (label, amt, cls = '') => `<div class="spot ${cls}"><small>${label}</small>${amt ? chipHtml(amt) : '<span class="empty-spot"></span>'}</div>`;
    const renderSpots = () => {
      const a = view ? view.ante : UTH_ANTES[anteIdx];
      const t = view ? view.trips : UTH_TRIPS[tripsIdx];
      const res = view?.result;
      const tag = (k) => (res ? (res[k] > (k === 'play' ? view.play : k === 'trips' ? view.trips : view.ante) ? 'won' : res[k] === 0 ? 'lost' : 'pushed') : '');
      el.querySelector('#u-spots').innerHTML =
        spot('TRIPS', t, view && t ? tag('trips') : '') + spot('ANTE', a, view ? tag('ante') : '') + spot('BLIND', a, view ? tag('blind') : '') + spot('PLAY', view?.play || 0, view?.play ? tag('play') : '');
    };
    const renderControls = () => {
      if (!view || view.stage === 'done') {
        ctl.innerHTML = `${stepper('u-ante', 'ANTE', UTH_ANTES, anteIdx)}${stepper('u-trips', 'TRIPS', UTH_TRIPS, tripsIdx)}<button class="btn gold big" id="u-deal">DEAL<br><small id="u-cost"></small></button>`;
        const cost = () => (ctl.querySelector('#u-cost').textContent = x.fmt(UTH_ANTES[anteIdx] * 2 + UTH_TRIPS[tripsIdx]));
        bindStepper(ctl, 'u-ante', UTH_ANTES, () => anteIdx, (i) => { anteIdx = i; store.set('uthAnte', i); }, () => { cost(); if (!view) renderSpots(); });
        bindStepper(ctl, 'u-trips', UTH_TRIPS, () => tripsIdx, (i) => { tripsIdx = i; store.set('uthTrips', i); }, () => { cost(); if (!view) renderSpots(); });
        cost();
        ctl.querySelector('#u-deal').onclick = () => go('deal', { ante: UTH_ANTES[anteIdx], trips: UTH_TRIPS[tripsIdx] });
        return;
      }
      const a = view.ante;
      const opts = {
        preflop: [['check', 'CHECK'], ['bet:3', `BET 3× · ${x.fmt(a * 3)}`], ['bet:4', `BET 4× · ${x.fmt(a * 4)}`]],
        flop: [['check', 'CHECK'], ['bet:2', `BET 2× · ${x.fmt(a * 2)}`]],
        river: [['fold', 'FOLD'], ['bet:1', `BET 1× · ${x.fmt(a)}`]],
      }[view.stage];
      ctl.innerHTML = opts.map(([k, l]) => `<button class="btn act ${k.startsWith('bet') ? 'gold' : ''}" data-a="${k}">${l}</button>`).join('');
      ctl.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => {
        const [act, m] = b.dataset.a.split(':');
        go(act, m ? { mult: +m } : {});
      }));
    };
    const render = (fresh) => {
      const done = view?.stage === 'done';
      let delay = 0;
      const deal = (cards, before) => cards.map((c, k) => (k < before ? card(c) : (delay += 170, card(c, 'deal', delay)))).join('');
      if (!view) {
        el.querySelector('#u-dealer').innerHTML = el.querySelector('#u-player').innerHTML = '';
        el.querySelector('#u-board').innerHTML = Array(5).fill('<div class="pcard slot"></div>').join('');
        el.querySelector('#u-pn').textContent = el.querySelector('#u-dn').textContent = '';
        renderSpots(); renderControls(); return 0;
      }
      el.querySelector('#u-player').innerHTML = deal(view.player, fresh ? 0 : 2);
      const pb = fresh ? 0 : prev?.board?.length || 0;
      el.querySelector('#u-board').innerHTML = deal(view.board, pb) + Array(5 - view.board.length).fill('<div class="pcard slot"></div>').join('');
      el.querySelector('#u-dealer').innerHTML = done ? view.dealer.map((c) => (delay += 300, card(c, 'flip', delay))).join('') : (fresh ? [null, null].map(() => (delay += 170, card(null, 'deal', delay))).join('') : card(null) + card(null));
      const r = view.result;
      el.querySelector('#u-pn').textContent = r ? HAND_NAMES[r.player.cat] : HAND_NAMES[view.current];
      el.querySelector('#u-dn').textContent = r ? HAND_NAMES[r.dealer.cat] + (r.dealerQualifies === false ? ' · doesn\'t open' : '') : '';
      el.querySelectorAll('#u-board .pcard, #u-player .pcard, #u-dealer .pcard').forEach((e) => e.classList.remove('best'));
      if (r && r.outcome !== 'fold') {
        const best = new Set(r[r.outcome === 'lose' ? 'dealer' : 'player'].cards);
        const all = [...el.querySelectorAll('#u-board .pcard, #u-player .pcard, #u-dealer .pcard')];
        const vals = [...view.board, ...view.player, ...view.dealer];
        setTimeout(() => all.forEach((e, i) => best.has(vals[i]) && e.classList.add('best')), delay + 300);
      }
      renderSpots(); renderControls();
      return delay;
    };
    let busy = false;
    const go = async (action, params) => {
      if (busy) return;
      busy = true; ctl.classList.add('wait');
      const r = await x.call('uth', action, params);
      if (r) {
        prev = view; view = r.view;
        const t = render(action === 'deal');
        await x.sleep(t + 350);
        x.settle(r.balance);
        const m = el.querySelector('#u-msg');
        if (view.stage === 'done') {
          const res = view.result;
          const net = res.total - (view.ante * 2 + view.trips + view.play);
          m.textContent = { win: 'You win', lose: 'Dealer wins', push: 'Push', fold: 'Folded' }[res.outcome] + (net ? ` · ${net > 0 ? '+' : '−'}${x.fmt(Math.abs(net))}` : '');
          if (net > 0) { x.sfx.win(); x.flash(`+${x.fmt(res.total)}`); }
        } else m.textContent = '';
      }
      busy = false; ctl.classList.remove('wait');
    };
    (async () => { const r = await x.call('uth', 'load'); view = r?.view || null; render(true); })();
  },
};

/* ================================================================== */
/* ROULETTE                                                            */
/* ================================================================== */
const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const colorOf = (n) => (n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black');
function wheelSvg() {
  const seg = 360 / 37, R = 100;
  const pt = (a, r) => [R + r * Math.sin((a * Math.PI) / 180), R - r * Math.cos((a * Math.PI) / 180)];
  let s = `<svg viewBox="0 0 200 200" class="wheel-svg"><g id="rl-rotor">`;
  WHEEL.forEach((n, i) => {
    const a0 = i * seg - seg / 2, a1 = a0 + seg;
    const [x0, y0] = pt(a0, 96), [x1, y1] = pt(a1, 96), [x2, y2] = pt(a1, 62), [x3, y3] = pt(a0, 62);
    const fill = { green: '#0f8a3c', red: '#c8102e', black: '#161616' }[colorOf(n)];
    s += `<path d="M${x0},${y0} A96,96 0 0 1 ${x1},${y1} L${x2},${y2} A62,62 0 0 0 ${x3},${y3} Z" fill="${fill}" stroke="#c9a24a" stroke-width=".6"/>`;
    const [tx, ty] = pt(i * seg, 86);
    s += `<text x="${tx}" y="${ty}" transform="rotate(${i * seg} ${tx} ${ty})" text-anchor="middle" dominant-baseline="middle" font-size="7.5" font-weight="700" fill="#fff">${n}</text>`;
  });
  s += `<circle cx="100" cy="100" r="62" fill="#5a3a12" stroke="#c9a24a" stroke-width="1.5"/><circle cx="100" cy="100" r="40" fill="#7a5220"/>`;
  for (let k = 0; k < 4; k++) s += `<rect x="97" y="62" width="6" height="76" rx="3" fill="#d9b25a" transform="rotate(${k * 45} 100 100)"/>`;
  s += `<circle cx="100" cy="100" r="9" fill="#f0d084"/></g>`;
  s += `<g id="rl-ballg"><circle id="rl-ball" cx="100" cy="20" r="4.2" fill="#fff" stroke="#999" stroke-width=".5"/></g></svg>`;
  return s;
}
const roulette = {
  name: 'Roulette',
  blurb: 'European single-zero wheel. Bet on numbers, colors, dozens and columns.',
  tags: ['Single Zero', '35:1 Straight Up', 'Rebet'],
  cover: `<div class="cover-row"><div class="mini-wheel">${wheelSvg()}</div></div>`,
  rules: `<h3>Roulette</h3>
    <p>European wheel with a single zero (37 pockets). Pick a chip and tap the layout to bet. Tap Spin when you're ready.</p>
    <table class="pay"><thead><tr><th>Bet</th><th>Pays</th></tr></thead><tbody>
    <tr><td>Single number (0–36)</td><td>35:1</td></tr><tr><td>Dozen · Column</td><td>2:1</td></tr>
    <tr><td>Red/Black · Odd/Even · 1–18/19–36</td><td>1:1</td></tr></tbody></table>
    <p class="fine">Up to 5,000 per spot and 25,000 per spin. Zero loses all outside bets. House edge 2.7%.</p>`,
  mount(el, x) {
    let chip = store.get('rlChip', 25);
    let bets = {}, history = [], last = store.get('rlLast', null);
    let rot = 0, spinning = false;
    const nums = [];
    for (let c = 1; c <= 12; c++) for (const r of [3, 2, 1]) nums.push((c - 1) * 3 + r);
    el.innerHTML = `
      <div class="felt rl">
        <div class="rl-top">
          <div class="wheel-wrap">${wheelSvg()}<div class="rl-result" id="rl-result"></div></div>
          <div class="rl-history" id="rl-hist"></div>
        </div>
        <div class="rl-board" id="rl-board">
          <div class="rl-cell zero green" data-k="n:0">0</div>
          <div class="rl-nums">${[3, 2, 1].map((r) => Array.from({ length: 12 }, (_, c) => { const n = c * 3 + r; return `<div class="rl-cell ${colorOf(n)}" data-k="n:${n}">${n}</div>`; }).join('')).join('')}</div>
          <div class="rl-cols">${[3, 2, 1].map((c) => `<div class="rl-cell out" data-k="col:${c}">2:1</div>`).join('')}</div>
          <div class="rl-dozens">${[1, 2, 3].map((d) => `<div class="rl-cell out" data-k="dozen:${d}">${['1st', '2nd', '3rd'][d - 1]} 12</div>`).join('')}</div>
          <div class="rl-outs">
            <div class="rl-cell out" data-k="low">1–18</div><div class="rl-cell out" data-k="even">EVEN</div>
            <div class="rl-cell out" data-k="red"><span class="diamond red"></span></div><div class="rl-cell out" data-k="black"><span class="diamond black"></span></div>
            <div class="rl-cell out" data-k="odd">ODD</div><div class="rl-cell out" data-k="high">19–36</div>
          </div>
        </div>
      </div>
      <div class="chip-rack" id="rl-chips">${CHIPS.map((v) => `<button class="chip-btn ${v === chip ? 'on' : ''}" data-v="${v}">${chipHtml(v)}</button>`).join('')}</div>
      <div class="t-controls">
        <button class="btn ghost" id="rl-undo">Undo</button><button class="btn ghost" id="rl-clear">Clear</button>
        <button class="btn ghost" id="rl-rebet">Rebet</button>
        <button class="btn gold big" id="rl-spin">SPIN<br><small id="rl-total">0</small></button>
      </div>`;
    const stack = [];
    const total = () => Object.values(bets).reduce((a, v) => a + v, 0);
    const paint = () => {
      el.querySelectorAll('.rl-cell').forEach((c) => {
        const v = bets[c.dataset.k];
        c.querySelector('.chip')?.remove();
        if (v) c.insertAdjacentHTML('beforeend', chipHtml(v, 'on-board'));
      });
      el.querySelector('#rl-total').textContent = x.fmt(total());
    };
    el.querySelectorAll('.chip-btn').forEach((b) => (b.onclick = () => {
      chip = +b.dataset.v; store.set('rlChip', chip);
      el.querySelectorAll('.chip-btn').forEach((z) => z.classList.toggle('on', z === b));
    }));
    el.querySelector('#rl-board').onclick = (e) => {
      const c = e.target.closest('.rl-cell');
      if (!c || spinning) return;
      el.querySelectorAll('.rl-cell.win').forEach((z) => z.classList.remove('win'));
      if ((bets[c.dataset.k] || 0) + chip > 5000) return x.toast('Max 5,000 per spot');
      if (total() + chip > 25000) return x.toast('Max 25,000 per spin');
      bets[c.dataset.k] = (bets[c.dataset.k] || 0) + chip;
      stack.push([c.dataset.k, chip]);
      x.sfx.tick(); paint();
    };
    el.querySelector('#rl-undo').onclick = () => { const s = stack.pop(); if (!s) return; bets[s[0]] -= s[1]; if (!bets[s[0]]) delete bets[s[0]]; paint(); };
    el.querySelector('#rl-clear').onclick = () => { bets = {}; stack.length = 0; paint(); };
    el.querySelector('#rl-rebet').onclick = () => { if (last && !spinning) { bets = { ...last }; stack.length = 0; paint(); } };
    const rotor = el.querySelector('#rl-rotor'), ballg = el.querySelector('#rl-ballg');
    const renderHist = () => (el.querySelector('#rl-hist').innerHTML = history.slice(0, 12).map((n) => `<span class="h ${colorOf(n)}">${n}</span>`).join(''));
    el.querySelector('#rl-spin').onclick = async () => {
      if (spinning) return;
      if (!total()) return x.toast('Tap the layout to place a bet');
      spinning = true;
      el.querySelector('#rl-result').className = 'rl-result';
      el.querySelectorAll('.rl-cell.win').forEach((z) => z.classList.remove('win'));
      const placed = { ...bets };
      const r = await x.call('roulette', 'spin', { bets: placed });
      if (!r) { spinning = false; return; }
      last = placed; store.set('rlLast', last);
      const n = r.view.number, idx = WHEEL.indexOf(n), seg = 360 / 37;
      // rotor spins clockwise; ball spins the other way and lands at the top pointing at n
      const ms = x.turbo ? 1800 : 4200;
      const target = rot + 360 * 4 + ((360 - ((rot + idx * seg) % 360)) % 360);
      rot = target;
      rotor.style.transition = `transform ${ms}ms cubic-bezier(.12,.6,.2,1)`;
      rotor.style.transform = `rotate(${rot}deg)`;
      ballg.style.transition = 'none'; ballg.style.transform = 'rotate(0deg)';
      void ballg.getBoundingClientRect();
      ballg.style.transition = `transform ${ms}ms cubic-bezier(.12,.6,.2,1)`;
      ballg.style.transform = `rotate(${-360 * 6}deg)`;
      el.querySelector('#rl-ball').setAttribute('cy', 20);
      setTimeout(() => el.querySelector('#rl-ball').setAttribute('cy', 31), ms * 0.75);
      await x.sleep(ms + 150);
      history.unshift(n); renderHist();
      const res = el.querySelector('#rl-result');
      res.textContent = n; res.className = 'rl-result show ' + colorOf(n);
      Object.keys(r.view.wins).forEach((k) => el.querySelector(`.rl-cell[data-k="${k}"]`)?.classList.add('win'));
      el.querySelector(`.rl-cell[data-k="n:${n}"]`)?.classList.add('win');
      x.settle(r.balance);
      if (r.payout > 0) { x.sfx.win(); x.flash(`+${x.fmt(r.payout)}`); } else x.sfx.stop();
      bets = {}; stack.length = 0; paint();
      spinning = false;
    };
    paint(); renderHist();
  },
};

/* ================================================================== */
/* CRAPS                                                               */
/* ================================================================== */
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const die = (v, cls = '') => `<div class="die ${cls}">${Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'p' : ''}"></i>`).join('')}</div>`;
const CALLS = { 2: 'Snake eyes', 3: 'Ace-deuce', 7: 'Seven', 11: 'Yo-eleven', 12: 'Boxcars' };
const crapsLabel = { pass: 'Pass Line', dontpass: "Don't Pass", odds: 'Odds', come: 'Come', field: 'Field', any7: 'Any 7', anycraps: 'Any Craps', yo: 'Yo 11' };
const craps = {
  name: 'Craps',
  blurb: 'Pass line, odds, come, place, field and the hardways. Roll the dice and ride the point.',
  tags: ['Pass + 3-4-5× Odds', 'Place & Hardways', 'Field'],
  cover: `<div class="cover-row">${die(5, 'big')}${die(6, 'big')}</div>`,
  rules: `<h3>Craps</h3>
    <p><b>Pass Line</b> (come-out roll): 7 or 11 wins, 2/3/12 loses, anything else sets the <b>point</b>. Then the point before a 7 wins, a 7 first loses ("seven out"). <b>Don't Pass</b> is the opposite (12 on the come-out pushes).</p>
    <p><b>Odds</b>: once a point is set, back your pass bet with up to 3× (4/10), 4× (5/9) or 5× (6/8). Pays true odds: 2:1, 3:2, 6:5, with no house edge.</p>
    <p><b>Come</b>: works like a new pass bet made while a point is on. It moves to whatever number rolls next.</p>
    <table class="pay"><thead><tr><th>Bet</th><th>Pays</th></tr></thead><tbody>
    <tr><td>Place 6 / 8</td><td>7:6</td></tr><tr><td>Place 5 / 9</td><td>7:5</td></tr><tr><td>Place 4 / 10</td><td>9:5</td></tr>
    <tr><td>Field (3,4,9,10,11 / 2 / 12)</td><td>1:1 / 2:1 / 3:1</td></tr>
    <tr><td>Hard 6 / 8</td><td>9:1</td></tr><tr><td>Hard 4 / 10</td><td>7:1</td></tr>
    <tr><td>Any 7</td><td>4:1</td></tr><tr><td>Any Craps (2, 3, 12)</td><td>7:1</td></tr><tr><td>Yo 11</td><td>15:1</td></tr></tbody></table>
    <p>Place and hardway bets are off on the come-out roll, stay up after they win, and can be taken down (tap ✕). Field and the center bets are one-roll bets.</p>
    <p class="fine">Max 5,000 per bet. Pass line edge 1.41%; place 6/8 1.52%.</p>`,
  mount(el, x) {
    let chip = store.get('crChip', 25);
    let view = null, pending = {};
    const placeBox = (n) => `<div class="cz place" data-k="place${n}"><b>${n === 6 ? 'SIX' : n === 9 ? 'NINE' : n}</b><span class="puck-slot"></span><div class="come-pt" data-cp="${n}"></div></div>`;
    el.innerHTML = `
      <div class="felt cr">
        <div class="cr-places">${[4, 5, 6, 8, 9, 10].map(placeBox).join('')}</div>
        <div class="cr-mid">
          <div class="cz come" data-k="come"><b>COME</b></div>
          <div class="cr-center">
            <div class="cz small" data-k="any7"><b>ANY 7</b><small>4:1</small></div>
            <div class="cr-hard">${[6, 8, 4, 10].map((n) => `<div class="cz small" data-k="hard${n}"><b>${die(n / 2, 'tiny')}${die(n / 2, 'tiny')}</b><small>${n === 4 || n === 10 ? '7:1' : '9:1'}</small></div>`).join('')}</div>
            <div class="cz small" data-k="anycraps"><b>ANY CRAPS</b><small>7:1</small></div>
            <div class="cz small" data-k="yo"><b>YO 11</b><small>15:1</small></div>
          </div>
        </div>
        <div class="cz field" data-k="field"><b>FIELD</b><small>2 · <em>3 · 4 · 9 · 10 · 11</em> · 12 — 2× on 2, 3× on 12</small></div>
        <div class="cr-line">
          <div class="cz dp" data-k="dontpass"><b>DON'T PASS BAR 12</b></div>
          <div class="cz odds" data-k="odds"><b>ODDS</b></div>
          <div class="cz pass" data-k="pass"><b>PASS LINE</b></div>
        </div>
        <div class="cr-dice" id="cr-dice">${die(3)}${die(4)}</div>
        <div class="bj-msg" id="cr-msg"></div>
      </div>
      <div class="chip-rack">${CHIPS.map((v) => `<button class="chip-btn ${v === chip ? 'on' : ''}" data-v="${v}">${chipHtml(v)}</button>`).join('')}</div>
      <div class="t-controls">
        <button class="btn ghost" id="cr-clear">Clear new bets</button>
        <button class="btn gold big" id="cr-roll">ROLL<br><small id="cr-new"></small></button>
      </div>`;
    const legal = (k) => {
      const pt = view?.point, b = view?.bets || {};
      if (k === 'pass' || k === 'dontpass') return !pt;
      if (k === 'come') return !!pt;
      if (k === 'odds') return !!pt && !!b.pass;
      return true;
    };
    const paint = () => {
      const b = view?.bets || {}, cp = view?.comePts || {};
      el.querySelectorAll('.cz').forEach((z) => {
        const k = z.dataset.k;
        z.querySelectorAll(':scope > .chip, :scope > .td').forEach((c) => c.remove());
        z.classList.toggle('off', !legal(k));
        if (b[k]) {
          z.insertAdjacentHTML('beforeend', chipHtml(b[k], 'on-board'));
          if (k.startsWith('place') || k.startsWith('hard') || k === 'odds') z.insertAdjacentHTML('beforeend', `<button class="td" data-td="${k}" title="Take down">✕</button>`);
        }
        if (pending[k]) z.insertAdjacentHTML('beforeend', chipHtml(pending[k], 'on-board pending'));
        z.classList.toggle('point', k === 'place' + view?.point);
        const ps = z.querySelector('.puck-slot');
        if (ps) ps.innerHTML = k === 'place' + view?.point ? '<span class="puck on">ON</span>' : '';
      });
      el.querySelectorAll('.come-pt').forEach((c) => (c.innerHTML = cp[c.dataset.cp] ? chipHtml(cp[c.dataset.cp], 'come-chip') : ''));
      const sum = Object.values(pending).reduce((a, v) => a + v, 0);
      el.querySelector('#cr-new').textContent = sum ? '+' + x.fmt(sum) : '';
      const hasAny = sum || Object.keys(b).length || Object.keys(cp).length;
      el.querySelector('#cr-roll').disabled = !hasAny;
      if (!view?.last && !view?.point) el.querySelector('#cr-msg').textContent = 'Come-out roll: bet the Pass Line';
    };
    el.querySelectorAll('.chip-btn').forEach((b) => (b.onclick = () => {
      chip = +b.dataset.v; store.set('crChip', chip);
      el.querySelectorAll('.chip-btn').forEach((z) => z.classList.toggle('on', z === b));
    }));
    let busy = false;
    el.querySelector('.felt').onclick = async (e) => {
      if (busy) return;
      const td = e.target.closest('[data-td]');
      if (td) {
        e.stopPropagation();
        busy = true;
        const r = await x.call('craps', 'takedown', { key: td.dataset.td });
        if (r) { view = r.view; x.settle(r.balance); }
        busy = false; paint(); return;
      }
      const z = e.target.closest('.cz');
      if (!z) return;
      const k = z.dataset.k;
      if (!legal(k)) {
        return x.toast(k === 'come' ? 'Come bets need a point' : k === 'odds' ? 'Odds need a Pass bet and a point' : 'Line bets only on the come-out roll');
      }
      let amt = chip;
      if (k === 'odds') {
        const max = view.bets.pass * { 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 }[view.point] - (view.bets.odds || 0) - (pending.odds || 0);
        if (max <= 0) return x.toast('Odds are maxed');
        amt = Math.min(chip, max);
      }
      if ((view?.bets?.[k] || 0) + (pending[k] || 0) + amt > 5000) return x.toast('Max 5,000 per bet');
      pending[k] = (pending[k] || 0) + amt;
      x.sfx.tick(); paint();
    };
    el.querySelector('#cr-clear').onclick = () => { pending = {}; paint(); };
    el.querySelector('#cr-roll').onclick = async () => {
      if (busy) return;
      busy = true;
      const add = pending;
      const diceEl = el.querySelector('#cr-dice');
      diceEl.classList.add('rolling');
      const tumble = setInterval(() => (diceEl.innerHTML = die(1 + Math.floor(Math.random() * 6), 'tumble') + die(1 + Math.floor(Math.random() * 6), 'tumble')), 90);
      const r = await x.call('craps', 'roll', { add });
      await x.sleep(x.turbo ? 300 : 800);
      clearInterval(tumble); diceEl.classList.remove('rolling');
      if (!r) { busy = false; diceEl.innerHTML = die(3) + die(4); return; }
      pending = {};
      const prevPoint = view?.point;
      view = r.view;
      const L = view.last;
      diceEl.innerHTML = die(L.d1, 'land') + die(L.d2, 'land');
      const o = L.out;
      let msg = `${CALLS[L.total] || L.total}${L.d1 === L.d2 && [4, 6, 8, 10].includes(L.total) ? ' the hard way' : ''}`;
      if (o.point?.set) msg += ` · point is ${o.point.set}`;
      else if (o.point?.hit) msg += ` · point hit, winner!`;
      else if (o.point?.sevenOut) msg = 'Seven out';
      else if (!prevPoint && [7, 11].includes(L.total)) msg += ' · front line winner';
      else if (!prevPoint && [2, 3, 12].includes(L.total)) msg += ' · craps';
      el.querySelector('#cr-msg').textContent = msg;
      // flash winning / losing zones
      for (const [k, v] of Object.entries(o)) {
        const z = k.startsWith('come') && k !== 'come' ? el.querySelector(`.come-pt[data-cp="${k.slice(4)}"]`)?.closest('.cz') : el.querySelector(`.cz[data-k="${k}"]`);
        if (!z) continue;
        if (v.won) { z.classList.add('flash-win'); z.insertAdjacentHTML('beforeend', `<span class="float-win">+${x.fmt(v.won)}</span>`); }
        if (v.lost) z.classList.add('flash-lose');
        setTimeout(() => { z.classList.remove('flash-win', 'flash-lose'); z.querySelector('.float-win')?.remove(); }, 1600);
      }
      x.settle(r.balance);
      if (r.payout > 0) x.sfx.win(); else x.sfx.stop();
      paint();
      busy = false;
    };
    (async () => {
      const r = await x.call('craps', 'load');
      view = r?.view || null;
      if (view?.last) { const L = view.last; el.querySelector('#cr-dice').innerHTML = die(L.d1) + die(L.d2); }
      if (view?.point) el.querySelector('#cr-msg').textContent = `Point is ${view.point}`;
      paint();
    })();
  },
};

export const TABLES = { blackjack, uth, roulette, craps };
