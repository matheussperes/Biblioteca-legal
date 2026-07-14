import { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";

// ---------------------------------------------------------------------------
// Step 9 — Banco Vetorial (pgvector).
// O vetor é gravado na própria tabela `embeddings` (coluna `vector`);
// "indexar" significa gravar o vetor + metadados e marcar `indexed = true`.
// ---------------------------------------------------------------------------

/** Grava o vetor de um embedding via SQL bruto (Prisma não suporta `vector`). */
export async function storeVector(
  embeddingId: string,
  vector: number[]
): Promise<void> {
  const literal = `[${vector.join(",")}]`;
  await prisma.$executeRaw`
    UPDATE embeddings SET vector = ${literal}::vector WHERE id = ${embeddingId}
  `;
}

export interface IndexResult {
  indexed: number;
  errors: string[];
  durationMs: number;
}

/**
 * Indexa todos os embeddings de um documento: valida a presença do vetor,
 * grava os metadados de recuperação e marca como indexado.
 */
export async function indexDocument(documentId: string): Promise<IndexResult> {
  const start = Date.now();
  const errors: string[] = [];

  const rows = await prisma.$queryRaw<
    Array<{ id: string; chunkId: string; hasVector: boolean }>
  >`
    SELECT e.id, e."chunkId", (e.vector IS NOT NULL) AS "hasVector"
    FROM embeddings e
    WHERE e."documentId" = ${documentId}
  `;

  let indexed = 0;
  for (const row of rows) {
    if (!row.hasVector) {
      errors.push(`Embedding ${row.id} (chunk ${row.chunkId}) sem vetor.`);
      continue;
    }
    const chunk = await prisma.chunk.findUnique({
      where: { id: row.chunkId },
      select: {
        index: true,
        originArticle: true,
        originChapter: true,
        originSection: true,
        part: true,
        totalParts: true,
        enrichment: true,
        document: { select: { name: true } },
      },
    });
    const metadata = {
      documento: chunk?.document.name,
      artigo: chunk?.originArticle,
      capitulo: chunk?.originChapter,
      secao: chunk?.originSection,
      parte: chunk?.part,
      total_partes: chunk?.totalParts,
      chunk_index: chunk?.index,
      enriquecimento: chunk?.enrichment ?? null,
    };
    await prisma.embedding.update({
      where: { id: row.id },
      data: {
        indexed: true,
        indexedAt: new Date(),
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
    indexed += 1;
  }

  return { indexed, errors, durationMs: Date.now() - start };
}

export interface SimilarChunk {
  chunkId: string;
  content: string;
  distance: number;
}

/** Busca por similaridade (cosseno) — utilidade para a Fase 2 / validação. */
export async function searchSimilar(
  vector: number[],
  limit = 5
): Promise<SimilarChunk[]> {
  const literal = `[${vector.join(",")}]`;
  return prisma.$queryRaw<SimilarChunk[]>`
    SELECT c.id AS "chunkId", c.content,
           (e.vector <=> ${literal}::vector) AS distance
    FROM embeddings e
    JOIN chunks c ON c.id = e."chunkId"
    WHERE e.indexed = true AND e.vector IS NOT NULL
    ORDER BY e.vector <=> ${literal}::vector
    LIMIT ${limit}
  `;
}
