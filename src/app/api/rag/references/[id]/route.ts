import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";
import { findCrossReferences } from "@/modules/reference-search";
import type { RetrievedChunk } from "@/shared/rag-types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/rag/references/:id — referências cruzadas de um artigo (id = articleId). */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      document: { select: { id: true, name: true, createdAt: true } },
      chapter: { select: { label: true } },
      section: { select: { label: true } },
      chunks: { orderBy: { part: "asc" } },
    },
  });
  if (!article) {
    return NextResponse.json({ error: "Artigo não encontrado." }, { status: 404 });
  }

  const pseudoChunks: RetrievedChunk[] = article.chunks.map((chunk) => ({
    chunkId: chunk.id,
    content: chunk.content,
    documentId: article.document.id,
    documentName: article.document.name,
    documentCreatedAt: article.document.createdAt.toISOString(),
    articleId: article.id,
    articleLabel: article.label,
    chapterLabel: article.chapter?.label ?? null,
    sectionLabel: article.section?.label ?? null,
    enrichment: (chunk.enrichment as Record<string, unknown> | null) ?? null,
    distance: null,
    rerankScore: null,
    stage: "VECTOR",
    reason: "",
  }));

  const matches = await findCrossReferences(pseudoChunks);
  return NextResponse.json(
    matches.map((m) => ({
      reference: m.reference,
      documentId: m.documentId,
      documentName: m.documentName,
    }))
  );
}
