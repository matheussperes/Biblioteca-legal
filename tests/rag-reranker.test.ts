import { describe, expect, it } from "vitest";
import { rerankChunks, type RerankerClient } from "@/modules/reranker";
import { makeChunk } from "./fixtures/rag-fixtures";

describe("Fase 2 — Reranking", () => {
  it("reordena os chunks pelo score retornado pelo LLM", async () => {
    const chunks = [makeChunk({ chunkId: "a" }), makeChunk({ chunkId: "b" }), makeChunk({ chunkId: "c" })];
    const client: RerankerClient = {
      chat: {
        completions: {
          async create(params) {
            expect(params.response_format.type).toBe("json_object");
            return {
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      scores: [
                        { index: 0, score: 2 },
                        { index: 1, score: 9.5 },
                        { index: 2, score: 5 },
                      ],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    };
    const result = await rerankChunks("pergunta", chunks, 2, "gpt-4o-mini", true, client);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].chunkId).toBe("b");
    expect(result.chunks[0].stage).toBe("RERANK");
    expect(result.chunks[0].rerankScore).toBe(9.5);
  });

  it("mantém a ordem original sem chamar o LLM quando desativado", async () => {
    const chunks = [makeChunk({ chunkId: "a" }), makeChunk({ chunkId: "b" })];
    let called = false;
    const client: RerankerClient = {
      chat: { completions: { async create() { called = true; return { choices: [{ message: { content: "{}" } }] }; } } },
    };
    const result = await rerankChunks("pergunta", chunks, 5, "gpt-4o-mini", false, client);
    expect(called).toBe(false);
    expect(result.chunks.map((c) => c.chunkId)).toEqual(["a", "b"]);
  });

  it("tolera resposta fora do formato — scores ficam zerados", async () => {
    const chunks = [makeChunk({ chunkId: "a" }), makeChunk({ chunkId: "b" })];
    const client: RerankerClient = {
      chat: { completions: { async create() { return { choices: [{ message: { content: "não é json" } }] }; } } },
    };
    const result = await rerankChunks("pergunta", chunks, 5, "gpt-4o-mini", true, client);
    expect(result.chunks.every((c) => c.rerankScore === 0)).toBe(true);
  });

  it("retorna lista vazia sem chamar o LLM quando não há candidatos", async () => {
    let called = false;
    const client: RerankerClient = {
      chat: { completions: { async create() { called = true; return { choices: [{ message: { content: "{}" } }] }; } } },
    };
    const result = await rerankChunks("pergunta", [], 5, "gpt-4o-mini", true, client);
    expect(called).toBe(false);
    expect(result.chunks).toEqual([]);
  });
});
