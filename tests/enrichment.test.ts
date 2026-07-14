import { describe, expect, it } from "vitest";
import { enrichText, type EnrichmentClient } from "@/modules/enrichment";
import { generateEmbeddings, type EmbeddingClient } from "@/modules/embeddings";
import { DEFAULT_CONFIG } from "@/shared/config";

const mockEnrichmentClient: EnrichmentClient = {
  chat: {
    completions: {
      async create(params) {
        expect(params.response_format.type).toBe("json_object");
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  resumo: "Define requisitos urbanísticos para loteamentos.",
                  palavras_chave: ["loteamento", "urbanismo"],
                  tema: "Urbanismo",
                  subtema: "Parcelamento do solo",
                  categoria: "urbanístico",
                  tipo_documento: "lei ordinária",
                  referencias: ["Lei Federal nº 10.257/2001"],
                  assuntos: ["requisitos de loteamento"],
                  entidades: ["Município"],
                  observacoes: "",
                }),
              },
            },
          ],
          usage: { prompt_tokens: 500, completion_tokens: 120 },
        };
      },
    },
  },
};

describe("Step 7 — Enriquecimento IA", () => {
  it("substitui os placeholders e retorna JSON estruturado", async () => {
    const result = await enrichText(
      "Art. 4º Os loteamentos deverão atender...",
      "CAPÍTULO II > Seção II > Art. 4",
      DEFAULT_CONFIG.enrichment,
      mockEnrichmentClient
    );
    expect(result.prompt).toContain("Art. 4º Os loteamentos");
    expect(result.prompt).toContain("CAPÍTULO II > Seção II");
    expect(result.prompt).not.toContain("{{TEXTO}}");
    expect(result.data.tema).toBe("Urbanismo");
    expect(result.data.palavras_chave).toContain("loteamento");
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("tolera resposta fora do formato JSON", async () => {
    const badClient: EnrichmentClient = {
      chat: {
        completions: {
          async create() {
            return { choices: [{ message: { content: "não é json" } }] };
          },
        },
      },
    };
    const result = await enrichText(
      "texto",
      "",
      DEFAULT_CONFIG.enrichment,
      badClient
    );
    expect(result.data.resumo).toBe("");
    expect(result.rawResponse).toBe("não é json");
  });
});

describe("Step 8 — Embeddings", () => {
  const mockEmbeddingClient: EmbeddingClient = {
    embeddings: {
      async create(params) {
        return {
          data: params.input.map((_, index) => ({
            index,
            embedding: Array.from({ length: 8 }, (_, i) => i / 10),
          })),
        };
      },
    },
  };

  it("gera embedding com hash e dimensão", async () => {
    const results = await generateEmbeddings(
      ["texto a", "texto b"],
      { model: "text-embedding-3-small", dimension: 8, batchSize: 64 },
      mockEmbeddingClient
    );
    expect(results).toHaveLength(2);
    expect(results[0].dimension).toBe(8);
    expect(results[0].hash).toMatch(/^[a-f0-9]{64}$/);
    expect(results[0].hash).not.toBe(results[1].hash);
    expect(results[0].model).toBe("text-embedding-3-small");
  });

  it("processa em lotes respeitando batchSize", async () => {
    let calls = 0;
    const countingClient: EmbeddingClient = {
      embeddings: {
        async create(params) {
          calls += 1;
          expect(params.input.length).toBeLessThanOrEqual(2);
          return {
            data: params.input.map((_, index) => ({ index, embedding: [1, 2] })),
          };
        },
      },
    };
    const results = await generateEmbeddings(
      ["a", "b", "c", "d", "e"],
      { model: "m", dimension: 2, batchSize: 2 },
      countingClient
    );
    expect(results).toHaveLength(5);
    expect(calls).toBe(3);
  });
});
