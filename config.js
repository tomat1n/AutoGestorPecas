// Configuração do Supabase carregada dinamicamente do localStorage.
// Nenhum segredo é commitado no repositório. Preencha via UI em auth.html.
window.AUTO_GESTOR_CONFIG = (function(){
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem('cfg')||'{}'); } catch {}
  const supabaseUrl = String(stored?.cfgSupabaseUrl||'').trim();
  const supabaseAnonKey = String(stored?.cfgSupabaseAnonKey||'').trim();
  const supabaseServiceKey = String(stored?.cfgSupabaseServiceKey||'').trim();
  return { supabaseUrl, supabaseAnonKey, supabaseServiceKey };
})();