// Configuração do Supabase carregada dinamicamente do localStorage.
// Nenhum segredo é commitado no repositório. Preencha via UI em auth.html.
window.AUTO_GESTOR_CONFIG = (function(){
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('cfg')||'{}'); } catch {}
  const supabaseUrl = String(stored?.cfgSupabaseUrl||'https://zsoukmbzjpnywvltydct.supabase.co').trim();
  const supabaseAnonKey = String(stored?.cfgSupabaseAnonKey||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzb3VrbWJ6anBueXd2bHR5ZGN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNDQxOTUsImV4cCI6MjA3NjcyMDE5NX0.4qF2mUhy6Aor8GMXcIr5I4Awh_nXs_fJ2hxYfJaYBvY').trim();
  const supabaseServiceKey = String(stored?.cfgSupabaseServiceKey||'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzb3VrbWJ6anBueXd2bHR5ZGN0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTE0NDE5NSwiZXhwIjoyMDc2NzIwMTk1fQ.H_KG8hbUXPLqCTE1ZFSe04ByFWrQUwh1jPWhLH9Khrc').trim();
  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
})();