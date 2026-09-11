import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

// Cliente principal: se usa en toda la app y mantiene la sesión iniciada.
export const supabase = createClient(supabaseUrl, supabaseKey);

// Cliente secundario, solo para que el Admin cree nuevos usuarios (vendedores, gerentes)
// sin que se cierre su propia sesión al hacerlo.
export const supabaseAdminAuth = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
