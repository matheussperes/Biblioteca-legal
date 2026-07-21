import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";
import { deriveSituacao } from "@/modules/prompt-builder";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/rag/article/:id — Visualizador Jurídico: lei, capítulo, seção, texto integral, resumo, palavras-chave, referências. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const article = await prisma.article.findUnique({
    where: { id },
    include: {
      document: { select: { id: true, name: true, createdAt: true } },
      chapter: { select: { label: true, title: true } },
      section: { select: { label: true, title: true } },
      paragraphs: { orderBy: { index: "asc" }, include: { incisos: { orderBy: { index: "asc" }, include: { alineas: { orderBy: { index: "asc" } } } } } },
      incisos: { where: { paragraphId: null }, orderBy: { index: "asc" }, include: { alineas: { orderBy: { index: "asc" } } } },
      chunks: { orderBy: { part: "asc" } },
    },
  });
  if (!article) {
    return NextResponse.json({ error: "Artigo não encontrado." }, { status: 404 });
  }

  const mainChunk = article.chunks[0];
  const enrichment = (mainChunk?.enrichment as Record<string, unknown> | null) ?? null;
  const situacao = mainChunk
    ? deriveSituacao({
        chunkId: mainChunk.id,
        content: mainChunk.content,
        documentId: article.document.id,
        documentName: article.document.name,
        documentCreatedAt: article.document.createdAt.toISOString(),
        articleId: article.id,
        articleLabel: article.label,
        chapterLabel: article.chapter?.label ?? null,
        sectionLabel: article.section?.label ?? null,
        enrichment,
        distance: null,
        rerankScore: null,
        stage: "VECTOR",
        reason: "",
      })
    : "Vigente";

  return NextResponse.json({
    id: article.id,
    label: article.label,
    number: article.number,
    caput: article.caput,
    fullText: article.fullText,
    lei: article.document.name,
    documentId: article.document.id,
    capitulo: article.chapter ? { label: article.chapter.label, titulo: article.chapter.title } : null,
    secao: article.section ? { label: article.section.label, titulo: article.section.title } : null,
    paragrafos: article.paragraphs.map((p) => ({
      label: p.label,
      texto: p.text,
      incisos: p.incisos.map((i) => ({
        label: i.label,
        texto: i.text,
        alineas: i.alineas.map((a) => ({ label: a.label, texto: a.text })),
      })),
    })),
    incisos: article.incisos.map((i) => ({
      label: i.label,
      texto: i.text,
      alineas: i.alineas.map((a) => ({ label: a.label, texto: a.text })),
    })),
    enrichment,
    situacao,
    chunkIds: article.chunks.map((c) => c.id),
  });
}
