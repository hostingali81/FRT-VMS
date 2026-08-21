const fs = require('fs');
for (const line of fs.readFileSync('.env.local','utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2];
}
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) return console.error(error);
  console.log('=== AUTH USERS ===');
  for (const u of data.users) console.log(u.id, '|', u.email);
  const { data: divs } = await sb.from('divisions').select('id,name,circle_id');
  const { data: circles } = await sb.from('circles').select('id,name');
  console.log('=== CIRCLES ==='); circles.forEach(c=>console.log(c.id,'|',c.name));
  console.log('=== DIVISIONS ==='); divs.forEach(d=>console.log(d.id,'|',d.name,'| circle',d.circle_id));
})();
