import type {
  Evidence,
  ExplainabilityTrace,
  ExtractedEntities,
  QuestionCategory,
  RetrievedChunk,
} from "@/shared/rag-types";

/** Evidências — toda resposta deve possuir origem, lei, artigo, score e motivo. */
export function buildEvidences(chunks: RetrievedChunk[]): Evidence[] {
  return chunks.map((c) => ({
    chunkId: c.chunkId,
    lei: c.documentName,
    artigo: c.articleLabel,
    capitulo: c.chapterLabel,
    secao: c.sectionLabel,
    scoreSimilaridade: c.distance,
    motivoRecuperacao: c.reason,
  }));
}

export interface TraceInput {
  question: string;
  category: QuestionCategory;
  categoryConfidence: number;
  entities: ExtractedEntities;
  vectorStage: RetrievedChunk[];
  metadataStage: RetrievedChunk[];
  referenceStage: RetrievedChunk[];
  rerankStage: RetrievedChunk[];
  prompt: string;
  rawResponse: string;
  model: string;
  temperature: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
}

/** Explicabilidade — "Como essa resposta foi construída?": consulta → chunks → reranking → prompt → resposta. */
export function buildTrace(input: TraceInput): ExplainabilityTrace {
  return { ...input };
}
