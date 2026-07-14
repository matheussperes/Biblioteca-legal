import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Steps 6/7 — chunks com enriquecimento. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const chunks = await prisma.chunk.findMany({
    where: { documentId: id },
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      content: true,
      tokenCount: true,
      charCount: true,
      part: true,
      totalParts: true,
      originArticle: true,
      originChapter: true,
      originSection: true,
      enrichment: true,
      enrichmentPrompt: true,
      enrichmentResponse: true,
      enrichmentModel: true,
      enrichmentDurationMs: true,
      enrichmentCostUsd: true,
    },
  });
  return NextResponse.json(chunks);
}
