import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

/** GET /api/rag/search?q= — Busca Manual por lei, capítulo, seção, artigo, palavra ou tema. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ documents: [], articles: [] });

  const [documents, articles] = await Promise.all([
    prisma.document.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true, type: true, status: true, createdAt: true },
      take: 20,
    }),
    prisma.article.findMany({
      where: {
        OR: [
          { label: { contains: q, mode: "insensitive" } },
          { number: { contains: q, mode: "insensitive" } },
          { fullText: { contains: q, mode: "insensitive" } },
          { document: { is: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      select: {
        id: true,
        label: true,
        caput: true,
        document: { select: { id: true, name: true } },
        chapter: { select: { label: true } },
        section: { select: { label: true } },
      },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    documents,
    articles: articles.map((a) => ({
      id: a.id,
      label: a.label,
      trecho: a.caput.slice(0, 240),
      documentId: a.document.id,
      documentName: a.document.name,
      capitulo: a.chapter?.label ?? null,
      secao: a.section?.label ?? null,
    })),
  });
}
