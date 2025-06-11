import { createClient } from "@supabase/supabase-js";

// ✅ Validación explícita de variables env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error("Falta la variable de entorno SUPABASE_URL");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("Falta la variable de entorno SUPABASE_ANON_KEY");
}

// 🧠 Cliente Supabase configurado sin persistencia de sesión (uso server-only)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
});
