import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Detalhe do documento com artefatos e contadores. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      extractedText: true,
      cleanedText: true,
      structureJson: true,
      extractionMeta: true,
      cleaningStats: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          tokens: true,
          chapters: true,
          articles: true,
          chunks: true,
          embeddings: true,
          figures: true,
        },
      },
    },
  });
  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  const indexedCount = await prisma.embedding.count({
    where: { documentId: id, indexed: true },
  });
  return NextResponse.json({ ...document, indexedCount });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.document.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
