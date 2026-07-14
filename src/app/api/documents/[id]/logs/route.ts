import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Sistema de Logs + histórico de jobs. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const [logs, jobs] = await Promise.all([
    prisma.pipelineLog.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.processingJob.findMany({
      where: { documentId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return NextResponse.json({ logs, jobs });
}
