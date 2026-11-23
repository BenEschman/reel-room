import { GAMES, MAX_WIN } from '../supabase/functions/spin/engine.js';
const N = +process.argv[2] || 200000;
const only = process.argv[3];
for (const [id, fn] of Object.entries(GAMES)) {
  if (only && id !== only) continue;
  let total = 0, hits = 0, feats = 0, max = 0, sq = 0;
  for (let i = 0; i < N; i++) {
    const r = fn(Math.random);
    const t = Math.min(r.total, MAX_WIN);
    total += t; sq += t * t;
    if (t > 0) hits++;
    if (r.fsAwarded || r.hold || (r.spins && r.spins.length > 1)) feats++;
    if (t > max) max = t;
  }
  const rtp = total / N;
  const sd = Math.sqrt(sq / N - rtp * rtp);
  console.log(`${id.padEnd(15)} RTP ${(rtp * 100).toFixed(2)}%  ±${(196 * sd / Math.sqrt(N)).toFixed(2)}  hit ${(hits / N * 100).toFixed(1)}%  feature 1/${(N / Math.max(1, feats)).toFixed(0)}  max ${max.toFixed(0)}x`);
}
