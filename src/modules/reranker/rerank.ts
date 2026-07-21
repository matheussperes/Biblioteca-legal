import OpenAI from "openai";
import type { RetrievedChunk } from "@/shared/rag-types";

/** Interface mínima do cliente — permite injetar mock nos testes. */
export interface RerankerClient {
  chat: {
    completions: {
      create(params: {
        model: string;
        temperature: number;
        response_format: { type: "json_object" };
        messages: Array<{ role: "user"; content: string }>;
      }): Promise<{
        choices: Array<{ message: { content: string | null } }>;
      }>;
    };
  };
}

let defaultClient: OpenAI | null = null;

function getClient(): RerankerClient {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada — necessária para o reranking.");
  }
  if (!defaultClient) defaultClient = new OpenAI();
  return defaultClient as unknown as RerankerClient;
}

function truncate(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function buildPrompt(question: string, chunks: RetrievedChunk[]): string {
  const items = chunks
    .map(
      (c, i) =>
        `[${i}] Lei: ${c.documentName} | Artigo: ${c.articleLabel ?? "—"} | Trecho: ${truncate(c.content)}`
    )
    .join("\n\n");

  return `Pergunta do usuário:
"""
${question}
"""

Trechos candidatos, numerados:

${items}

Para cada trecho numerado, atribua uma pontuação de relevância de 0 a 10 para responder à pergunta acima (10 = totalmente relevante, 0 = irrelevante).

Responda APENAS com um JSON no formato:
{ "scores": [{ "index": 0, "score": 8.5 }, ...] }`;
}

function parseScores(raw: string, count: number): number[] {
  const scores = new Array<number>(count).fill(0);
  try {
    const parsed = JSON.parse(raw) as { scores?: unknown };
    if (Array.isArray(parsed.scores)) {
      for (const entry of parsed.scores) {
        if (
          entry &&
          typeof entry === "object" &&
          typeof (entry as { index?: unknown }).index === "number" &&
          typeof (entry as { score?: unknown }).score === "number"
        ) {
          const { index, score } = entry as { index: number; score: number };
          if (index >= 0 && index < count) {
            scores[index] = Math.min(10, Math.max(0, score));
          }
        }
      }
    }
  } catch {
    // resposta fora do formato — mantém scores zerados (preserva ordem original)
  }
  return scores;
}

export interface RerankResult {
  chunks: RetrievedChunk[];
  prompt: string;
  rawResponse: string;
}

/**
 * Reranking — reordena os chunks candidatos e retorna o Top Final.
 * Pode ser desativado nas Configurações; nesse caso mantém a ordem anterior.
 */
export async function rerankChunks(
  question: string,
  chunks: RetrievedChunk[],
  topFinal: number,
  model: string,
  enabled: boolean,
  client?: RerankerClient
): Promise<RerankResult> {
  if (!enabled || chunks.length === 0) {
    const kept = chunks.slice(0, topFinal).map((c) => ({
      ...c,
      stage: "RERANK" as const,
      reason: `${c.reason} (reranking desativado — ordem anterior mantida)`,
    }));
    return { chunks: kept, prompt: "", rawResponse: "" };
  }

  const prompt = buildPrompt(question, chunks);
  const resolvedClient = client ?? getClient();
  const response = await resolvedClient.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = response.choices[0]?.message?.content ?? "";
  const scores = parseScores(raw, chunks.length);

  const rescored = chunks.map((c, i) => ({ ...c, rerankScore: scores[i] ?? 0 }));
  rescored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

  const top = rescored.slice(0, topFinal).map((c) => ({
    ...c,
    stage: "RERANK" as const,
    reason: `Reranking: relevância ${(c.rerankScore ?? 0).toFixed(1)}/10 para a pergunta`,
  }));

  return { chunks: top, prompt, rawResponse: raw };
}
