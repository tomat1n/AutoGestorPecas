# Usuários de Exemplo - AutoGestor Peças

## Informações de Acesso

### 👑 Administrador
- **Email:** admin@autogestorpecas.com
- **Senha:** admin123
- **Permissões:** Todas as permissões (acesso completo ao sistema)
- **Descrição:** Usuário com acesso total a todas as funcionalidades

### 👔 Gerente
- **Email:** gerente@autogestorpecas.com
- **Senha:** gerente123
- **Permissões:** 
  - ✅ Visualizar Dashboard
  - ✅ Gerenciar Clientes
  - ✅ Gerenciar Fornecedores
  - ✅ Gerenciar Serviços
  - ✅ Visualizar Relatórios
  - ✅ Gerenciar Contas a Pagar
  - ✅ Gerenciar Contas a Receber
  - ❌ Gerenciar Configurações
  - ❌ Gerenciar Usuários
- **Descrição:** Usuário com permissões de gestão, mas sem acesso às configurações do sistema

### 🛒 Vendedor
- **Email:** vendedor@autogestorpecas.com
- **Senha:** vendedor123
- **Permissões:**
  - ✅ Visualizar Dashboard
  - ✅ Visualizar Clientes
  - ✅ Visualizar Fornecedores
  - ✅ Visualizar Serviços
  - ❌ Gerenciar Clientes
  - ❌ Gerenciar Fornecedores
  - ❌ Gerenciar Serviços
  - ❌ Visualizar Relatórios
  - ❌ Gerenciar Contas a Pagar
  - ❌ Gerenciar Contas a Receber
  - ❌ Gerenciar Configurações
  - ❌ Gerenciar Usuários
- **Descrição:** Usuário com permissões básicas, apenas visualização

## Como Usar

1. **Acesse o sistema** através do arquivo `index.html`
2. **Faça login** com qualquer um dos usuários acima
3. **Teste as permissões** navegando pelas diferentes seções
4. **Observe as diferenças** de acesso entre os tipos de usuário

## Estrutura de Permissões

O sistema utiliza um modelo de permissões baseado em módulos:

- **dashboard_view**: Visualizar dashboard
- **clients_manage**: Gerenciar clientes
- **suppliers_manage**: Gerenciar fornecedores
- **services_manage**: Gerenciar serviços
- **reports_view**: Visualizar relatórios
- **payables_manage**: Gerenciar contas a pagar
- **receivables_manage**: Gerenciar contas a receber
- **settings_manage**: Gerenciar configurações
- **users_manage**: Gerenciar usuários

## Banco de Dados

Os usuários estão definidos na migração SQL `supabase/migrations/0011_example_users.sql` e serão criados automaticamente quando o Supabase for iniciado.

## Segurança

- Todas as senhas são armazenadas com hash bcrypt
- As permissões são verificadas tanto no frontend quanto no backend
- Sessões são gerenciadas de forma segura