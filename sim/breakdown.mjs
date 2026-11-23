import { GAMES } from '../supabase/functions/spin/engine.js';
const N = +process.argv[2] || 100000;
const add = (o, k, v) => (o[k] = (o[k] || 0) + v);
for (const [id, fn] of Object.entries(GAMES)) {
  if (process.argv[3] && id !== process.argv[3]) continue;
  const b = {};
  for (let i = 0; i < N; i++) {
    const r = fn(Math.random);
    if (id === 'wrapped-riches' || id === 'sugar-storm') {
      r.spins.forEach((s, j) => {
        const k = j === 0 ? 'base' : 'fs';
        if (id === 'wrapped-riches') {
          add(b, k + '_lines', s.win - s.collect - s.scatterPay); add(b, k + '_collect', s.collect); add(b, k + '_scatter', s.scatterPay);
        } else { add(b, k + '_tumble', s.win - s.scatterPay); add(b, k + '_scatter', s.scatterPay); }
      });
    } else if (id === 'prism-pop') {
      r.spins.forEach((s, j) => add(b, j === 0 ? 'base' : 'respin', s.win));
    } else {
      add(b, 'lines', r.base.win); if (r.hold) add(b, 'hold', r.hold.win);
    }
  }
  console.log(id, Object.fromEntries(Object.entries(b).map(([k, v]) => [k, (v / N * 100).toFixed(1) + '%'])));
}
