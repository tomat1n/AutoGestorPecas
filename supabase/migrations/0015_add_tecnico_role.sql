-- Adiciona a role 'tecnico' ao conjunto de roles válidas
-- e mantém as políticas existentes (apenas administradores/gerentes podem gerenciar usuários globalmente).

DO $$
BEGIN
  -- Remover a constraint atual se existir
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_role'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT valid_role;
  END IF;

  -- Adicionar nova constraint incluindo 'tecnico'
  ALTER TABLE public.users
    ADD CONSTRAINT valid_role CHECK (
      role IN ('administrador', 'gerente', 'vendedor', 'tecnico')
    );
END $$;

-- Observação:
-- As RLS policies permanecem válidas: técnicos têm acesso somente ao próprio registro.
-- Administradores e gerentes mantêm os privilégios de leitura/gestão definidos nos arquivos anteriores.