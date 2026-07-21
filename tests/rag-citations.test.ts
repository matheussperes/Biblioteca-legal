import { describe, expect, it } from "vitest";
import { buildEvidences, buildTrace } from "@/modules/citations";
import { EMPTY_ENTITIES } from "@/shared/rag-types";
import { makeChunk } from "./fixtures/rag-fixtures";

describe("Fase 2 — Evidências e Explicabilidade", () => {
  it("buildEvidences expõe origem, lei, artigo, score e motivo para cada chunk", () => {
    const evidences = buildEvidences([makeChunk()]);
    expect(evidences).toHaveLength(1);
    expect(evidences[0]).toMatchObject({
      chunkId: "chunk-1",
      lei: "LUOS - Lei Complementar 123/2020",
      artigo: "Art. 10",
      scoreSimilaridade: 0.12,
    });
    expect(evidences[0].motivoRecuperacao).toContain("Similaridade vetorial");
  });

  it("buildTrace preserva todas as etapas da recuperação para o modal de explicabilidade", () => {
    const chunk = makeChunk();
    const trace = buildTrace({
      question: "Qual a altura máxima?",
      category: "Altura",
      categoryConfidence: 0.9,
      entities: EMPTY_ENTITIES,
      vectorStage: [chunk],
      metadataStage: [chunk],
      referenceStage: [],
      rerankStage: [chunk],
      prompt: "prompt final",
      rawResponse: "{}",
      model: "gpt-4o-mini",
      temperature: 0,
      promptTokens: 100,
      completionTokens: 50,
      costUsd: 0.001,
      durationMs: 1200,
    });
    expect(trace.vectorStage).toHaveLength(1);
    expect(trace.rerankStage[0].chunkId).toBe("chunk-1");
    expect(trace.model).toBe("gpt-4o-mini");
  });
});
