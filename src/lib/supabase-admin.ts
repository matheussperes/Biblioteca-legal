import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service role key — uso exclusivo em código de servidor.
 * Usado apenas como relay de upload (bucket "document-uploads") para contornar
 * o limite de corpo de requisição das Serverless Functions da Vercel.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export const UPLOAD_BUCKET = "document-uploads";
