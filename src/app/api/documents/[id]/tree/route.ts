import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Step 4/5 — árvore do parser e JSON definitivo da lei. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    select: { structureJson: true },
  });
  if (!document?.structureJson) {
    return NextResponse.json(
      { error: "Árvore não encontrada — execute o Parser." },
      { status: 404 }
    );
  }
  return NextResponse.json(document.structureJson);
}
