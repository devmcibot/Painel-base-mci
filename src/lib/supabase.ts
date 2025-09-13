// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const anon = process.env.SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE!;

// client para uso no servidor (permite usar o bucket privado)
export const supabaseAdmin = createClient(url, service, {
  auth: { persistSession: false },
});

// client público (se um dia precisar no cliente/browser)
export const supabaseAnon = createClient(url, anon, {
  auth: { persistSession: false },
});
