import { createClient } from 'npm:@supabase/supabase-js@2';

// Username + password accounts. Users get a placeholder email so no inbox is needed.
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
  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400); }
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return json({ error: 'Username must be 3–20 letters, numbers or _' }, 400);
  if (password.length < 6 || password.length > 72) return json({ error: 'Password must be 6–72 characters' }, 400);

  const { data: taken } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle();
  if (taken) return json({ error: 'That username is taken' }, 409);

  const { error } = await admin.auth.admin.createUser({
    email: `${username.toLowerCase()}@players.example.com`,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error) {
    console.error(error);
    return json({ error: error.message.includes('already') ? 'That username is taken' : 'Could not create account' }, 400);
  }
  return json({ ok: true });
});
