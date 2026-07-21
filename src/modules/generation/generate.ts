import OpenAI from "openai";
import { estimateCostUsd } from "@/shared/config";
import type {
  ArticleUsed,
  ConfidenceLevel,
  ConflictDetail,
  CrossReference,
  GeneratedAnswer,
  GenerationResult,
} from "@/shared/rag-types";

/** Interface mínima do cliente — permite injetar mock nos testes. */
export interface GenerationClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        temperature: number;
        max_tokens: number;
        response_format: { type: "json_object" };
        messages: Array<{ role: "user"; content: string }>;
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
        usage?: { prompt_tokens: number; completion_tokens: number } | null;
      }>;
    };
  };
}

let defaultClient: OpenAI | null = null;

function getClient(): GenerationClient {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada — necessária para gerar a resposta.");
  }
  if (!defaultClient) defaultClient = new OpenAI();
  return defaultClient as unknown as GenerationClient;
}

const CONFIDENCE_LEVELS: ConfidenceLevel[] = ["ALTO", "MEDIO", "BAIXO"];

/**
 * Geração — chama o LLM com o prompt final (regras + contexto + pergunta) e
 * retorna a resposta estruturada: resumo executivo, fundamentação, artigos
 * utilizados, referências cruzadas, observações e nível de confiança.
 */
export async function generateAnswer(
  prompt: string,
  model: string,
  temperature: number,
  maxTokens: number,
  client: GenerationClient = getClient()
): Promise<GenerationResult> {
  const start = Date.now();
  const response = await client.chat.completions.create({
    model,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const durationMs = Date.now() - start;

  const raw = response.choices[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;

  return {
    answer: parseAnswer(raw),
    prompt,
    rawResponse: raw,
    model,
    temperature,
    durationMs,
    costUsd: estimateCostUsd(model, inputTokens, outputTokens),
    inputTokens,
    outputTokens,
  };
}

function parseAnswer(raw: string): GeneratedAnswer {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // resposta fora do formato — cai no fallback "sem evidência suficiente"
  }

  const nivel = parsed.nivel_confianca;
  const nivelConfianca: ConfidenceLevel =
    typeof nivel === "string" && (CONFIDENCE_LEVELS as string[]).includes(nivel)
      ? (nivel as ConfidenceLevel)
      : "BAIXO";

  return {
    resumoExecutivo: str(parsed.resumo_executivo),
    fundamentacao: str(parsed.fundamentacao),
    artigosUtilizados: articlesList(parsed.artigos_utilizados),
    referenciasCruzadas: referencesList(parsed.referencias_cruzadas),
    observacoes: str(parsed.observacoes),
    nivelConfianca,
    hasConflict: parsed.has_conflict === true,
    conflictDetails: conflictList(parsed.conflict_details),
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function articlesList(value: unknown): ArticleUsed[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      chunkId: "",
      articleId: null,
      documentId: "",
      lei: str(v.lei),
      capitulo: v.capitulo != null ? str(v.capitulo) : null,
      secao: v.secao != null ? str(v.secao) : null,
      artigo: v.artigo != null ? str(v.artigo) : null,
      trecho: str(v.trecho),
    }));
}

function referencesList(value: unknown): CrossReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      lei: str(v.lei),
      artigo: v.artigo != null ? str(v.artigo) : null,
      motivo: str(v.motivo),
    }));
}

function conflictList(value: unknown): ConflictDetail[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
    .map((v) => ({
      tema: str(v.tema),
      versoes: Array.isArray(v.versoes)
        ? v.versoes
            .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
            .map((x) => ({
              lei: str(x.lei),
              artigo: x.artigo != null ? str(x.artigo) : null,
              valor: str(x.valor),
            }))
        : [],
    }));
}
