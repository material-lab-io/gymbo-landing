/**
 * seed.ts — Demo data seeder for HeroDemo capture
 *
 * Seeds a local Supabase instance with a test trainer + demo clients +
 * punch records so the capture script can take meaningful screenshots.
 *
 * Idempotent: safe to run multiple times. On conflict the existing data
 * is left in place (or replaced for trainer, since its PK must match
 * the Supabase auth user ID).
 *
 * Usage:
 *   npm run seed
 *
 * Env vars:
 *   SUPABASE_URL          (default: http://127.0.0.1:54321)
 *   SUPABASE_SERVICE_KEY  (default: well-known local demo key)
 *
 * Privacy: only fictional demo data. No real phone numbers or trainer
 * credentials are used. The test phone +919999999999 / OTP 123456 is
 * pre-configured in supabase/config.toml as a test OTP — no real SMS
 * is ever sent.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
// The local Supabase demo service-role key is a well-known public value —
// it only grants access to the ephemeral local instance, never production.
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.' +
  'EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const TEST_PHONE = '+919999999999';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function api(path: string, options: RequestInit = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${options.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log(`Seeding demo data at ${SUPABASE_URL}`);

  // ── 1. Ensure auth user exists for test phone ────────────────────────────
  let userId: string;

  try {
    const created = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({ phone: TEST_PHONE, phone_confirm: true }),
    });
    userId = created.id;
    console.log(`  ✓ Created auth user ${userId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('phone_exists')) throw err;
    // User exists — look it up
    const list = await api('/auth/v1/admin/users');
    const user = list.users?.find((u: { phone: string; id: string }) =>
      u.phone === TEST_PHONE || u.phone === TEST_PHONE.replace('+', '')
    );
    if (!user) throw new Error(`Auth user for ${TEST_PHONE} not found after phone_exists conflict`);
    userId = user.id;
    console.log(`  ✓ Auth user exists: ${userId}`);
  }

  // ── 2. Upsert trainer record ─────────────────────────────────────────────
  // Delete any existing trainer row (PK must match auth user ID)
  await fetch(`${SUPABASE_URL}/rest/v1/trainers?phone=eq.${encodeURIComponent(TEST_PHONE)}`, {
    method: 'DELETE',
    headers,
  });

  await api('/rest/v1/trainers', {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ id: userId, phone: TEST_PHONE, name: 'Demo Trainer' }),
  });
  console.log('  ✓ Trainer record created');

  // ── 3. Clear + re-seed clients ───────────────────────────────────────────
  // Clients cascade-delete their punches, so this is safe
  await fetch(`${SUPABASE_URL}/rest/v1/clients?trainer_id=eq.${userId}`, {
    method: 'DELETE',
    headers,
  });

  const now = new Date().toISOString();
  const clients: { id: string; name: string }[] = await api('/rest/v1/clients', {
    method: 'POST',
    headers: { ...headers, 'Prefer': 'return=representation' },
    body: JSON.stringify([
      { trainer_id: userId, name: 'Arjun Sharma',  balance: 8,  current_rate: 600, rate_updated_at: now },
      { trainer_id: userId, name: 'Priya Mehta',   balance: 2,  current_rate: 500, rate_updated_at: now },
      { trainer_id: userId, name: 'Rahul Verma',   balance: 0,  current_rate: 700, rate_updated_at: now },
      { trainer_id: userId, name: 'Kavya Nair',    balance: 12, current_rate: 800, rate_updated_at: now },
    ]),
  });
  console.log(`  ✓ ${clients.length} demo clients seeded`);

  // ── 4. Punch records for Arjun (shows a populated punch card) ───────────
  const arjun = clients.find(c => c.name === 'Arjun Sharma');
  if (arjun) {
    await api('/rest/v1/punches', {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify([
        { client_id: arjun.id, punch_date: '2026-03-02' },
        { client_id: arjun.id, punch_date: '2026-02-28' },
        { client_id: arjun.id, punch_date: '2026-02-26' },
        { client_id: arjun.id, punch_date: '2026-02-24' },
        { client_id: arjun.id, punch_date: '2026-02-21' },
        { client_id: arjun.id, punch_date: '2026-02-19' },
        { client_id: arjun.id, punch_date: '2026-02-17' },
        { client_id: arjun.id, punch_date: '2026-02-14' },
      ]),
    });
    console.log(`  ✓ 8 punch records for Arjun`);
  }

  console.log('\nSeed complete. Ready for capture.');
}

main().catch(err => {
  console.error('\nSeed failed:', err.message ?? err);
  process.exit(1);
});
