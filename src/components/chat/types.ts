import type { Evidence, ExplainabilityTrace, ExtractedEntities, GeneratedAnswer } from "@/shared/rag-types";

/** Formato normalizado de uma troca (pergunta + resposta) usado pela UI do chat. */
export interface ChatExchange {
  questionId: string;
  answerId: string;
  questionText: string;
  category: string;
  categoryConfidence: number;
  entities: ExtractedEntities;
  answer: GeneratedAnswer;
  evidences: Evidence[];
  warnings: string[];
  insufficientEvidence: boolean;
  trace: ExplainabilityTrace | null;
  model: string;
  temperature: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  durationMs: number;
}

/** Reconstrói a lista de evidências a partir do trace armazenado (perguntas de conversas antigas). */
export function evidencesFromTrace(trace: ExplainabilityTrace | null): Evidence[] {
  if (!trace) return [];
  return [...trace.rerankStage, ...trace.referenceStage].map((c) => ({
    chunkId: c.chunkId,
    lei: c.documentName,
    artigo: c.articleLabel,
    capitulo: c.chapterLabel,
    secao: c.sectionLabel,
    scoreSimilaridade: c.distance,
    motivoRecuperacao: c.reason,
  }));
}
