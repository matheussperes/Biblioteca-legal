import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service role key — uso exclusivo em código de servidor.
 * Usado apenas como relay de upload (bucket "document-uploads") para contornar
 * o limite de corpo de requisição das Serverless Functions da Vercel.
 *
 * Criado sob demanda (não no escopo do módulo): o Next.js avalia as rotas
 * durante "Collecting page data" no build, e criar o client eagerly derruba
 * o build inteiro se as env vars não estiverem disponíveis nesse momento.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return client;
}

export const UPLOAD_BUCKET = "document-uploads";
