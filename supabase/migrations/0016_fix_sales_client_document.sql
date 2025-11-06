-- 0016_fix_sales_client_document.sql
-- Garante que a coluna client_document existe na tabela sales

begin;

-- Verifica se a coluna client_document existe na tabela sales
-- Se não existir, adiciona a coluna
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'client_document'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN client_document text;
        RAISE NOTICE 'Coluna client_document adicionada à tabela sales';
    ELSE
        RAISE NOTICE 'Coluna client_document já existe na tabela sales';
    END IF;
END
$$;

-- Garante que todas as colunas necessárias para o histórico de vendas existem
DO $$
BEGIN
    -- client_phone
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'client_phone'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN client_phone text;
        RAISE NOTICE 'Coluna client_phone adicionada à tabela sales';
    END IF;
    
    -- client_email
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'client_email'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN client_email text;
        RAISE NOTICE 'Coluna client_email adicionada à tabela sales';
    END IF;
    
    -- thermal_doc_url
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'thermal_doc_url'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN thermal_doc_url text;
        RAISE NOTICE 'Coluna thermal_doc_url adicionada à tabela sales';
    END IF;
    
    -- a4_doc_url
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'a4_doc_url'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN a4_doc_url text;
        RAISE NOTICE 'Coluna a4_doc_url adicionada à tabela sales';
    END IF;
    
    -- pdf_doc_url
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'sales' 
        AND column_name = 'pdf_doc_url'
    ) THEN
        ALTER TABLE public.sales ADD COLUMN pdf_doc_url text;
        RAISE NOTICE 'Coluna pdf_doc_url adicionada à tabela sales';
    END IF;
END
$$;

commit;