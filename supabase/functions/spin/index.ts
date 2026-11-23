import { createClient } from 'npm:@supabase/supabase-js@2';
import { play, GAMES } from './engine.js';

const BETS = [10, 20, 50, 100, 250, 500, 1000];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: 'not_signed_in' }, 401);

  let body: { game?: string; bet?: number };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const game = String(body.game || '');
  const bet = Number(body.bet);
  if (!(game in GAMES)) return json({ error: 'unknown_game' }, 400);
  if (!BETS.includes(bet)) return json({ error: 'bad_bet' }, 400);

  const result = play(game);
  const payout = Math.floor(result.total * bet);
  const { data: balance, error } = await admin.rpc('settle_spin', {
    p_user: user.id, p_game: game, p_bet: bet, p_payout: payout,
  });
  if (error) {
    if (error.message.includes('insufficient_balance')) return json({ error: 'insufficient_balance' }, 400);
    console.error(error);
    return json({ error: 'server_error' }, 500);
  }
  return json({ result, payout, balance });
});
