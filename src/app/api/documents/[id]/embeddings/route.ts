import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Steps 8/9 — embeddings (metadados; o vetor em si não é serializado). */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const embeddings = await prisma.embedding.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      chunkId: true,
      model: true,
      dimension: true,
      hash: true,
      durationMs: true,
      indexed: true,
      indexedAt: true,
      metadata: true,
      createdAt: true,
      chunk: { select: { index: true, originArticle: true } },
    },
  });
  return NextResponse.json(embeddings);
}
