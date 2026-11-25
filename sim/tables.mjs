// Sanity-check table math: each should land near its known house edge.
import { act, bjTotal, best7, crapsKeys } from '../supabase/functions/table/tables.js';
const N = +process.argv[2] || 200000;
const rng = Math.random;
const rank = (c) => c % 13;
const up = (c) => { const r = rank(c); return r === 12 ? 11 : r >= 8 ? 10 : r + 2; };

// Blackjack, basic strategy (S17, DAS)
function bjMove(v) {
  const h = v.hands[v.active], d = up(v.dealer[0]);
  const { total: t, soft } = bjTotal(h.cards);
  if (v.can.split) {
    const p = up(h.cards[0]);
    if (p === 11 || p === 8) return 'split';
    if ((p === 2 || p === 3 || p === 7) && d <= 7) return 'split';
    if (p === 6 && d <= 6) return 'split';
    if (p === 9 && d <= 9 && d !== 7) return 'split';
    if (p === 4 && (d === 5 || d === 6)) return 'split';
  }
  if (soft) {
    if (t >= 19) return 'stand';
    if (t === 18) return d <= 6 && v.can.double && d >= 3 ? 'double' : d <= 8 ? 'stand' : 'hit';
    if (v.can.double && ((t === 17 && d >= 3 && d <= 6) || (t >= 15 && d >= 4 && d <= 6) || (t >= 13 && d >= 5 && d <= 6))) return 'double';
    return 'hit';
  }
  if (t >= 17) return 'stand';
  if (t >= 13) return d <= 6 ? 'stand' : 'hit';
  if (t === 12) return d >= 4 && d <= 6 ? 'stand' : 'hit';
  if (t === 11) return v.can.double ? 'double' : 'hit';
  if (t === 10) return v.can.double && d <= 9 ? 'double' : 'hit';
  if (t === 9) return v.can.double && d >= 3 && d <= 6 ? 'double' : 'hit';
  return 'hit';
}
{
  let w = 0, p = 0;
  for (let i = 0; i < N; i++) {
    let r = act('blackjack', null, 'deal', { bet: 100 }, rng); w += r.wager; p += r.payout;
    while (r.state.stage !== 'done') { r = act('blackjack', r.state, bjMove(r.view), {}, rng); w += r.wager; p += r.payout; }
  }
  console.log('blackjack RTP', (p / w * 100).toFixed(2) + '%   (expect ~99.5%)');
}
// UTH, simple strategy: 4x with any pair or ace; 2x on flop with pair+; call river with pair+ else fold
{
  let w = 0, p = 0;
  for (let i = 0; i < N; i++) {
    let r = act('uth', null, 'deal', { ante: 10, trips: 0 }, rng); w += r.wager; p += r.payout;
    const pl = r.state.player;
    if (rank(pl[0]) === rank(pl[1]) || rank(pl[0]) === 12 || rank(pl[1]) === 12 || (rank(pl[0]) >= 10 && rank(pl[1]) >= 10)) r = act('uth', r.state, 'bet', { mult: 4 }, rng);
    else {
      r = act('uth', r.state, 'check', {}, rng);
      if (best7([...pl, ...r.state.board.slice(0, 3)]).cat >= 2) r = act('uth', r.state, 'bet', { mult: 2 }, rng);
      else { r = act('uth', r.state, 'check', {}, rng); r = act('uth', r.state, best7([...pl, ...r.state.board]).cat >= 1 ? 'bet' : 'fold', { mult: 1 }, rng); }
    }
    w += r.wager; p += r.payout;
  }
  console.log('uth RTP (ante basis, simple strategy)', ((p - w) / (N * 10) * 100).toFixed(2) + '% edge per ante   (optimal ~ -2.2%)');
  let tw = 0, tp = 0;
  for (let i = 0; i < N; i++) { let r = act('uth', null, 'deal', { ante: 10, trips: 10 }, rng); r = act('uth', r.state, 'bet', { mult: 4 }, rng); tw += 10; tp += r.state.result.trips; }
  console.log('trips RTP', (tp / tw * 100).toFixed(2) + '%   (expect ~98.1%)');
}
// Roulette
{
  let w = 0, p = 0;
  for (let i = 0; i < N; i++) { const r = act('roulette', null, 'spin', { bets: { 'n:17': 1, red: 5, 'dozen:2': 3, 'col:1': 2, odd: 4 } }, rng); w += r.wager; p += r.payout; }
  console.log('roulette RTP', (p / w * 100).toFixed(2) + '%   (expect 97.30%)');
}
// Craps: pass + 5x odds, place 6/8, field, hard 8
for (const [name, plan] of [
  ['pass line', { line: 10 }],
  ['pass + odds', { line: 10, odds: true }],
  ['dont pass', { dp: 10 }],
  ['come', { come: 10 }],
  ['place 6', { place6: 12 }],
  ['field', { field: 10 }],
  ['hard 8', { hard8: 10 }],
]) {
  let s = null, w = 0, p = 0;
  for (let i = 0; i < N; i++) {
    const add = {};
    if (plan.line && !s?.point && !s?.bets?.pass) add.pass = plan.line;
    if (plan.dp && !s?.point && !s?.bets?.dontpass) add.dontpass = plan.dp;
    if (plan.odds && s?.point && s.bets.pass && !s.bets.odds) add.odds = plan.line * { 4: 3, 10: 3, 5: 4, 9: 4, 6: 5, 8: 5 }[s.point];
    if (plan.come && s?.point && !s.bets.come) add.come = plan.come;
    if (plan.place6 && !s?.bets?.place6) add.place6 = plan.place6;
    if (plan.field) add.field = plan.field;
    if (plan.hard8 && !s?.bets?.hard8) add.hard8 = plan.hard8;
    if (plan.come && !s?.point && !Object.keys(add).length && !Object.keys(s?.comePts || {}).length) add.pass = 10, w += 0; // need a point to make come bets
    let r;
    try { r = act('craps', s, 'roll', { add }, rng); } catch { s = null; continue; }
    s = r.state; w += r.wager; p += r.payout;
  }
  const held = Object.values(s.bets).reduce((a, x) => a + x, 0) + Object.values(s.comePts).reduce((a, x) => a + x, 0);
  console.log('craps', name.padEnd(12), 'RTP', ((p + held) / w * 100).toFixed(2) + '%');
}
console.log(crapsKeys.length, 'craps bet types');
