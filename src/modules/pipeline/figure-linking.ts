import type { PageOffset } from "@/shared/types";

// ---------------------------------------------------------------------------
// Step 6 — vincula as figuras extraídas no Step 1 (Etapa 2) ao artigo/chunk
// da mesma página. Localiza a posição de cada artigo no texto extraído
// (busca sequencial por "Art. N") e mapeia essa posição para uma página via
// `pageOffsets`; a figura fica associada ao último artigo cuja página é <=
// à página da figura.
// ---------------------------------------------------------------------------

export interface ArticleRef {
  articleId: string;
  number: string;
}

export interface ArticleLocation {
  articleId: string;
  page: number | null;
}

export interface FigureRef {
  id: string;
  page: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Localiza a posição (offset de caracteres) de cada artigo no texto extraído,
 * buscando sequencialmente a partir do fim da ocorrência anterior — preserva
 * a ordem do documento mesmo quando números de artigo se repetem.
 */
export function locateArticleOffsets(
  extractedText: string,
  articles: ArticleRef[]
): Array<{ articleId: string; offset: number | null }> {
  let cursor = 0;
  const results: Array<{ articleId: string; offset: number | null }> = [];
  for (const article of articles) {
    const pattern = new RegExp(
      `(?:Art\\.?|Artigo)\\s*${escapeRegExp(article.number)}\\b`,
      "i"
    );
    const rest = extractedText.slice(cursor);
    const match = rest.match(pattern);
    if (match && match.index != null) {
      const offset = cursor + match.index;
      results.push({ articleId: article.articleId, offset });
      cursor = offset + match[0].length;
    } else {
      results.push({ articleId: article.articleId, offset: null });
    }
  }
  return results;
}

/** Converte um offset de caracteres na página correspondente, via `pageOffsets` (assumido ordenado). */
export function offsetToPage(offset: number, pageOffsets: PageOffset[]): number | null {
  let page: number | null = null;
  for (const p of pageOffsets) {
    if (p.start <= offset) page = p.page;
  }
  return page;
}

export function locateArticlePages(
  extractedText: string,
  articles: ArticleRef[],
  pageOffsets: PageOffset[]
): ArticleLocation[] {
  return locateArticleOffsets(extractedText, articles).map(({ articleId, offset }) => ({
    articleId,
    page: offset == null ? null : offsetToPage(offset, pageOffsets),
  }));
}

/**
 * Associa cada figura ao último artigo (em ordem de documento) cuja página
 * é menor ou igual à página da figura. Figuras antes do primeiro artigo
 * localizado (ex.: capa, preâmbulo) ficam sem vínculo.
 */
export function assignFiguresToArticles(
  figures: FigureRef[],
  articleLocations: ArticleLocation[]
): Map<string, string | null> {
  const known = articleLocations.filter(
    (a): a is { articleId: string; page: number } => a.page != null
  );
  const result = new Map<string, string | null>();
  for (const figure of figures) {
    let chosen: string | null = null;
    for (const a of known) {
      if (a.page <= figure.page) chosen = a.articleId;
    }
    result.set(figure.id, chosen);
  }
  return result;
}
