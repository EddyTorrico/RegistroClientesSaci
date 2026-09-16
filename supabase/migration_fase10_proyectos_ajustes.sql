-- SACIPETROL S.R.L. — Fase 10: ajustes a Proyectos
-- Agrega datos de contacto y fecha/hora de presentación al proyecto.
-- No elimina datos existentes. Idempotente.

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contact_name text;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS presentation_at timestamptz;

COMMIT;

-- Verificación
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name IN ('contact_name', 'presentation_at')
ORDER BY column_name;
