import { createClient } from 'npm:@supabase/supabase-js@2';
import { act, TABLES } from './tables.js';

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

  let body: { game?: string; action?: string; params?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const game = String(body.game || '');
  const action = String(body.action || '');
  if (!(game in TABLES)) return json({ error: 'unknown_game' }, 400);

  const { data: row } = await admin.from('table_sessions').select('state, version').eq('user_id', user.id).eq('game', game).maybeSingle();
  const state = row?.state ?? null;
  const version = row?.version ?? 0;

  if (action === 'load') {
    const { data: p } = await admin.from('profiles').select('balance').eq('id', user.id).single();
    return json({ view: TABLES[game as keyof typeof TABLES].view(state), balance: p?.balance });
  }

  let r;
  try {
    r = act(game, state, action, body.params || {});
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
  const { data, error } = await admin.rpc('table_commit', {
    p_user: user.id, p_game: game, p_version: version, p_state: r.state, p_wager: r.wager, p_payout: r.payout,
  });
  if (error) {
    const m = error.message;
    if (m.includes('insufficient_balance')) return json({ error: 'insufficient_balance' }, 400);
    if (m.includes('conflict')) return json({ error: 'conflict' }, 409);
    console.error(error);
    return json({ error: 'server_error' }, 500);
  }
  return json({ view: r.view, balance: data.balance, wager: r.wager, payout: r.payout });
});
