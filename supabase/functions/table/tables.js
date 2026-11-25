// Table game engines. Pure functions; the edge function persists state between actions.
// Each action returns { state, wager, payout }: coins taken from the player and coins returned.

const cryptoRng = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
};
const shuffle = (a, rng) => {
  for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
};
const deck = (n = 1) => Array.from({ length: 52 * n }, (_, i) => i % 52);
const rank = (c) => c % 13; // 0 = 2 ... 8 = 10, 9 = J, 10 = Q, 11 = K, 12 = A
const suit = (c) => Math.floor(c / 13);
const fail = (msg) => { throw new Error(msg); };
const int = (v) => (Number.isInteger(v) ? v : fail('bad_amount'));

/* ================================================================== */
/* BLACKJACK — 6 decks, dealer stands on soft 17, blackjack pays 3:2,  */
/* double on any two, split to 4 hands, double after split.            */
/* ================================================================== */
const BJ_MIN = 10, BJ_MAX = 5000;
const bjCard = (c) => { const r = rank(c); return r === 12 ? 11 : r >= 8 ? 10 : r + 2; };
export function bjTotal(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += bjCard(c); if (rank(c) === 12) aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { total: t, soft: aces > 0 };
}
const isBJ = (cards) => cards.length === 2 && bjTotal(cards).total === 21;

function bjFinish(s) {
  // dealer plays if any hand is still live
  const live = s.hands.some((h) => bjTotal(h.cards).total <= 21);
  if (live) {
    while (true) {
      if (bjTotal(s.dealer).total < 17) { s.dealer.push(s.shoe.pop()); continue; } // stands on all 17s
      break;
    }
  }
  const d = bjTotal(s.dealer).total;
  let payout = 0;
  for (const h of s.hands) {
    const p = bjTotal(h.cards).total;
    if (p > 21) h.result = 'bust';
    else if (d > 21 || p > d) { h.result = 'win'; payout += h.bet * 2; }
    else if (p === d) { h.result = 'push'; payout += h.bet; }
    else h.result = 'lose';
  }
  s.stage = 'done';
  return payout;
}
function bjAdvance(s) {
  const next = s.hands.findIndex((h) => !h.done);
  if (next >= 0) { s.active = next; return 0; }
  return bjFinish(s);
}
function bjAutoStand(s) {
  const h = s.hands[s.active];
  if (bjTotal(h.cards).total >= 21) { h.done = true; return bjAdvance(s); }
  return 0;
}
export const blackjack = {
  deal(s, { bet }, rng) {
    if (s && s.stage !== 'done') fail('hand_in_progress');
    int(bet);
    if (bet < BJ_MIN || bet > BJ_MAX) fail('bet_out_of_range');
    const shoe = shuffle(deck(6), rng);
    const p = [shoe.pop()], d = [shoe.pop()];
    p.push(shoe.pop()); d.push(shoe.pop());
    const st = { stage: 'player', bet, shoe, dealer: d, hands: [{ cards: p, bet, done: false }], active: 0 };
    const pBJ = isBJ(p), dBJ = isBJ(d);
    if (pBJ || dBJ) {
      st.stage = 'done';
      const h = st.hands[0];
      if (pBJ && dBJ) { h.result = 'push'; return { state: st, wager: bet, payout: bet }; }
      if (pBJ) { h.result = 'blackjack'; return { state: st, wager: bet, payout: bet + Math.floor(bet * 1.5) }; }
      h.result = 'lose'; st.dealerBJ = true;
      return { state: st, wager: bet, payout: 0 };
    }
    return { state: st, wager: bet, payout: bjAutoStand(st) };
  },
  hit(s) {
    if (!s || s.stage !== 'player') fail('no_hand');
    const h = s.hands[s.active];
    h.cards.push(s.shoe.pop());
    if (bjTotal(h.cards).total >= 21) { h.done = true; return { state: s, wager: 0, payout: bjAdvance(s) }; }
    return { state: s, wager: 0, payout: 0 };
  },
  stand(s) {
    if (!s || s.stage !== 'player') fail('no_hand');
    s.hands[s.active].done = true;
    return { state: s, wager: 0, payout: bjAdvance(s) };
  },
  double(s) {
    if (!s || s.stage !== 'player') fail('no_hand');
    const h = s.hands[s.active];
    if (h.cards.length !== 2 || h.splitAces) fail('cannot_double');
    const extra = h.bet;
    h.bet *= 2; h.doubled = true;
    h.cards.push(s.shoe.pop());
    h.done = true;
    return { state: s, wager: extra, payout: bjAdvance(s) };
  },
  split(s) {
    if (!s || s.stage !== 'player') fail('no_hand');
    const h = s.hands[s.active];
    if (h.cards.length !== 2 || bjCard(h.cards[0]) !== bjCard(h.cards[1]) || s.hands.length >= 4 || h.splitAces) fail('cannot_split');
    const aces = rank(h.cards[0]) === 12;
    const second = { cards: [h.cards.pop(), s.shoe.pop()], bet: h.bet, done: false, split: true };
    h.cards.push(s.shoe.pop()); h.split = true;
    if (aces) { h.splitAces = second.splitAces = true; h.done = second.done = true; }
    s.hands.splice(s.active + 1, 0, second);
    let payout = 0;
    if (aces) payout = bjAdvance(s);
    else payout = bjAutoStand(s);
    return { state: s, wager: second.bet, payout };
  },
};
export function bjView(s) {
  if (!s) return null;
  const done = s.stage === 'done';
  const { shoe, ...rest } = s;
  const v = { ...rest, dealer: done ? s.dealer : [s.dealer[0]], hands: s.hands.map((h) => ({ ...h, total: bjTotal(h.cards).total })) };
  v.dealerTotal = bjTotal(v.dealer).total;
  if (!done) {
    const h = s.hands[s.active];
    v.can = {
      double: h.cards.length === 2 && !h.splitAces,
      split: h.cards.length === 2 && bjCard(h.cards[0]) === bjCard(h.cards[1]) && s.hands.length < 4 && !h.splitAces,
    };
  }
  return v;
}

/* ================================================================== */
/* POKER HAND EVALUATION                                               */
/* ================================================================== */
export const HAND_NAMES = ['High Card', 'Pair', 'Two Pair', 'Three of a Kind', 'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'Royal Flush'];
function eval5(cs) {
  const rs = cs.map(rank).sort((a, b) => b - a);
  const flush = cs.every((c) => suit(c) === suit(cs[0]));
  const uniq = [...new Set(rs)];
  let straightHi = -1;
  if (uniq.length === 5) {
    if (rs[0] - rs[4] === 4) straightHi = rs[0];
    else if (rs[0] === 12 && rs[1] === 3) straightHi = 3; // wheel A-2-3-4-5
  }
  const counts = {};
  rs.forEach((r) => (counts[r] = (counts[r] || 0) + 1));
  const groups = Object.entries(counts).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const kick = (arr) => arr.reduce((a, r) => a * 13 + r, 0);
  let cat, tie;
  if (straightHi >= 0 && flush) { cat = straightHi === 12 ? 9 : 8; tie = [straightHi]; }
  else if (groups[0][0] === 4) { cat = 7; tie = [groups[0][1], groups[1][1]]; }
  else if (groups[0][0] === 3 && groups[1][0] === 2) { cat = 6; tie = [groups[0][1], groups[1][1]]; }
  else if (flush) { cat = 5; tie = rs; }
  else if (straightHi >= 0) { cat = 4; tie = [straightHi]; }
  else if (groups[0][0] === 3) { cat = 3; tie = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2 && groups[1][0] === 2) { cat = 2; tie = groups.map((g) => g[1]); }
  else if (groups[0][0] === 2) { cat = 1; tie = groups.map((g) => g[1]); }
  else { cat = 0; tie = rs; }
  while (tie.length < 5) tie.push(0);
  return { score: cat * 13 ** 5 + kick(tie), cat, cards: cs };
}
// Best 5-card hand from 5, 6 or 7 cards.
export function best7(cards) {
  let best = null;
  const n = cards.length;
  const pick = (start, chosen) => {
    if (chosen.length === 5) { const e = eval5(chosen); if (!best || e.score > best.score) best = e; return; }
    for (let i = start; i <= n - (5 - chosen.length); i++) pick(i + 1, [...chosen, cards[i]]);
  };
  pick(0, []);
  return best;
}

/* ================================================================== */
/* ULTIMATE TEXAS HOLD'EM                                              */
/* ================================================================== */
const UTH_MIN = 10, UTH_MAX = 2500, TRIPS_MAX = 1000;
const BLIND_PAY = { 9: 500, 8: 50, 7: 10, 6: 3, 5: 1.5, 4: 1 }; // pays X:1, else push
const TRIPS_PAY = { 9: 50, 8: 40, 7: 30, 6: 8, 5: 7, 4: 4, 3: 3 };
function uthResolve(s, playMult) {
  const pb = best7([...s.player, ...s.board]);
  const db = best7([...s.dealer, ...s.board]);
  const a = s.ante;
  let payout = 0;
  const res = { player: { cat: pb.cat, cards: pb.cards }, dealer: { cat: db.cat, cards: db.cards } };
  // Trips side bet pays on the player's hand even after a fold
  if (s.trips) {
    const m = TRIPS_PAY[pb.cat];
    res.trips = m ? s.trips * (1 + m) : 0;
    payout += res.trips;
  }
  if (playMult === 0) {
    res.outcome = 'fold'; res.ante = res.blind = res.play = 0;
  } else {
    const play = a * playMult;
    s.play = play;
    const qualifies = db.cat >= 1;
    res.dealerQualifies = qualifies;
    if (pb.score > db.score) {
      res.outcome = 'win';
      res.play = play * 2;
      res.ante = qualifies ? a * 2 : a;
      res.blind = BLIND_PAY[pb.cat] ? a + Math.floor(a * BLIND_PAY[pb.cat]) : a;
    } else if (pb.score === db.score) {
      res.outcome = 'push'; res.play = play; res.ante = a; res.blind = a;
    } else {
      res.outcome = 'lose'; res.play = 0; res.ante = qualifies ? 0 : a; res.blind = 0;
    }
    payout += res.play + res.ante + res.blind;
  }
  res.total = payout;
  s.result = res;
  s.stage = 'done';
  return payout;
}
export const uth = {
  deal(s, { ante, trips = 0 }, rng) {
    if (s && s.stage !== 'done') fail('hand_in_progress');
    int(ante); int(trips);
    if (ante < UTH_MIN || ante > UTH_MAX || trips < 0 || trips > TRIPS_MAX) fail('bet_out_of_range');
    const d = shuffle(deck(1), rng);
    const st = { stage: 'preflop', ante, trips, play: 0, player: [d.pop(), d.pop()], dealer: [d.pop(), d.pop()], board: [d.pop(), d.pop(), d.pop(), d.pop(), d.pop()] };
    return { state: st, wager: ante * 2 + trips, payout: 0 };
  },
  bet(s, { mult }) {
    if (!s || s.stage === 'done') fail('no_hand');
    const ok = { preflop: [3, 4], flop: [2], river: [1] }[s.stage];
    if (!ok.includes(mult)) fail('bad_bet');
    return { state: s, wager: s.ante * mult, payout: uthResolve(s, mult) };
  },
  check(s) {
    if (!s || (s.stage !== 'preflop' && s.stage !== 'flop')) fail('cannot_check');
    s.stage = s.stage === 'preflop' ? 'flop' : 'river';
    return { state: s, wager: 0, payout: 0 };
  },
  fold(s) {
    if (!s || s.stage !== 'river') fail('cannot_fold');
    return { state: s, wager: 0, payout: uthResolve(s, 0) };
  },
};
export function uthView(s) {
  if (!s) return null;
  const done = s.stage === 'done';
  const shown = { preflop: 0, flop: 3, river: 5, done: 5 }[s.stage];
  return { ...s, dealer: done ? s.dealer : null, board: s.board.slice(0, shown), current: shown >= 3 ? best7([...s.player, ...s.board.slice(0, shown)]).cat : (rank(s.player[0]) === rank(s.player[1]) ? 1 : 0) };
}

/* ================================================================== */
/* ROULETTE — European single zero                                     */
/* ================================================================== */
export const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const RL_MAX_BET = 5000, RL_MAX_TOTAL = 25000;
export function rouletteCovers(key) {
  const [k, arg] = key.split(':');
  const nums = Array.from({ length: 36 }, (_, i) => i + 1);
  switch (k) {
    case 'n': { const n = +arg; return Number.isInteger(n) && n >= 0 && n <= 36 && String(n) === arg ? [n] : null; }
    case 'red': return RED;
    case 'black': return nums.filter((n) => !RED.includes(n));
    case 'odd': return nums.filter((n) => n % 2);
    case 'even': return nums.filter((n) => !(n % 2));
    case 'low': return nums.filter((n) => n <= 18);
    case 'high': return nums.filter((n) => n >= 19);
    case 'dozen': return ['1', '2', '3'].includes(arg) ? nums.filter((n) => Math.ceil(n / 12) === +arg) : null;
    case 'col': return ['1', '2', '3'].includes(arg) ? nums.filter((n) => ((n - 1) % 3) + 1 === +arg) : null;
    default: return null;
  }
}
export const roulette = {
  spin(_s, { bets }, rng) {
    if (!bets || typeof bets !== 'object') fail('no_bets');
    const entries = Object.entries(bets).filter(([, v]) => v);
    if (!entries.length || entries.length > 60) fail('no_bets');
    let total = 0;
    for (const [key, amt] of entries) {
      int(amt);
      if (amt < 1 || amt > RL_MAX_BET || !rouletteCovers(key)) fail('bad_bet');
      total += amt;
    }
    if (total > RL_MAX_TOTAL) fail('over_table_limit');
    const n = Math.floor(rng() * 37);
    let payout = 0;
    const wins = {};
    for (const [key, amt] of entries) {
      const cov = rouletteCovers(key);
      if (cov.includes(n)) { wins[key] = amt * (36 / cov.length); payout += wins[key]; }
    }
    return { state: { number: n, wins, bets: Object.fromEntries(entries), stage: 'done' }, wager: total, payout };
  },
};

/* ================================================================== */
/* CRAPS                                                               */
/* ================================================================== */
const CR_MAX = 5000;
const POINTS = [4, 5, 6, 8, 9, 10];
const ODDS_MAX = { 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 }; // 3-4-5x odds
const ODDS_PAY = { 4: 2, 10: 2, 5: 1.5, 9: 1.5, 6: 1.2, 8: 1.2 };
const PLACE_PAY = { 4: 1.8, 10: 1.8, 5: 1.4, 9: 1.4, 6: 7 / 6, 8: 7 / 6 };
const HARD_PAY = { 4: 7, 10: 7, 6: 9, 8: 9 };
const CR_KEYS = ['pass', 'dontpass', 'odds', 'come', 'field', 'any7', 'anycraps', 'yo',
  ...POINTS.map((n) => 'place' + n), ...[4, 6, 8, 10].map((n) => 'hard' + n)];
export const crapsKeys = CR_KEYS;
const emptyCraps = () => ({ point: null, bets: {}, comePts: {}, last: null, stage: 'idle' });
export const craps = {
  roll(s, { add = {} }, rng) {
    s = s && s.bets ? s : emptyCraps();
    const b = s.bets;
    let wager = 0;
    for (const [key, amt] of Object.entries(add)) {
      if (!amt) continue;
      int(amt);
      if (!CR_KEYS.includes(key) || amt < 1) fail('bad_bet');
      if ((key === 'pass' || key === 'dontpass') && s.point) fail('line_bets_on_comeout_only');
      if (key === 'come' && !s.point) fail('come_needs_point');
      if (key === 'odds') {
        if (!s.point || !b.pass) fail('odds_need_pass_and_point');
        if ((b.odds || 0) + amt > b.pass * ODDS_MAX[s.point]) fail('odds_over_max');
      }
      if ((b[key] || 0) + amt > CR_MAX) fail('over_table_limit');
      b[key] = (b[key] || 0) + amt;
      wager += amt;
    }
    if (!Object.values(b).some(Boolean) && !Object.values(s.comePts).some(Boolean)) fail('no_bets');

    const d1 = 1 + Math.floor(rng() * 6), d2 = 1 + Math.floor(rng() * 6), t = d1 + d2;
    const hard = d1 === d2;
    let payout = 0;
    const out = {}; // key -> { won: amountReturned } or { lost: amount }
    const win = (key, ret) => { payout += ret; out[key] = { won: ret }; };
    const lose = (key, amt) => { out[key] = { lost: amt }; };
    const take = (key) => { const v = b[key] || 0; delete b[key]; return v; };

    // one-roll bets
    if (b.field) { const a = take('field'); [3, 4, 9, 10, 11].includes(t) ? win('field', a * 2) : t === 2 ? win('field', a * 3) : t === 12 ? win('field', a * 4) : lose('field', a); }
    if (b.any7) { const a = take('any7'); t === 7 ? win('any7', a * 5) : lose('any7', a); }
    if (b.anycraps) { const a = take('anycraps'); [2, 3, 12].includes(t) ? win('anycraps', a * 8) : lose('anycraps', a); }
    if (b.yo) { const a = take('yo'); t === 11 ? win('yo', a * 16) : lose('yo', a); }

    // place and hardways: off on the come-out roll; winners stay up and pay profit
    if (s.point) {
      for (const n of POINTS) {
        const k = 'place' + n;
        if (!b[k]) continue;
        if (t === 7) lose(k, take(k));
        else if (t === n) win(k, Math.floor(b[k] * PLACE_PAY[n]));
      }
      for (const n of [4, 6, 8, 10]) {
        const k = 'hard' + n;
        if (!b[k]) continue;
        if (t === 7 || (t === n && !hard)) lose(k, take(k));
        else if (t === n && hard) win(k, b[k] * HARD_PAY[n]);
      }
    }
    // existing come points (always working)
    for (const n of POINTS) {
      const a = s.comePts[n];
      if (!a) continue;
      if (t === 7) { lose('come' + n, a); delete s.comePts[n]; }
      else if (t === n) { win('come' + n, a * 2); delete s.comePts[n]; }
    }
    // new come bet
    if (b.come) {
      const a = take('come');
      if (t === 7 || t === 11) win('come', a * 2);
      else if ([2, 3, 12].includes(t)) lose('come', a);
      else { s.comePts[t] = (s.comePts[t] || 0) + a; out.come = { moved: t }; }
    }
    // line bets
    if (!s.point) {
      if (t === 7 || t === 11) { if (b.pass) win('pass', take('pass') * 2); if (b.dontpass) lose('dontpass', take('dontpass')); }
      else if (t === 2 || t === 3) { if (b.pass) lose('pass', take('pass')); if (b.dontpass) win('dontpass', take('dontpass') * 2); }
      else if (t === 12) { if (b.pass) lose('pass', take('pass')); if (b.dontpass) out.dontpass = { push: true }; }
      else { s.point = t; out.point = { set: t }; }
    } else if (t === s.point) {
      if (b.pass) win('pass', take('pass') * 2);
      if (b.odds) win('odds', b.odds + Math.floor(take('odds') * ODDS_PAY[t]));
      if (b.dontpass) lose('dontpass', take('dontpass'));
      out.point = { hit: t };
      s.point = null;
    } else if (t === 7) {
      if (b.pass) lose('pass', take('pass'));
      if (b.odds) lose('odds', take('odds'));
      if (b.dontpass) win('dontpass', take('dontpass') * 2);
      out.point = { sevenOut: true };
      s.point = null;
    }
    s.last = { d1, d2, total: t, out };
    s.stage = 'idle';
    return { state: s, wager, payout };
  },
  takedown(s, { key }) {
    if (!s || !s.bets) fail('no_bets');
    const ok = key.startsWith('place') || key.startsWith('hard') || key === 'odds';
    if (!ok || !s.bets[key]) fail('cannot_take_down');
    const a = s.bets[key];
    delete s.bets[key];
    s.last = null;
    return { state: s, wager: 0, payout: a };
  },
};
export const crapsView = (s) => s || emptyCraps();

export const TABLES = {
  blackjack: { engine: blackjack, view: bjView },
  uth: { engine: uth, view: uthView },
  roulette: { engine: roulette, view: (s) => s },
  craps: { engine: craps, view: crapsView },
};

export function act(game, state, action, params, rng = cryptoRng) {
  const t = TABLES[game] || fail('unknown_game');
  const fn = t.engine[action];
  if (typeof fn !== 'function') fail('bad_action');
  const copy = state ? JSON.parse(JSON.stringify(state)) : null;
  const r = fn(copy, params || {}, rng);
  return { ...r, view: t.view(r.state) };
}
