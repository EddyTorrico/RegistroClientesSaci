-- SACIPETROL - FASE 4
-- Semáforos de oportunidades/seguimientos y dashboard comercial
-- Seguro para ejecutar sobre la base existente.

BEGIN;

ALTER TABLE public.opportunities
ADD COLUMN IF NOT EXISTS next_action_date date;

CREATE INDEX IF NOT EXISTS opportunities_next_action_date_idx
ON public.opportunities(next_action_date);

-- Recupera la fecha de próxima acción desde visitas ya registradas cuando sea posible.
UPDATE public.opportunities o
SET next_action_date = v.next_action_date
FROM public.visits v
WHERE v.opportunity_id = o.id
  AND o.next_action_date IS NULL
  AND v.next_action_date IS NOT NULL;

COMMIT;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'opportunities'
  AND column_name = 'next_action_date';
