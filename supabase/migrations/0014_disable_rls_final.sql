-- =====================================================
-- SCRIPT PARA DESABILITAR RLS - SOLUÇÃO DEFINITIVA
-- =====================================================
-- Este script desabilita Row Level Security (RLS) nas tabelas
-- relacionadas ao sistema de usuários para permitir operações
-- normais sem autenticação JWT do Supabase.

-- Desabilitar RLS na tabela users
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS na tabela user_activity_log
ALTER TABLE user_activity_log DISABLE ROW LEVEL SECURITY;

-- Desabilitar RLS na tabela user_sessions (se existir)
ALTER TABLE IF EXISTS user_sessions DISABLE ROW LEVEL SECURITY;

-- Remover políticas RLS existentes (se houver)
DROP POLICY IF EXISTS "users_policy" ON users;
DROP POLICY IF EXISTS "user_activity_log_policy" ON user_activity_log;
DROP POLICY IF EXISTS "user_sessions_policy" ON user_sessions;

-- Garantir que as tabelas sejam acessíveis publicamente
GRANT ALL ON users TO anon;
GRANT ALL ON users TO authenticated;
GRANT ALL ON user_activity_log TO anon;
GRANT ALL ON user_activity_log TO authenticated;
GRANT ALL ON user_sessions TO anon;
GRANT ALL ON user_sessions TO authenticated;

-- Comentários para documentação
COMMENT ON TABLE users IS 'Tabela de usuários com RLS desabilitado para permitir operações diretas';
COMMENT ON TABLE user_activity_log IS 'Log de atividades dos usuários com RLS desabilitado';

-- Verificar status das tabelas
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('users', 'user_activity_log', 'user_sessions')
    AND schemaname = 'public';