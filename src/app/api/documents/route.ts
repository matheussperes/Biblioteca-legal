import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";
import { createDocument } from "@/modules/ingestion";

export const dynamic = "force-dynamic";

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
