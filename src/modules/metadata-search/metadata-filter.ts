import { flattenEntities } from "@/modules/entity-extraction";
import { normalizeText as normalize } from "@/shared/utils";
import type { ExtractedEntities, QuestionCategory, RetrievedChunk } from "@/shared/rag-types";

function enrichmentHaystack(chunk: RetrievedChunk): string {
  const enrichment = (chunk.enrichment ?? {}) as Record<string, unknown>;
  const parts = [
    chunk.documentName,
    chunk.articleLabel,
    chunk.chapterLabel,
    chunk.sectionLabel,
    typeof enrichment.tema === "string" ? enrichment.tema : "",
    typeof enrichment.subtema === "string" ? enrichment.subtema : "",
    typeof enrichment.categoria === "string" ? enrichment.categoria : "",
    Array.isArray(enrichment.palavras_chave) ? enrichment.palavras_chave.join(" ") : "",
    Array.isArray(enrichment.assuntos) ? enrichment.assuntos.join(" ") : "",
  ];
  return normalize(parts.filter(Boolean).join(" | "));
}

/**
 * Segunda etapa da recuperação — Busca por Metadados.
 * Reordena os chunks combinando similaridade vetorial com correspondência de
 * lei/capítulo/seção/artigo/tema/categoria/cidade/palavras-chave, e retorna o Top K.
 */
export function metadataFilter(
  chunks: RetrievedChunk[],
  category: QuestionCategory,
  entities: ExtractedEntities,
  topK: number
): RetrievedChunk[] {
  const terms = flattenEntities(entities)
    .map(normalize)
    .filter((t) => t.length >= 3);
  const categoryNorm = normalize(category);

  const scored = chunks.map((chunk) => {
    const haystack = enrichmentHaystack(chunk);
    const matchedTerms = terms.filter((term) => haystack.includes(term));
    const categoryMatch = haystack.includes(categoryNorm);
    const matchCount = matchedTerms.length + (categoryMatch ? 1 : 0);
    return { chunk, matchCount, matchedTerms, categoryMatch };
  });

  scored.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return (a.chunk.distance ?? 1) - (b.chunk.distance ?? 1);
  });

  return scored.slice(0, topK).map(({ chunk, matchedTerms, categoryMatch, matchCount }) => ({
    ...chunk,
    stage: "METADATA" as const,
    reason:
      matchCount > 0
        ? `Metadados combinam com a consulta (${[
            categoryMatch ? `categoria "${category}"` : null,
            matchedTerms.length ? `termos: ${matchedTerms.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join("; ")})`
        : chunk.reason,
  }));
}
