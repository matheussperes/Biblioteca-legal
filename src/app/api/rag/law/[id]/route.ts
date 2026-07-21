import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";
import { normalizeText } from "@/shared/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface TimelineEvent {
  chunkId: string;
  articleLabel: string | null;
  tipo: "NOVA_REDACAO" | "REVOGACAO";
  trecho: string;
}

/** GET /api/rag/law/:id — Navegação Jurídica + Linha do Tempo: metadados, árvore e eventos de alteração/revogação. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      structureJson: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { articles: true, chunks: true } },
    },
  });
  if (!document) {
    return NextResponse.json({ error: "Lei não encontrada." }, { status: 404 });
  }

  const [chunks, chapters, sections, articles] = await Promise.all([
    prisma.chunk.findMany({
      where: { documentId: id },
      select: { id: true, content: true, enrichment: true, originArticle: true },
    }),
    prisma.chapter.findMany({ where: { documentId: id }, orderBy: { index: "asc" } }),
    prisma.section.findMany({ where: { documentId: id }, orderBy: { index: "asc" } }),
    prisma.article.findMany({
      where: { documentId: id },
      orderBy: { index: "asc" },
      select: { id: true, label: true, chapterId: true, sectionId: true },
    }),
  ]);

  const timeline: TimelineEvent[] = [];
  for (const chunk of chunks) {
    const enrichment = (chunk.enrichment as Record<string, unknown> | null) ?? {};
    const observacoes = typeof enrichment.observacoes === "string" ? enrichment.observacoes : "";
    const text = normalizeText(`${observacoes} ${chunk.content}`);
    if (/revogad/.test(text)) {
      timeline.push({
        chunkId: chunk.id,
        articleLabel: chunk.originArticle,
        tipo: "REVOGACAO",
        trecho: observacoes || chunk.content.slice(0, 240),
      });
    } else if (/(nova redacao|redacao dada pel)/.test(text)) {
      timeline.push({
        chunkId: chunk.id,
        articleLabel: chunk.originArticle,
        tipo: "NOVA_REDACAO",
        trecho: observacoes || chunk.content.slice(0, 240),
      });
    }
  }

  return NextResponse.json({
    id: document.id,
    name: document.name,
    type: document.type,
    pipelineStatus: document.status,
    structure: document.structureJson,
    articleCount: document._count.articles,
    chunkCount: document._count.chunks,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    situacao: timeline.some((e) => e.tipo === "REVOGACAO") ? "Contém dispositivos possivelmente revogados" : "Vigente",
    timeline,
    chapters,
    sections,
    articles,
  });
}
