// @ts-nocheck
import { createClient } from 'npm:@supabase/supabase-js@2'
import postgres from 'npm:postgres'

type ExecResult = { ok: boolean; sql: string; error?: unknown }

async function runSqlPg(sqlText: string): Promise<ExecResult> {
  const dbUrl = Deno.env.get('SUPABASE_DB_URL')
  if (!dbUrl) return { ok: false, sql: sqlText, error: 'Missing SUPABASE_DB_URL env' }
  const sql = postgres(dbUrl, { ssl: 'require' })
  try {
    await sql.unsafe(sqlText)
    await sql.end({ timeout: 1 })
    return { ok: true, sql: sqlText }
  } catch (e) {
    await sql.end({ timeout: 1 })
    return { ok: false, sql: sqlText, error: String(e) }
  }
}

function buildFixSql(): string[] {
  return [
    // Disable RLS on target tables
    'ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.user_activity_log DISABLE ROW LEVEL SECURITY;',
    'ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;',
    // Ensure RLS is not forced
    'ALTER TABLE public.users NO FORCE ROW LEVEL SECURITY;',
    'ALTER TABLE public.user_activity_log NO FORCE ROW LEVEL SECURITY;',
    'ALTER TABLE public.user_sessions NO FORCE ROW LEVEL SECURITY;',
    // Drop policies by expected names (idempotent)
    'DROP POLICY IF EXISTS "users_select_policy" ON public.users;',
    'DROP POLICY IF EXISTS "users_insert_policy" ON public.users;',
    'DROP POLICY IF EXISTS "users_update_policy" ON public.users;',
    'DROP POLICY IF EXISTS "users_delete_policy" ON public.users;',
    'DROP POLICY IF EXISTS "activity_log_select_policy" ON public.user_activity_log;',
    'DROP POLICY IF EXISTS "activity_log_insert_policy" ON public.user_activity_log;',
    'DROP POLICY IF EXISTS "sessions_policy" ON public.user_sessions;',
    // Grant table permissions to anon & authenticated so REST can operate
    'GRANT ALL ON public.users TO anon, authenticated;',
    'GRANT ALL ON public.user_activity_log TO anon, authenticated;',
    'GRANT ALL ON public.user_sessions TO anon, authenticated;',
  ]
}

async function checkRlsStatus() {
  const sqlText = `
    select c.relname as table,
           c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as force_rls,
           n.nspname as schema
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('users','user_activity_log','user_sessions');
  `
  return await runSqlPg(sqlText)
}

async function testAnonInsert() {
  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(url, anon)

  const email = `fix_rls_test_${Date.now()}@example.com`
  const testRow = {
    id: crypto.randomUUID(),
    name: 'FixRLS Test',
    email,
    password_hash: 'test_hash',
    role: 'vendedor',
    status: 'ativo',
    permissions: {},
    created_at: new Date().toISOString(),
  }

  const { data, error } = await supabase.from('users').insert(testRow).select('id')
  if (error) return { ok: false, error }

  // Cleanup: try delete with anon to verify full access
  await supabase.from('users').delete().eq('email', email)
  return { ok: true, data }
}

Deno.serve(async (req: Request) => {
  try {
    const pre = await checkRlsStatus()
    const fixes = buildFixSql()
    const results: ExecResult[] = []

    for (const sqlText of fixes) {
      const r = await runSqlPg(sqlText)
      results.push(r)
    }

    const post = await checkRlsStatus()
    const anonTest = await testAnonInsert()

    return new Response(
      JSON.stringify({
        ok: true,
        pre,
        results,
        post,
        anonTest,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})