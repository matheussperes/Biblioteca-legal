import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/database/client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Exportações — ?format=json | tree | chunks | embeddings | logs
 * (JSON da lei, árvore do parser, chunks, metadados de embeddings, logs).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "json";

  const document = await prisma.document.findUnique({
    where: { id },
    select: { name: true, structureJson: true },
  });
  if (!document) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const filename = (suffix: string) =>
    `${document.name.replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "_")}-${suffix}.json`;

  const structure = document.structureJson as {
    parserTree?: unknown;
    structure?: unknown;
  } | null;

  let payload: unknown;
  let suffix: string;

  switch (format) {
    case "json":
      payload = structure?.structure ?? null;
      suffix = "estrutura";
      break;
    case "tree":
      payload = structure?.parserTree ?? null;
      suffix = "arvore";
      break;
    case "chunks":
      payload = await prisma.chunk.findMany({
        where: { documentId: id },
        orderBy: { index: "asc" },
        select: {
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
        },
      });
      suffix = "chunks";
      break;
    case "embeddings":
      payload = await prisma.embedding.findMany({
        where: { documentId: id },
        select: {
          chunkId: true,
          model: true,
          dimension: true,
          hash: true,
          durationMs: true,
          indexed: true,
          indexedAt: true,
          metadata: true,
        },
      });
      suffix = "embeddings";
      break;
    case "logs":
      payload = await prisma.pipelineLog.findMany({
        where: { documentId: id },
        orderBy: { createdAt: "asc" },
      });
      suffix = "logs";
      break;
    default:
      return NextResponse.json({ error: `Formato inválido: ${format}` }, { status: 400 });
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename(suffix)}"`,
    },
  });
}
