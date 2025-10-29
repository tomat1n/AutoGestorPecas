-- Inserir usuários de exemplo para demonstração do sistema
-- Senhas: admin123, gerente123, vendedor123

-- Usuário Administrador de exemplo (além do padrão)
INSERT INTO users (name, email, password_hash, role, status, permissions) VALUES 
(
    'João Silva - Administrador',
    'joao.admin@autogestorpecas.com',
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

-- Usuário Gerente de exemplo
INSERT INTO users (name, email, password_hash, role, status, permissions) VALUES 
(
    'Maria Santos - Gerente',
    'maria.gerente@autogestorpecas.com',
    '$2b$10$8K9wLVuBix6LcuwlrjgHN.8rGzVcUKLd/OXGYhEXvKFMGzRcpXwBLHy', -- gerente123
    'gerente',
    'ativo',
    '{
        "dashboard": {"view": true, "edit": true},
        "vendas": {"view": true, "create": true, "edit": true, "delete": true},
        "estoque": {"view": true, "create": true, "edit": true, "delete": false},
        "financeiro": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": true, "delete": false},
        "fornecedores": {"view": true, "create": true, "edit": true, "delete": false},
        "relatorios": {"view": true, "export": true},
        "configuracoes": {"view": true, "edit": false},
        "usuarios": {"view": false, "create": false, "edit": false, "delete": false}
    }'
);

-- Usuário Vendedor de exemplo
INSERT INTO users (name, email, password_hash, role, status, permissions) VALUES 
(
    'Carlos Oliveira - Vendedor',
    'carlos.vendedor@autogestorpecas.com',
    '$2b$10$9L0xMWvCjy7MdvxmskhIO.9sHaWdVLMe/PYHZiFYwLGNHaRcpXwBLHy', -- vendedor123
    'vendedor',
    'ativo',
    '{
        "dashboard": {"view": true, "edit": false},
        "vendas": {"view": true, "create": true, "edit": true, "delete": false},
        "estoque": {"view": true, "create": false, "edit": false, "delete": false},
        "financeiro": {"view": false, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": true, "delete": false},
        "fornecedores": {"view": true, "create": false, "edit": false, "delete": false},
        "relatorios": {"view": false, "export": false},
        "configuracoes": {"view": false, "edit": false},
        "usuarios": {"view": false, "create": false, "edit": false, "delete": false}
    }'
);

-- Usuário Vendedor com permissões customizadas
INSERT INTO users (name, email, password_hash, role, status, permissions) VALUES 
(
    'Ana Costa - Vendedora Sênior',
    'ana.vendedora@autogestorpecas.com',
    '$2b$10$9L0xMWvCjy7MdvxmskhIO.9sHaWdVLMe/PYHZiFYwLGNHaRcpXwBLHy', -- vendedor123
    'vendedor',
    'ativo',
    '{
        "dashboard": {"view": true, "edit": false},
        "vendas": {"view": true, "create": true, "edit": true, "delete": true},
        "estoque": {"view": true, "create": true, "edit": true, "delete": false},
        "financeiro": {"view": true, "create": false, "edit": false, "delete": false},
        "clientes": {"view": true, "create": true, "edit": true, "delete": false},
        "fornecedores": {"view": true, "create": false, "edit": false, "delete": false},
        "relatorios": {"view": true, "export": true},
        "configuracoes": {"view": false, "edit": false},
        "usuarios": {"view": false, "create": false, "edit": false, "delete": false}
    }'
);

-- Comentários sobre as senhas dos usuários de exemplo:
-- admin@autogestorpecas.com - Senha: admin123
-- joao.admin@autogestorpecas.com - Senha: admin123  
-- maria.gerente@autogestorpecas.com - Senha: gerente123
-- carlos.vendedor@autogestorpecas.com - Senha: vendedor123
-- ana.vendedora@autogestorpecas.com - Senha: vendedor123