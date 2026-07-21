import { normalizeText } from "@/shared/utils";
import type { RetrievedChunk } from "@/shared/rag-types";

/** Situação aproximada do dispositivo — inferida das observações de enriquecimento (Fase 1). */
export function deriveSituacao(chunk: RetrievedChunk): string {
  const enrichment = (chunk.enrichment ?? {}) as Record<string, unknown>;
  const observacoes = typeof enrichment.observacoes === "string" ? enrichment.observacoes : "";
  const text = normalizeText(`${observacoes} ${chunk.content}`);
  if (/revogad/.test(text)) return "Possivelmente revogada";
  if (/(nova redacao|redacao dada pel)/.test(text)) return "Alterada (nova redação)";
  return "Vigente";
}

export interface ContextBlock {
  chunkId: string;
  lei: string;
  capitulo: string | null;
  secao: string | null;
  artigo: string | null;
  resumo: string;
  texto: string;
  fonte: string;
  data: string;
  situacao: string;
  crossReference: boolean;
}

/** Monta um bloco padronizado por chunk — usado tanto no contexto do LLM quanto nas evidências. */
export function buildContextBlock(chunk: RetrievedChunk): ContextBlock {
  const enrichment = (chunk.enrichment ?? {}) as Record<string, unknown>;
  return {
    chunkId: chunk.chunkId,
    lei: chunk.documentName,
    capitulo: chunk.chapterLabel,
    secao: chunk.sectionLabel,
    artigo: chunk.articleLabel,
    resumo: typeof enrichment.resumo === "string" && enrichment.resumo ? enrichment.resumo : "(sem resumo)",
    texto: chunk.content,
    fonte: chunk.documentId,
    data: chunk.documentCreatedAt,
    situacao: deriveSituacao(chunk),
    crossReference: chunk.stage === "REFERENCE",
  };
}

function formatBlock(block: ContextBlock, index: number): string {
  return `[Documento ${index + 1}]${block.crossReference ? " (referência cruzada)" : ""}
Lei: ${block.lei}
Capítulo: ${block.capitulo ?? "—"}
Seção: ${block.secao ?? "—"}
Artigo: ${block.artigo ?? "—"}
Situação: ${block.situacao}
Data de cadastro na base: ${new Date(block.data).toLocaleDateString("pt-BR")}
Resumo: ${block.resumo}
Texto:
"""
${block.texto}
"""`;
}

/**
 * Construção do Contexto — organiza artigos encontrados, referências cruzadas,
 * resumo IA e texto original em um único bloco de contexto para o LLM.
 */
export function buildContext(
  mainChunks: RetrievedChunk[],
  referenceChunks: RetrievedChunk[]
): { blocks: ContextBlock[]; formatted: string } {
  const blocks = [...mainChunks, ...referenceChunks].map(buildContextBlock);
  const formatted = blocks.map(formatBlock).join("\n\n");
  return { blocks, formatted };
}

/** Substitui os placeholders {{PERGUNTA}} e {{CONTEXTO}} no template configurável. */
export function buildPrompt(template: string, question: string, formattedContext: string): string {
  return template
    .replaceAll("{{PERGUNTA}}", question)
    .replaceAll("{{CONTEXTO}}", formattedContext || "(nenhum documento recuperado)");
}
