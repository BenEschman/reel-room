import { buyFeature, GAMES, MAX_WIN } from '../supabase/functions/spin/engine.js';
const N = +process.argv[2] || 50000;
for (const id of Object.keys(GAMES)) {
  let t = 0, sq = 0, max = 0;
  for (let i = 0; i < N; i++) { const v = buyFeature(id, Math.random).total; t += v; sq += v * v; if (v > max) max = v; }
  const m = t / N, ci = 1.96 * Math.sqrt(sq / N - m * m) / Math.sqrt(N);
  console.log(id.padEnd(15), 'avg', m.toFixed(1) + 'x ±' + ci.toFixed(1), ' price@96%', (m / 0.96).toFixed(0) + 'x', ' max', max.toFixed(0));
}
