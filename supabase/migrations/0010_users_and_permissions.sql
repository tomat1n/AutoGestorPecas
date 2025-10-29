-- Criação da tabela de usuários com sistema de permissões
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'vendedor',
    status VARCHAR(20) NOT NULL DEFAULT 'ativo',
    permissions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    
    CONSTRAINT valid_role CHECK (role IN ('administrador', 'gerente', 'vendedor')),
    CONSTRAINT valid_status CHECK (status IN ('ativo', 'inativo', 'suspenso'))
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir usuário administrador padrão (senha: admin123)
INSERT INTO users (name, email, password_hash, role, status, permissions) VALUES 
(
    'Administrador',
    'admin@autogestorpecas.com',
    '$2b$10$rOvHPxfxFqRfYc.81MpOVOolvgBUHfKUHlVpjdxabvGzRcpXwBLHy', -- admin123
    'administrador',
    'ativo',
    '{
        "dashboard": {"view": true, "edit": true},
        "vendas": {"view": true, "create": true, "edit": true, "delete": true},
        "estoque": {"view": true, "create": true, "edit": true, "delete": true},
        "financeiro": {"view": true, "create": true, "edit": true, "delete": true},
        "clientes": {"view": true, "create": true, "edit": true, "delete": true},
        "fornecedores": {"view": true, "create": true, "edit": true, "delete": true},
        "relatorios": {"view": true, "export": true},
        "configuracoes": {"view": true, "edit": true},
        "usuarios": {"view": true, "create": true, "edit": true, "delete": true}
    }'
);

-- Tabela para log de ações dos usuários
CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    resource_id VARCHAR(100),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para log de atividades
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_action ON user_activity_log(action);

-- Tabela para sessões de usuários
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para sessões
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Função para limpar sessões expiradas
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Políticas RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Política para usuários: administradores podem ver todos, outros só a si mesmos
CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'administrador' OR 
        id = (auth.jwt() ->> 'sub')::uuid
    );

CREATE POLICY "users_insert_policy" ON users
    FOR INSERT WITH CHECK (
        auth.jwt() ->> 'role' IN ('administrador', 'gerente')
    );

CREATE POLICY "users_update_policy" ON users
    FOR UPDATE USING (
        auth.jwt() ->> 'role' = 'administrador' OR 
        (auth.jwt() ->> 'role' = 'gerente' AND role != 'administrador') OR
        (id = (auth.jwt() ->> 'sub')::uuid AND role = role) -- Usuário pode atualizar seus próprios dados, mas não o role
    );

CREATE POLICY "users_delete_policy" ON users
    FOR DELETE USING (
        auth.jwt() ->> 'role' = 'administrador' AND 
        id != (auth.jwt() ->> 'sub')::uuid -- Não pode deletar a si mesmo
    );

-- Política para log de atividades
CREATE POLICY "activity_log_select_policy" ON user_activity_log
    FOR SELECT USING (
        auth.jwt() ->> 'role' IN ('administrador', 'gerente') OR 
        user_id = (auth.jwt() ->> 'sub')::uuid
    );

CREATE POLICY "activity_log_insert_policy" ON user_activity_log
    FOR INSERT WITH CHECK (true); -- Qualquer usuário autenticado pode inserir logs

-- Política para sessões
CREATE POLICY "sessions_policy" ON user_sessions
    FOR ALL USING (
        user_id = (auth.jwt() ->> 'sub')::uuid OR 
        auth.jwt() ->> 'role' = 'administrador'
    );

-- Comentários para documentação
COMMENT ON TABLE users IS 'Tabela de usuários do sistema com controle de permissões baseado em roles';
COMMENT ON COLUMN users.role IS 'Role do usuário: administrador, gerente, vendedor';
COMMENT ON COLUMN users.permissions IS 'Permissões específicas do usuário em formato JSON';
COMMENT ON COLUMN users.status IS 'Status do usuário: ativo, inativo, suspenso';

COMMENT ON TABLE user_activity_log IS 'Log de atividades dos usuários para auditoria';
COMMENT ON TABLE user_sessions IS 'Controle de sessões ativas dos usuários';