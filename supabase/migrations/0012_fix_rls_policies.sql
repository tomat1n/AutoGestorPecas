-- Correção das políticas RLS para permitir operações sem JWT
-- Este sistema usa autenticação customizada, não JWT do Supabase

-- Remover políticas existentes
DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "users_delete_policy" ON users;
DROP POLICY IF EXISTS "activity_log_select_policy" ON user_activity_log;
DROP POLICY IF EXISTS "activity_log_insert_policy" ON user_activity_log;
DROP POLICY IF EXISTS "sessions_policy" ON user_sessions;

-- Desabilitar RLS temporariamente para permitir operações
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions DISABLE ROW LEVEL SECURITY;

-- Comentário explicativo
COMMENT ON TABLE users IS 'Tabela de usuários - RLS desabilitado para sistema de autenticação customizado';
COMMENT ON TABLE user_activity_log IS 'Log de atividades - RLS desabilitado para sistema de autenticação customizado';
COMMENT ON TABLE user_sessions IS 'Sessões de usuários - RLS desabilitado para sistema de autenticação customizado';