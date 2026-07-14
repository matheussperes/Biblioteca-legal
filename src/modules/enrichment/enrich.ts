import OpenAI from "openai";
import type { EnrichmentData, EnrichmentResult } from "@/shared/types";
import type { EnrichmentConfig } from "@/shared/config";
import { estimateCostUsd } from "@/shared/config";

/** Interface mínima do cliente — permite injetar mock nos testes. */
export interface EnrichmentClient {
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

function getClient(): EnrichmentClient {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY não configurada — necessária para o Enriquecimento IA."
    );
  }
  if (!defaultClient) defaultClient = new OpenAI();
  return defaultClient as unknown as EnrichmentClient;
}

/**
 * Step 7 — Enriquecimento IA.
 * Executa o prompt configurável sobre o texto de um artigo/chunk e retorna
 * o JSON de enriquecimento + metadados de execução (tempo, custo estimado).
 */
export async function enrichText(
  text: string,
  contexto: string,
  config: EnrichmentConfig,
  client: EnrichmentClient = getClient()
): Promise<EnrichmentResult> {
  const prompt = config.prompt
    .replaceAll("{{TEXTO}}", text)
    .replaceAll("{{CONTEXTO}}", contexto || "(sem contexto adicional)");

  const start = Date.now();
  const response = await client.chat.completions.create({
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const durationMs = Date.now() - start;

  const raw = response.choices[0]?.message?.content ?? "";
  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;

  return {
    data: parseEnrichment(raw),
    prompt,
    rawResponse: raw,
    model: config.model,
    durationMs,
    costUsd: estimateCostUsd(config.model, inputTokens, outputTokens),
    inputTokens,
    outputTokens,
  };
}

function parseEnrichment(raw: string): EnrichmentData {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    // resposta fora do formato — mantém campos vazios e preserva o raw
  }
  return {
    resumo: str(parsed.resumo),
    palavras_chave: strList(parsed.palavras_chave),
    tema: str(parsed.tema),
    subtema: str(parsed.subtema),
    categoria: str(parsed.categoria),
    tipo_documento: str(parsed.tipo_documento),
    referencias: strList(parsed.referencias),
    assuntos: strList(parsed.assuntos),
    entidades: strList(parsed.entidades),
    observacoes: str(parsed.observacoes),
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}
