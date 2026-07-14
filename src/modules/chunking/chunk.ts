import type { ChunkDraft } from "@/shared/types";
import type { ChunkingConfig } from "@/shared/config";
import { DEFAULT_CONFIG } from "@/shared/config";
import { countTokens } from "@/shared/tokens";
import type { FlatArticle } from "@/modules/tree";

/**
 * Step 6 — Chunkização.
 *
 * Regras (PRD):
 *  - Cada artigo vira um chunk.
 *  - Se exceder o limite configurável, divide — mas NUNCA divide um
 *    parágrafo, inciso, alínea ou item ao meio: a divisão acontece apenas
 *    entre unidades estruturais inteiras.
 *  - Cada chunk preserva o contexto (lei > capítulo > seção > artigo) num
 *    cabeçalho, e partes subsequentes repetem `overlap` unidades da parte
 *    anterior.
 */
export function chunkArticles(
  documentTitle: string,
  articles: FlatArticle[],
  config: ChunkingConfig = DEFAULT_CONFIG.chunking
): ChunkDraft[] {
  const chunks: ChunkDraft[] = [];
  let index = 0;

  for (const flat of articles) {
    const header = buildHeader(documentTitle, flat);
    const units = splitIntoUnits(flat.fullText);
    const limit = Math.max(64, config.maxTokens);

    const parts = packUnits(units, header, limit, config.overlap);

    for (let p = 0; p < parts.length; p++) {
      const partHeader =
        parts.length > 1 ? `${header}\n[Parte ${p + 1}/${parts.length}]` : header;
      const content = `${partHeader}\n\n${parts[p].join("\n")}`;
      chunks.push({
        index: index++,
        content,
        tokenCount: countTokens(content),
        charCount: content.length,
        part: p + 1,
        totalParts: parts.length,
        articleRef: flat.numero,
        originArticle: flat.rotulo,
        originChapter: flat.chapterLabel,
        originSection: flat.sectionLabel,
      });
    }
  }

  return chunks;
}

function buildHeader(documentTitle: string, flat: FlatArticle): string {
  const lines = [documentTitle];
  if (flat.chapterLabel) lines.push(flat.chapterLabel);
  if (flat.sectionLabel) lines.push(flat.sectionLabel);
  lines.push(flat.rotulo);
  return lines.join(" > ");
}

/**
 * Divide o texto completo do artigo em unidades estruturais indivisíveis
 * (cada linha do fullText já é um caput/parágrafo/inciso/alínea/item inteiro).
 */
function splitIntoUnits(fullText: string): string[] {
  return fullText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Agrupa unidades em partes respeitando o limite de tokens.
 * `overlap` unidades finais de uma parte são repetidas no início da seguinte
 * para preservar contexto.
 */
function packUnits(
  units: string[],
  header: string,
  maxTokens: number,
  overlap: number
): string[][] {
  const headerTokens = countTokens(header) + 8; // margem para "[Parte N/M]"
  const budget = Math.max(32, maxTokens - headerTokens);

  const parts: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const unit of units) {
    const unitTokens = countTokens(unit);
    if (current.length > 0 && currentTokens + unitTokens > budget) {
      parts.push(current);
      // sobreposição: repete as últimas `overlap` unidades
      const carry = overlap > 0 ? current.slice(-overlap) : [];
      current = [...carry, unit];
      currentTokens = carry.reduce((sum, u) => sum + countTokens(u), 0) + unitTokens;
    } else {
      current.push(unit);
      currentTokens += unitTokens;
    }
  }
  if (current.length > 0) parts.push(current);

  return parts.length > 0 ? parts : [[""]];
}
