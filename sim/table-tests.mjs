import assert from 'node:assert/strict';
import { act } from '../supabase/functions/table/tables.js';
const C = (s) => { const r = '23456789TJQKA'.indexOf(s[0]), u = 'shdc'.indexOf(s[1]); return u * 13 + r; };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
// --- UTH: craft a state and resolve
const uthState = (p, d, b, ante = 10, trips = 0) => ({ stage: 'preflop', ante, trips, play: 0, player: p.map(C), dealer: d.map(C), board: b.map(C) });
let r = act('uth', uthState(['As', 'Ks'], ['2c', '7d'], ['Qs', 'Js', 'Ts', '3h', '4d'], 10, 5), 'bet', { mult: 4 });
assert.equal(r.state.result.outcome, 'win'); assert.equal(r.state.result.dealerQualifies, false);
assert.equal(r.state.result.blind, 10 + 5000); assert.equal(r.state.result.ante, 10); assert.equal(r.state.result.play, 80);
assert.equal(r.state.result.trips, 5 * 51); // royal on trips 50:1
r = act('uth', uthState(['2h', '7c'], ['As', 'Ad'], ['Kd', '9s', '5c', '3h', 'Jd']), 'check'); r = act('uth', r.state, 'check'); r = act('uth', r.state, 'fold');
assert.equal(r.payout, 0); assert.equal(r.state.result.outcome, 'fold');
r = act('uth', uthState(['Ah', 'Kc'], ['Ad', 'Kd'], ['2s', '7s', '9c', 'Jh', '4d']), 'bet', { mult: 3 }); // exact tie
assert.equal(r.state.result.outcome, 'push'); assert.equal(r.payout, 10 + 10 + 30);
r = act('uth', uthState(['8h', '8c'], ['Qd', 'Qc'], ['2s', '7s', '9c', 'Jh', '4d']), 'bet', { mult: 4 });
assert.equal(r.state.result.outcome, 'lose'); assert.equal(r.payout, 0);
r = act('uth', uthState(['Kh', '9c'], ['Qd', '3c'], ['2s', '7s', '8c', 'Jh', '4d']), 'bet', { mult: 4 }); // dealer no pair, beats player? no: K high wins
assert.equal(r.state.result.outcome, 'win'); assert.equal(r.state.result.ante, 10); assert.equal(r.state.result.blind, 10);
r = act('uth', uthState(['5h', '3c'], ['Kd', '6c'], ['2s', '7s', '8c', 'Jh', '9d']), 'bet', { mult: 4 }); // dealer wins without qualifying -> ante push
assert.equal(r.state.result.outcome, 'lose'); assert.equal(r.state.result.ante, 10); assert.equal(r.payout, 10);
// --- Blackjack: fixed shoe (pop from the end)
const bj = (cards) => { const st = act('blackjack', null, 'deal', { bet: 100 }, () => 0.999999); return st; };
const deal = (p1, d1, p2, d2, ...rest) => {
  const shoe = [...rest].reverse().concat([d2, p2, d1, p1]).map(C); // pop order p1 d1 p2 d2 then rest
  const s = { stage: 'done' };
  const orig = Array.prototype.pop;
  return { s, shoe };
};
const play = (p1, d1, p2, d2, rest, moves) => {
  const shoe = [...rest].reverse().map(C).concat([d2, p2, d1, p1].map(C));
  let st = { stage: 'player', bet: 100, shoe, dealer: [], hands: [{ cards: [], bet: 100, done: false }], active: 0 };
  st.hands[0].cards.push(st.shoe.pop()); st.dealer.push(st.shoe.pop()); st.hands[0].cards.push(st.shoe.pop()); st.dealer.push(st.shoe.pop());
  let tot = 0; let res = { state: st };
  for (const m of moves) { res = act('blackjack', res.state, m); tot += res.payout; }
  return { res, tot };
};
let t = play('Th', '6c', '5h', 'Td', ['6s', '9c'], ['double']); // 21 vs 16, dealer draws 9 -> bust
assert.equal(t.tot, 400); assert.equal(t.res.state.hands[0].result, 'win');
t = play('8h', '9c', '8d', 'Td', ['3s', 'Th', 'Ks', '2c'], ['split', 'stand', 'stand']); // 11 then 18 vs 19... hands: 8+3=11 stand?, 8+T=18
assert.equal(t.res.state.hands.length, 2); assert.equal(t.res.state.stage, 'done');
t = play('Th', '7c', '9h', 'Td', ['5s'], ['stand']); // 19 vs 17
assert.equal(t.tot, 200);
t = play('Th', '7c', '7h', 'Td', ['5s'], ['hit']); // 22 bust
assert.equal(t.tot, 0); assert.equal(t.res.state.hands[0].result, 'bust');
// natural blackjack 3:2
const natural = act('blackjack', null, 'deal', { bet: 100 }, seq(0));
assert.ok(['player', 'done'].includes(natural.state.stage));
// --- Craps: fixed dice
const dice = (...pairs) => seq(...pairs.flat().map((d) => (d - 1) / 6 + 0.01));
let s = act('craps', null, 'roll', { add: { pass: 10 } }, dice([3, 3])); // point 6
assert.equal(s.state.point, 6);
s = act('craps', s.state, 'roll', { add: { odds: 50, place8: 12, hard8: 5, come: 10 } }, dice([4, 4])); // hard 8: place8 +14, hard8 +45, come moves to 8
assert.equal(s.payout, 14 + 45); assert.equal(s.state.comePts[8], 10); assert.equal(s.wager, 77);
s = act('craps', s.state, 'roll', { add: {} }, dice([2, 4])); // point 6 hit: pass 20, odds 50+60
assert.equal(s.payout, 20 + 110); assert.equal(s.state.point, null);
s = act('craps', s.state, 'roll', { add: { field: 10 } }, dice([1, 1])); // come-out 2: field 3x
assert.equal(s.payout, 30);
s = act('craps', s.state, 'roll', { add: { pass: 10 } }, dice([3, 4])); // come-out 7: pass wins, come 8 loses, place/hard off
assert.equal(s.payout, 20); assert.equal(s.state.comePts[8], undefined); assert.equal(s.state.bets.place8, 12);
// --- Roulette
let rl = act('roulette', null, 'spin', { bets: { 'n:17': 10, red: 10, 'dozen:2': 10, 'col:2': 10, even: 10 } }, () => 17 / 37 + 0.001);
assert.equal(rl.state.number, 17); assert.equal(rl.payout, 360 + 0 + 30 + 30 + 0); // 17 is black, odd, dozen 2, column 2
assert.throws(() => act('roulette', null, 'spin', { bets: { 'n:37': 5 } }));
assert.throws(() => act('roulette', null, 'spin', { bets: { 'n:05': 5 } }));
console.log('all table tests passed');
