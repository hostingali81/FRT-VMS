const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  const { data: profiles, error: pe } = await sb.from('user_profiles').select('*');
  if (pe) return console.error('err', pe);
  console.log('=== USER_PROFILES ===');
  for (const p of profiles) console.log(JSON.stringify(p));
})();
