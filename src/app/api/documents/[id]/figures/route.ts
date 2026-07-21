import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Etapa 2 — figuras extraídas via OCR/Vision no Step 1, com vínculo de artigo (Step 6). */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const pageParam = request.nextUrl.searchParams.get("page");
  const page = pageParam ? Number(pageParam) : undefined;

  const figures = await prisma.documentFigure.findMany({
    where: { documentId: id, ...(page ? { page } : {}) },
    orderBy: [{ page: "asc" }, { index: "asc" }],
    select: {
      id: true,
      page: true,
      index: true,
      imageBase64: true,
      width: true,
      height: true,
      description: true,
      ocrText: true,
      articleId: true,
      article: { select: { label: true } },
      chunkId: true,
    },
  });
  return NextResponse.json(figures);
}
