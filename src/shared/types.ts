// ---------------------------------------------------------------------------
// Tipos compartilhados entre os módulos do pipeline.
// Cada módulo depende apenas destes tipos — nunca da implementação dos demais.
// ---------------------------------------------------------------------------

export const TOKEN_TYPES = [
  "DOCUMENT",
  "CAPITULO",
  "TITULO_CAPITULO",
  "SECAO",
  "TITULO_SECAO",
  "SUBSECAO",
  "ARTIGO",
  "CAPUT",
  "PARAGRAFO",
  "INCISO",
  "ALINEA",
  "ITEM",
  "OBSERVACAO",
  "NOVA_REDACAO",
  "REFERENCIA_LEGAL",
  "TEXTO",
] as const;

export type TokenType = (typeof TOKEN_TYPES)[number];

/** Token Estrutural (Step 3) */
export interface StructuralToken {
  id: string;
  index: number;
  type: TokenType;
  text: string;
  /** offset de caracteres no texto de entrada */
  position: number;
  startLine: number;
  endLine: number;
}

export type TreeNodeType =
  | "DOCUMENT"
  | "CAPITULO"
  | "SECAO"
  | "SUBSECAO"
  | "ARTIGO"
  | "CAPUT"
  | "PARAGRAFO"
  | "INCISO"
  | "ALINEA"
  | "ITEM"
  | "OBSERVACAO"
  | "NOVA_REDACAO"
  | "REFERENCIA_LEGAL"
  | "TEXTO";

/** Nó da Árvore Estrutural (Step 4) */
export interface TreeNode {
  id: string;
  type: TreeNodeType;
  /** rótulo curto — "CAPÍTULO I", "Art. 35", "§ 1º", "IV", "a" */
  label: string;
  /** número/identificador quando aplicável — "35", "1", "IV", "a" */
  number?: string;
  /** título associado (capítulo/seção) */
  title?: string;
  /** conteúdo textual do nó */
  text?: string;
  startLine?: number;
  endLine?: number;
  children: TreeNode[];
}

/** Intervalo de caracteres de uma página dentro do texto extraído concatenado (Step 1) */
export interface PageOffset {
  page: number;
  start: number;
  end: number;
}

/** Figura detectada e recortada de uma página (Step 1 — OCR/Vision) */
export interface FigureDraft {
  page: number;
  index: number;
  /** data URL "data:image/png;base64,..." */
  imageBase64: string;
  width: number;
  height: number;
  description: string;
  ocrText: string;
}

/** Resultado da extração (Step 1) */
export interface ExtractionResult {
  text: string;
  meta: {
    pages?: number;
    warnings?: string[];
    engine: string;
    durationMs: number;
    pageOffsets?: PageOffset[];
    ocrPages?: number[];
    figuresDetected?: number;
  };
  figures?: FigureDraft[];
}

/** Estatísticas da limpeza (Step 2) */
export interface CleaningStats {
  charsBefore: number;
  charsAfter: number;
  linesBefore: number;
  linesAfter: number;
  operations: Record<string, number>;
}

export interface CleaningResult {
  cleaned: string;
  stats: CleaningStats;
}

/** Chunk produzido no Step 6 */
export interface ChunkDraft {
  index: number;
  content: string;
  tokenCount: number;
  charCount: number;
  part: number;
  totalParts: number;
  articleRef?: string; // id lógico do artigo de origem (número)
  originArticle?: string;
  originChapter?: string;
  originSection?: string;
}

/** Saída do Enriquecimento IA (Step 7) */
export interface EnrichmentData {
  resumo: string;
  palavras_chave: string[];
  tema: string;
  subtema: string;
  categoria: string;
  tipo_documento: string;
  referencias: string[];
  assuntos: string[];
  entidades: string[];
  observacoes: string;
}

export interface EnrichmentResult {
  data: EnrichmentData;
  prompt: string;
  rawResponse: string;
  model: string;
  durationMs: number;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
}

/** Resultado da geração de embedding (Step 8) */
export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimension: number;
  hash: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export const PIPELINE_STEPS = [
  "EXTRACTION",
  "CLEANING",
  "TOKENIZATION",
  "PARSING",
  "TREE",
  "CHUNKING",
  "ENRICHMENT",
  "EMBEDDINGS",
  "INDEXING",
] as const;

export type PipelineStep = (typeof PIPELINE_STEPS)[number];

export const PIPELINE_STATUSES = [
  "UPLOADED",
  "EXTRACTED",
  "CLEANED",
  "TOKENIZED",
  "PARSED",
  "TREE_CREATED",
  "CHUNKED",
  "ENRICHED",
  "EMBEDDED",
  "INDEXED",
] as const;

export type PipelineStatusValue = (typeof PIPELINE_STATUSES)[number];

/** Status resultante de cada step */
export const STEP_RESULT_STATUS: Record<PipelineStep, PipelineStatusValue> = {
  EXTRACTION: "EXTRACTED",
  CLEANING: "CLEANED",
  TOKENIZATION: "TOKENIZED",
  PARSING: "PARSED",
  TREE: "TREE_CREATED",
  CHUNKING: "CHUNKED",
  ENRICHMENT: "ENRICHED",
  EMBEDDINGS: "EMBEDDED",
  INDEXING: "INDEXED",
};

export const STEP_LABELS: Record<PipelineStep, string> = {
  EXTRACTION: "Extração",
  CLEANING: "Limpeza",
  TOKENIZATION: "Tokenização",
  PARSING: "Parser",
  TREE: "Estrutura da Lei",
  CHUNKING: "Chunkização",
  ENRICHMENT: "Enriquecimento IA",
  EMBEDDINGS: "Embeddings",
  INDEXING: "Banco Vetorial",
};
