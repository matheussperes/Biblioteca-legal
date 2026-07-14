export interface DocumentDetail {
  id: string;
  name: string;
  type: string;
  mimeType: string | null;
  sizeBytes: number;
  status: string;
  extractedText: string | null;
  cleanedText: string | null;
  structureJson: unknown;
  extractionMeta: {
    pages?: number;
    engine?: string;
    durationMs?: number;
    warnings?: string[];
  } | null;
  cleaningStats: {
    charsBefore: number;
    charsAfter: number;
    linesBefore: number;
    linesAfter: number;
    operations: Record<string, number>;
  } | null;
  createdAt: string;
  updatedAt: string;
  indexedCount: number;
  _count: {
    tokens: number;
    chapters: number;
    articles: number;
    chunks: number;
    embeddings: number;
  };
}

export interface StepPanelProps {
  document: DocumentDetail;
  running: boolean;
  /** executa o step e recarrega o documento */
  onRun: () => Promise<void>;
  /** recarrega o documento sem executar nada */
  onReload: () => Promise<void>;
}
