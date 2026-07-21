import { normalizeText } from "@/shared/utils";
import type { GeneratedAnswer, RetrievedChunk, ValidationResult } from "@/shared/rag-types";

/**
 * Resolve cada artigo citado pelo LLM ao chunk real de origem — evita citações
 * fantasmas e permite que a interface torne cada artigo clicável.
 */
export function reconcileArticles(
  answer: GeneratedAnswer,
  chunks: RetrievedChunk[]
): GeneratedAnswer {
  const artigosUtilizados = answer.artigosUtilizados.map((item) => {
    const match = chunks.find((c) => {
      const leiMatch =
        normalizeText(c.documentName).includes(normalizeText(item.lei)) ||
        normalizeText(item.lei).includes(normalizeText(c.documentName));
      if (!leiMatch) return false;
      if (item.artigo && c.articleLabel) {
        return (
          normalizeText(c.articleLabel).includes(normalizeText(item.artigo)) ||
          normalizeText(item.artigo).includes(normalizeText(c.articleLabel))
        );
      }
      return true;
    });
    return match
      ? {
          ...item,
          chunkId: match.chunkId,
          documentId: match.documentId,
          articleId: match.articleId,
        }
      : item;
  });
  return { ...answer, artigosUtilizados };
}

/**
 * Validação — regras de segurança do PRD:
 * nunca responder sem evidência, sempre citar artigos existentes no contexto,
 * nunca ocultar conflitos entre normas.
 */
export function validateAnswer(
  answer: GeneratedAnswer,
  retrievedChunks: RetrievedChunk[]
): ValidationResult {
  const warnings: string[] = [];

  if (retrievedChunks.length === 0) {
    return {
      valid: false,
      warnings: ["Nenhum documento foi recuperado — a resposta não deve ser exibida sem evidência."],
      insufficientEvidence: true,
    };
  }

  const unresolved = answer.artigosUtilizados.filter((item) => !item.chunkId);
  if (unresolved.length > 0) {
    warnings.push(
      `${unresolved.length} artigo(s) citado(s) pela IA não corresponderam a nenhum documento recuperado: ${unresolved
        .map((u) => `${u.lei} ${u.artigo ?? ""}`.trim())
        .join(", ")}`
    );
  }

  if (answer.hasConflict && answer.conflictDetails.length === 0) {
    warnings.push(
      "A resposta sinalizou divergência entre normas, mas não detalhou as versões — verifique manualmente."
    );
  }

  const insufficientEvidence = answer.artigosUtilizados.length === 0;
  if (insufficientEvidence && answer.nivelConfianca !== "BAIXO") {
    warnings.push(
      "A resposta não cita nenhum artigo do contexto recuperado; nível de confiança deveria ser BAIXO."
    );
  }

  return { valid: warnings.length === 0, warnings, insufficientEvidence };
}
