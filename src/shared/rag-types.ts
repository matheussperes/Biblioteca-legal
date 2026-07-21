// ---------------------------------------------------------------------------
// Tipos compartilhados do Motor RAG (Fase 2).
// Cada módulo depende apenas destes tipos — nunca da implementação dos demais.
// ---------------------------------------------------------------------------

export const QUESTION_CATEGORIES = [
  "Licenciamento",
  "Zoneamento",
  "Uso do Solo",
  "Recuos",
  "Coeficiente",
  "Taxa de Ocupação",
  "Altura",
  "Piscinas",
  "Muros",
  "Demolição",
  "Reforma",
  "Alvarás",
  "Habite-se",
  "Fiscalização",
  "Infrações",
  "Regularização",
  "Parcelamento",
  "Edificações",
  "Movimento de Terra",
  "Acessibilidade",
  "Segurança",
  "Outros",
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export interface ClassificationResult {
  category: QuestionCategory;
  confidence: number;
  prompt: string;
  rawResponse: string;
  model: string;
}

/** Entidades extraídas da pergunta (Fase 2). */
export interface ExtractedEntities {
  cidade: string[];
  lei: string[];
  artigo: string[];
  tipoObra: string[];
  tipoImovel: string[];
  zona: string[];
  uso: string[];
  medidas: string[];
  altura: string[];
  area: string[];
  coeficiente: string[];
  taxa: string[];
  recuo: string[];
  documentos: string[];
  orgaosPublicos: string[];
  normas: string[];
}

export interface EntityExtractionResult {
  entities: ExtractedEntities;
  prompt: string;
  rawResponse: string;
  model: string;
}

export const EMPTY_ENTITIES: ExtractedEntities = {
  cidade: [],
  lei: [],
  artigo: [],
  tipoObra: [],
  tipoImovel: [],
  zona: [],
  uso: [],
  medidas: [],
  altura: [],
  area: [],
  coeficiente: [],
  taxa: [],
  recuo: [],
  documentos: [],
  orgaosPublicos: [],
  normas: [],
};

/** Estágio de recuperação — usado para explicabilidade/rastreabilidade. */
export type RetrievalStage = "VECTOR" | "METADATA" | "REFERENCE" | "RERANK";

/** Chunk recuperado, com todos os metadados necessários para citação. */
export interface RetrievedChunk {
  chunkId: string;
  content: string;
  documentId: string;
  documentName: string;
  documentCreatedAt: string;
  articleId: string | null;
  articleLabel: string | null;
  chapterLabel: string | null;
  sectionLabel: string | null;
  enrichment: Record<string, unknown> | null;
  /** distância vetorial (cosseno) — quanto menor, mais similar */
  distance: number | null;
  /** score final (0-10) após reranking, quando aplicável */
  rerankScore: number | null;
  stage: RetrievalStage;
  reason: string;
}

/** Item citado na resposta final. */
export interface ArticleUsed {
  chunkId: string;
  articleId: string | null;
  documentId: string;
  lei: string;
  capitulo: string | null;
  secao: string | null;
  artigo: string | null;
  trecho: string;
}

export interface CrossReference {
  lei: string;
  artigo: string | null;
  motivo: string;
}

export interface ConflictDetail {
  tema: string;
  versoes: Array<{ lei: string; artigo: string | null; valor: string }>;
}

export type ConfidenceLevel = "ALTO" | "MEDIO" | "BAIXO";

/** Saída estruturada da geração (LLM). */
export interface GeneratedAnswer {
  resumoExecutivo: string;
  fundamentacao: string;
  artigosUtilizados: ArticleUsed[];
  referenciasCruzadas: CrossReference[];
  observacoes: string;
  nivelConfianca: ConfidenceLevel;
  hasConflict: boolean;
  conflictDetails: ConflictDetail[];
}

export interface GenerationResult {
  answer: GeneratedAnswer;
  prompt: string;
  rawResponse: string;
  model: string;
  temperature: number;
  durationMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  insufficientEvidence: boolean;
}

/** Evidência exibida no painel de explicabilidade. */
export interface Evidence {
  chunkId: string;
  lei: string;
  artigo: string | null;
  capitulo: string | null;
  secao: string | null;
  scoreSimilaridade: number | null;
  motivoRecuperacao: string;
}

/** Trace completo — "Como essa resposta foi construída?" */
export interface ExplainabilityTrace {
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
