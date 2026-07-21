import type { RetrievedChunk } from "@/shared/rag-types";

export function makeChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    content: "Art. 10. A altura máxima permitida nesta zona é de 12 (doze) metros.",
    documentId: "doc-1",
    documentName: "LUOS - Lei Complementar 123/2020",
    documentCreatedAt: new Date("2024-01-01").toISOString(),
    articleId: "art-1",
    articleLabel: "Art. 10",
    chapterLabel: "CAPÍTULO II — Zoneamento",
    sectionLabel: null,
    enrichment: {
      resumo: "Define a altura máxima permitida na zona.",
      tema: "Altura",
      subtema: "Zoneamento",
      categoria: "urbanístico",
      palavras_chave: ["altura", "gabarito"],
      assuntos: ["altura máxima"],
      referencias: ["Lei Federal nº 10.257/2001"],
      observacoes: "",
    },
    distance: 0.12,
    rerankScore: null,
    stage: "VECTOR",
    reason: "Similaridade vetorial (distância cosseno = 0.1200)",
    ...overrides,
  };
}
