import { Prisma } from "@prisma/client";
import { prisma } from "@/database/client";
import { generateEmbeddings, type EmbeddingClient } from "@/modules/embeddings";
import { getPipelineConfig } from "@/modules/pipeline";
import type { RetrievedChunk } from "@/shared/rag-types";

interface VectorSearchRow {
  chunkId: string;
  content: string;
  documentId: string;
  documentName: string;
  documentCreatedAt: Date;
  articleId: string | null;
  articleLabel: string | null;
  chapterLabel: string | null;
  sectionLabel: string | null;
  enrichment: unknown;
  distance: number;
}

/** Embeda a pergunta com o mesmo modelo usado na indexação (Fase 1). */
export async function embedQuestion(
  question: string,
  embeddingClient?: EmbeddingClient
): Promise<number[]> {
  const config = await getPipelineConfig();
  const [result] = await generateEmbeddings([question], config.embeddings, embeddingClient);
  return result?.vector ?? [];
}

function rowToChunk(row: VectorSearchRow): RetrievedChunk {
  return {
    chunkId: row.chunkId,
    content: row.content,
    documentId: row.documentId,
    documentName: row.documentName,
    documentCreatedAt: row.documentCreatedAt.toISOString(),
    articleId: row.articleId,
    articleLabel: row.articleLabel,
    chapterLabel: row.chapterLabel,
    sectionLabel: row.sectionLabel,
    enrichment: (row.enrichment as Record<string, unknown> | null) ?? null,
    distance: row.distance,
    rerankScore: null,
    stage: "VECTOR",
    reason: `Similaridade vetorial (distância cosseno = ${row.distance.toFixed(4)})`,
  };
}

/** Primeira etapa da recuperação — Busca Vetorial (Top 30 por padrão). */
export async function vectorSearch(
  vector: number[],
  topK: number,
  excludeDocumentIds: string[] = []
): Promise<RetrievedChunk[]> {
  if (vector.length === 0) return [];
  const literal = `[${vector.join(",")}]`;

  const rows = excludeDocumentIds.length
    ? await prisma.$queryRaw<VectorSearchRow[]>`
        SELECT c.id AS "chunkId", c.content, c."documentId", d.name AS "documentName",
               d."createdAt" AS "documentCreatedAt",
               c."articleId", a.label AS "articleLabel",
               c."originChapter" AS "chapterLabel", c."originSection" AS "sectionLabel",
               c.enrichment,
               (e.vector <=> ${literal}::vector) AS distance
        FROM embeddings e
        JOIN chunks c ON c.id = e."chunkId"
        JOIN documents d ON d.id = c."documentId"
        LEFT JOIN articles a ON a.id = c."articleId"
        WHERE e.indexed = true AND e.vector IS NOT NULL
          AND c."documentId" NOT IN (${Prisma.join(excludeDocumentIds)})
        ORDER BY e.vector <=> ${literal}::vector
        LIMIT ${topK}
      `
    : await prisma.$queryRaw<VectorSearchRow[]>`
        SELECT c.id AS "chunkId", c.content, c."documentId", d.name AS "documentName",
               d."createdAt" AS "documentCreatedAt",
               c."articleId", a.label AS "articleLabel",
               c."originChapter" AS "chapterLabel", c."originSection" AS "sectionLabel",
               c.enrichment,
               (e.vector <=> ${literal}::vector) AS distance
        FROM embeddings e
        JOIN chunks c ON c.id = e."chunkId"
        JOIN documents d ON d.id = c."documentId"
        LEFT JOIN articles a ON a.id = c."articleId"
        WHERE e.indexed = true AND e.vector IS NOT NULL
        ORDER BY e.vector <=> ${literal}::vector
        LIMIT ${topK}
      `;

  return rows.map(rowToChunk);
}

/** Busca vetorial restrita a um conjunto de documentos — usada na Busca por Referências Cruzadas. */
export async function vectorSearchInDocuments(
  vector: number[],
  documentIds: string[],
  limitPerDocument: number
): Promise<RetrievedChunk[]> {
  if (vector.length === 0 || documentIds.length === 0) return [];
  const literal = `[${vector.join(",")}]`;

  const results: RetrievedChunk[] = [];
  for (const documentId of documentIds) {
    const rows = await prisma.$queryRaw<VectorSearchRow[]>`
      SELECT c.id AS "chunkId", c.content, c."documentId", d.name AS "documentName",
             d."createdAt" AS "documentCreatedAt",
             c."articleId", a.label AS "articleLabel",
             c."originChapter" AS "chapterLabel", c."originSection" AS "sectionLabel",
             c.enrichment,
             (e.vector <=> ${literal}::vector) AS distance
      FROM embeddings e
      JOIN chunks c ON c.id = e."chunkId"
      JOIN documents d ON d.id = c."documentId"
      LEFT JOIN articles a ON a.id = c."articleId"
      WHERE e.indexed = true AND e.vector IS NOT NULL AND c."documentId" = ${documentId}
      ORDER BY e.vector <=> ${literal}::vector
      LIMIT ${limitPerDocument}
    `;
    results.push(...rows.map(rowToChunk));
  }
  return results;
}
