-- SACIPETROL CRM - Fase 6
-- Grupos/Subgrupos de productos + filtro estricto de inventario por periodo

BEGIN;

-- 1) Jerarquía de categorías: grupo (parent_id NULL) / subgrupo (parent_id = grupo)
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS parent_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_parent_id_fkey'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id)
      REFERENCES public.categories(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'categories_no_self_parent'
      AND conrelid = 'public.categories'::regclass
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_no_self_parent
      CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS categories_parent_idx
ON public.categories(parent_id);

-- La versión anterior tenía nombre único global. Para grupos/subgrupos conviene:
-- - nombre de grupo único entre grupos
-- - nombre de subgrupo único dentro de su grupo
DROP INDEX IF EXISTS public.categories_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS categories_group_name_unique
ON public.categories(lower(name))
WHERE parent_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS categories_subgroup_name_unique
ON public.categories(parent_id, lower(name))
WHERE parent_id IS NOT NULL;

COMMIT;

-- Verificación
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'categories'
  AND column_name IN ('id','name','parent_id')
ORDER BY ordinal_position;

SELECT
  COUNT(*) FILTER (WHERE parent_id IS NULL) AS grupos,
  COUNT(*) FILTER (WHERE parent_id IS NOT NULL) AS subgrupos
FROM public.categories;
