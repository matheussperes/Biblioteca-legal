// ---------------------------------------------------------------------------
// Configuração do pipeline — valores padrão.
// Os valores efetivos são mesclados com o que estiver salvo em app_settings
// (editável na tela de Configurações).
// ---------------------------------------------------------------------------

export interface RegexConfig {
  capitulo: string;
  secao: string;
  subsecao: string;
  artigo: string;
  paragrafo: string;
  inciso: string;
  alinea: string;
  item: string;
  observacao: string;
  novaRedacao: string;
  referenciaLegal: string;
}

export interface ChunkingConfig {
  /** tamanho alvo do chunk em tokens */
  chunkSize: number;
  /** sobreposição entre partes de um mesmo artigo, em unidades estruturais */
  overlap: number;
  /** limite máximo de tokens por chunk */
  maxTokens: number;
  /** estratégia de chunkização */
  strategy: "article";
}

export interface EnrichmentConfig {
  prompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface EmbeddingsConfig {
  model: string;
  dimension: number;
  batchSize: number;
}

export interface OcrConfig {
  /** liga/desliga OCR via Vision e a extração de figuras no Step 1 */
  enabled: boolean;
  /** modelo com suporte a visão (ex.: gpt-4o-mini, gpt-4o) */
  model: string;
  temperature: number;
  /** limite de páginas renderizadas por documento — protege custo/tempo */
  maxPages: number;
  /** limite de figuras persistidas por documento */
  maxFigures: number;
  /** dimensões mínimas (px) para uma figura recortada ser mantida (descarta ícones/ruído) */
  minFigureWidth: number;
  minFigureHeight: number;
  /** escala de renderização da página (proporcional à resolução da imagem) */
  renderScale: number;
  ocrPrompt: string;
  figuresPrompt: string;
}

export interface PipelineConfig {
  regex: RegexConfig;
  chunking: ChunkingConfig;
  enrichment: EnrichmentConfig;
  embeddings: EmbeddingsConfig;
  ocr: OcrConfig;
}

export const DEFAULT_ENRICHMENT_PROMPT = `Você é um especialista em análise de documentos legislativos brasileiros.

Analise o trecho de lei abaixo e produza um JSON com exatamente estas chaves:

- "resumo": resumo objetivo do dispositivo (2 a 3 frases)
- "palavras_chave": lista de 5 a 10 palavras-chave
- "tema": tema principal
- "subtema": subtema específico
- "categoria": categoria jurídica (ex.: tributário, administrativo, urbanístico)
- "tipo_documento": tipo do documento (ex.: lei ordinária, lei complementar, decreto)
- "referencias": lista de referências legais citadas no texto (leis, artigos, decretos)
- "assuntos": lista de assuntos tratados
- "entidades": lista de entidades mencionadas (órgãos, cargos, instituições)
- "observacoes": observações relevantes (revogações, novas redações, condições especiais); string vazia se não houver

Contexto do dispositivo:
{{CONTEXTO}}

Texto:
"""
{{TEXTO}}
"""

Responda APENAS com o JSON, sem texto adicional.`;

/** Página sem camada de texto (PDF escaneado) — transcrição via OCR + figuras. */
export const DEFAULT_OCR_PROMPT = `Você está vendo a imagem de uma página digitalizada de um documento legislativo brasileiro (a página não possui texto extraível — é uma imagem).

Produza um JSON com exatamente estas chaves:

- "texto": transcrição completa e fiel do texto da página, preservando a ordem de leitura, números de artigo, parágrafos, incisos e alíneas. Não resuma nem corrija o conteúdo.
- "figuras": lista de figuras não textuais presentes na página (mapas, plantas, tabelas com desenhos, gráficos, diagramas, selos, brasões, fotografias). Ignore blocos que sejam apenas texto corrido. Para cada figura, informe:
  - "descricao": descrição objetiva do conteúdo da figura (2-3 frases)
  - "bbox": posição aproximada da figura na página, como [x0, y0, x1, y1] em porcentagem (0 a 100) da largura/altura da página
  - "texto_na_figura": texto legível dentro da própria figura (legendas, rótulos, valores), string vazia se não houver

Se não houver nenhuma figura, retorne "figuras": [].
Responda APENAS com o JSON, sem texto adicional.`;

/** Página com camada de texto — apenas detecção/descrição de figuras embutidas. */
export const DEFAULT_FIGURES_PROMPT = `Você está vendo a imagem de uma página de um documento legislativo brasileiro. Esta página já possui texto extraído por outro processo — ignore o texto corrido e concentre-se apenas em elementos visuais não textuais.

Produza um JSON com exatamente esta chave:

- "figuras": lista de figuras não textuais presentes na página (mapas, plantas, tabelas com desenhos, gráficos, diagramas, selos, brasões, fotografias). Ignore blocos que sejam apenas texto corrido ou tabelas puramente textuais. Para cada figura, informe:
  - "descricao": descrição objetiva do conteúdo da figura (2-3 frases)
  - "bbox": posição aproximada da figura na página, como [x0, y0, x1, y1] em porcentagem (0 a 100) da largura/altura da página
  - "texto_na_figura": texto legível dentro da própria figura (legendas, rótulos, valores), string vazia se não houver

Se não houver nenhuma figura, retorne "figuras": [].
Responda APENAS com o JSON, sem texto adicional.`;

export const DEFAULT_CONFIG: PipelineConfig = {
  regex: {
    capitulo: "^\\s*CAP[IÍ]TULO\\s+([IVXLCDM]+|[0-9]+)[\\s\\-–—.]*(.*)$",
    secao: "^\\s*SE[ÇC][ÃA]O\\s+([IVXLCDM]+|[0-9]+)[\\s\\-–—.]*(.*)$",
    subsecao: "^\\s*SUBSE[ÇC][ÃA]O\\s+([IVXLCDM]+|[0-9]+)[\\s\\-–—.]*(.*)$",
    artigo: "^\\s*Art(?:igo)?\\.?\\s*(\\d+(?:[\\-–][A-Z])?)\\s*[ºo°]?\\s*[.\\-–—]?\\s*(.*)$",
    paragrafo:
      "^\\s*(?:§\\s*(\\d+)\\s*[ºo°]?|Par[áa]grafo\\s+[úu]nico)\\s*[.\\-–—]?\\s*(.*)$",
    inciso: "^\\s*([IVXLCDM]+)\\s*[\\-–—.]\\s+(.*)$",
    alinea: "^\\s*([a-z])\\s*\\)\\s+(.*)$",
    item: "^\\s*(\\d+)\\s*[.)]\\s+(.*)$",
    observacao: "^\\s*(?:Obs\\.?|Observa[çc][ãa]o|Nota)\\s*[:\\-–—.]?\\s*(.*)$",
    novaRedacao:
      "(\\(\\s*NR\\s*\\)|\\(\\s*nova\\s+reda[çc][ãa]o\\s*\\)|reda[çc][ãa]o\\s+dada\\s+pel[ao])",
    referenciaLegal:
      "((?:Lei(?:\\s+(?:Complementar|Federal|Estadual|Municipal|Org[âa]nica))?|Decreto(?:-Lei)?|Medida\\s+Provis[óo]ria|Emenda\\s+Constitucional)\\s+n\\s*[ºo°.]?\\s*[\\d.]+(?:\\s*[,/]\\s*de\\s+[^,;.]+)?)",
  },
  chunking: {
    chunkSize: 400,
    overlap: 1,
    maxTokens: 512,
    strategy: "article",
  },
  enrichment: {
    prompt: DEFAULT_ENRICHMENT_PROMPT,
    model: "gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 1024,
  },
  embeddings: {
    model: "text-embedding-3-small",
    dimension: 1536,
    batchSize: 64,
  },
  ocr: {
    enabled: true,
    model: "gpt-4o-mini",
    temperature: 0,
    maxPages: 80,
    maxFigures: 60,
    minFigureWidth: 60,
    minFigureHeight: 60,
    renderScale: 1.5,
    ocrPrompt: DEFAULT_OCR_PROMPT,
    figuresPrompt: DEFAULT_FIGURES_PROMPT,
  },
};

/** Preços aproximados (USD por 1M tokens) para estimativa de custo do Step 7/8. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1": { input: 2, output: 8 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
  "text-embedding-3-large": { input: 0.13, output: 0 },
};

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (
    (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000
  );
}

export function mergeConfig(partial: unknown): PipelineConfig {
  const p = (partial ?? {}) as Partial<Record<keyof PipelineConfig, object>>;
  return {
    regex: { ...DEFAULT_CONFIG.regex, ...(p.regex ?? {}) },
    chunking: { ...DEFAULT_CONFIG.chunking, ...(p.chunking ?? {}) },
    enrichment: { ...DEFAULT_CONFIG.enrichment, ...(p.enrichment ?? {}) },
    embeddings: { ...DEFAULT_CONFIG.embeddings, ...(p.embeddings ?? {}) },
    ocr: { ...DEFAULT_CONFIG.ocr, ...(p.ocr ?? {}) },
  };
}
