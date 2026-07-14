import OpenAI from "openai";
import type { EmbeddingResult } from "@/shared/types";
import type { EmbeddingsConfig } from "@/shared/config";
import { sha256 } from "@/shared/utils";

/** Interface mínima do cliente — permite injetar mock nos testes. */
export interface EmbeddingClient {
  embeddings: {
    create(params: {
      model: string;
      input: string[];
      dimensions?: number;
    }): Promise<{ data: Array<{ index: number; embedding: number[] }> }>;
  };
}

let defaultClient: OpenAI | null = null;

function getClient(): EmbeddingClient {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY não configurada — necessária para gerar embeddings."
    );
  }
  if (!defaultClient) defaultClient = new OpenAI();
  return defaultClient as unknown as EmbeddingClient;
}

/**
 * Step 8 — Embeddings.
 * Gera embeddings em lote para uma lista de textos, com hash do conteúdo
 * para detecção de mudanças (evita regerar quando o chunk não mudou).
 */
export async function generateEmbeddings(
  texts: string[],
  config: EmbeddingsConfig,
  client: EmbeddingClient = getClient()
): Promise<EmbeddingResult[]> {
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += config.batchSize) {
    const batch = texts.slice(i, i + config.batchSize);
    const start = Date.now();
    const response = await client.embeddings.create({
      model: config.model,
      input: batch,
      dimensions: config.dimension,
    });
    const durationMs = Date.now() - start;
    const perItem = Math.round(durationMs / batch.length);

    const sorted = [...response.data].sort((a, b) => a.index - b.index);
    for (let j = 0; j < batch.length; j++) {
      const vector = sorted[j]?.embedding ?? [];
      results.push({
        vector,
        model: config.model,
        dimension: vector.length,
        hash: sha256(batch[j]),
        durationMs: perItem,
      });
    }
  }

  return results;
}
