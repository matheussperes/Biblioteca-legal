import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, UPLOAD_BUCKET } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Gera uma URL assinada para o navegador enviar o arquivo direto ao Supabase
 * Storage, sem passar pelo corpo desta requisição — contorna o limite de
 * 4.5 MB das Serverless Functions da Vercel.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name : "";
  if (!name.trim()) {
    return NextResponse.json({ error: "Campo 'name' ausente." }, { status: 400 });
  }

  const path = `${randomUUID()}-${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { data, error } = await supabaseAdmin.storage
    .from(UPLOAD_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Falha ao gerar URL de upload." },
      { status: 500 }
    );
  }

  return NextResponse.json({ path: data.path, signedUrl: data.signedUrl });
}
