import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Step 3 — tokens estruturais, com filtro por tipo (?type=ARTIGO,INCISO). */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const typeParam = request.nextUrl.searchParams.get("type");
  const types = typeParam ? typeParam.split(",").map((t) => t.trim()) : undefined;

  const tokens = await prisma.token.findMany({
    where: { documentId: id, ...(types ? { type: { in: types } } : {}) },
    orderBy: { index: "asc" },
    select: {
      id: true,
      index: true,
      type: true,
      text: true,
      position: true,
      startLine: true,
      endLine: true,
    },
  });

  return NextResponse.json(tokens);
}
