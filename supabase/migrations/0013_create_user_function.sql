-- Função para criar usuários que bypassa RLS
CREATE OR REPLACE FUNCTION create_user_bypass_rls(
    p_name VARCHAR(255),
    p_email VARCHAR(255),
    p_password_hash VARCHAR(255),
    p_role VARCHAR(50) DEFAULT 'vendedor',
    p_status VARCHAR(20) DEFAULT 'ativo',
    p_permissions JSONB DEFAULT '{}',
    p_created_by UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50),
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Inserir usuário diretamente, bypassando RLS
    RETURN QUERY
    INSERT INTO users (name, email, password_hash, role, status, permissions, created_by)
    VALUES (p_name, p_email, p_password_hash, p_role, p_status, p_permissions, p_created_by)
    RETURNING users.id, users.name, users.email, users.role, users.status, users.created_at;
END;
$$;

-- Função para atualizar usuários que bypassa RLS
CREATE OR REPLACE FUNCTION update_user_bypass_rls(
    p_user_id UUID,
    p_name VARCHAR(255),
    p_email VARCHAR(255),
    p_role VARCHAR(50),
    p_status VARCHAR(20),
    p_permissions JSONB
)
RETURNS TABLE(
    id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50),
    status VARCHAR(20),
    updated_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Atualizar usuário diretamente, bypassando RLS
    RETURN QUERY
    UPDATE users 
    SET 
        name = p_name,
        email = p_email,
        role = p_role,
        status = p_status,
        permissions = p_permissions,
        updated_at = NOW()
    WHERE users.id = p_user_id
    RETURNING users.id, users.name, users.email, users.role, users.status, users.updated_at;
END;
$$;

-- Função para deletar usuários que bypassa RLS
CREATE OR REPLACE FUNCTION delete_user_bypass_rls(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM users WHERE id = p_user_id;
    RETURN FOUND;
END;
$$;

-- Função para listar usuários que bypassa RLS
CREATE OR REPLACE FUNCTION get_users_bypass_rls()
RETURNS TABLE(
    id UUID,
    name VARCHAR(255),
    email VARCHAR(255),
    role VARCHAR(50),
    status VARCHAR(20),
    permissions JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT users.id, users.name, users.email, users.role, users.status, 
           users.permissions, users.created_at, users.updated_at, users.last_login
    FROM users
    ORDER BY users.created_at DESC;
END;
$$;

-- Comentários
COMMENT ON FUNCTION create_user_bypass_rls IS 'Função para criar usuários bypassando RLS - para sistema de autenticação customizado';
COMMENT ON FUNCTION update_user_bypass_rls IS 'Função para atualizar usuários bypassando RLS - para sistema de autenticação customizado';
COMMENT ON FUNCTION delete_user_bypass_rls IS 'Função para deletar usuários bypassando RLS - para sistema de autenticação customizado';
COMMENT ON FUNCTION get_users_bypass_rls IS 'Função para listar usuários bypassando RLS - para sistema de autenticação customizado';