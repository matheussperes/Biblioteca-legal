import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";
import { createDocument } from "@/modules/ingestion";
import { getSupabaseAdmin, UPLOAD_BUCKET } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Dashboard — lista documentos com contadores. */
export async function GET() {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      sizeBytes: true,
      createdAt: true,
      _count: {
        select: { articles: true, chunks: true, embeddings: true },
      },
    },
  });

  const indexedCounts = await prisma.embedding.groupBy({
    by: ["documentId"],
    where: { indexed: true },
    _count: { _all: true },
  });
  const indexedByDoc = new Map(
    indexedCounts.map((r) => [r.documentId, r._count._all])
  );

  return NextResponse.json(
    documents.map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      status: d.status,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
      articleCount: d._count.articles,
      chunkCount: d._count.chunks,
      embeddingCount: d._count.embeddings,
      indexedCount: indexedByDoc.get(d.id) ?? 0,
    }))
  );
}

/** Tela 1 — Upload (arquivo via multipart ou texto colado via JSON). */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "Campo 'file' ausente." },
          { status: 400 }
        );
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const document = await createDocument({
        name: file.name,
        mimeType: file.type || undefined,
        buffer,
      });
      return NextResponse.json(document, { status: 201 });
    }

    const body = await request.json();

    // Arquivo grande: já foi enviado direto ao Supabase Storage pelo
    // navegador (ver /api/documents/upload-url). Aqui só baixamos os bytes
    // e descartamos o objeto temporário — o armazenamento definitivo
    // continua em Document.originalContent, como nos demais fluxos.
    if (typeof body.storagePath === "string" && body.storagePath.trim()) {
      const { data: blob, error } = await getSupabaseAdmin()
        .storage.from(UPLOAD_BUCKET)
        .download(body.storagePath);
      if (error || !blob) {
        return NextResponse.json(
          { error: error?.message ?? "Falha ao recuperar o arquivo enviado." },
          { status: 500 }
        );
      }
      const buffer = Buffer.from(await blob.arrayBuffer());
      const document = await createDocument({
        name: body.name || "Documento",
        mimeType: body.mimeType || undefined,
        buffer,
      });
      await getSupabaseAdmin().storage.from(UPLOAD_BUCKET).remove([body.storagePath]);
      return NextResponse.json(document, { status: 201 });
    }

    if (typeof body.pastedText !== "string" || !body.pastedText.trim()) {
      return NextResponse.json(
        { error: "Campo 'pastedText' ausente ou vazio." },
        { status: 400 }
      );
    }
    const document = await createDocument({
      name: body.name || "Texto colado",
      pastedText: body.pastedText,
    });
    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
