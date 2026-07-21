import { describe, expect, it } from "vitest";
import { reconcileArticles, validateAnswer } from "@/modules/validation";
import type { GeneratedAnswer } from "@/shared/rag-types";
import { makeChunk } from "./fixtures/rag-fixtures";

function baseAnswer(overrides: Partial<GeneratedAnswer> = {}): GeneratedAnswer {
  return {
    resumoExecutivo: "resumo",
    fundamentacao: "fundamentação",
    artigosUtilizados: [],
    referenciasCruzadas: [],
    observacoes: "",
    nivelConfianca: "ALTO",
    hasConflict: false,
    conflictDetails: [],
    ...overrides,
  };
}

describe("Fase 2 — Validação", () => {
  it("resolve o artigo citado ao chunk real de origem (reconcileArticles)", () => {
    const chunk = makeChunk({ chunkId: "c1", documentId: "d1", articleId: "a1" });
    const answer = baseAnswer({
      artigosUtilizados: [
        {
          chunkId: "",
          articleId: null,
          documentId: "",
          lei: "LUOS",
          capitulo: null,
          secao: null,
          artigo: "Art. 10",
          trecho: "...",
        },
      ],
    });
    const reconciled = reconcileArticles(answer, [chunk]);
    expect(reconciled.artigosUtilizados[0].chunkId).toBe("c1");
    expect(reconciled.artigosUtilizados[0].articleId).toBe("a1");
  });

  it("nunca responde sem evidência — sinaliza insuficiência quando não há chunks", () => {
    const result = validateAnswer(baseAnswer(), []);
    expect(result.valid).toBe(false);
    expect(result.insufficientEvidence).toBe(true);
  });

  it("alerta quando um artigo citado não foi encontrado no contexto recuperado", () => {
    const chunk = makeChunk();
    const answer = baseAnswer({
      artigosUtilizados: [
        { chunkId: "", articleId: null, documentId: "", lei: "Lei Fantasma", capitulo: null, secao: null, artigo: "Art. 99", trecho: "x" },
      ],
    });
    const result = validateAnswer(answer, [chunk]);
    expect(result.valid).toBe(false);
    expect(result.warnings[0]).toContain("não corresponderam");
  });

  it("nunca oculta conflitos — alerta se has_conflict for true sem detalhes", () => {
    const chunk = makeChunk();
    const answer = baseAnswer({ hasConflict: true, conflictDetails: [] });
    const result = validateAnswer(answer, [chunk]);
    expect(result.warnings.some((w) => w.includes("divergência"))).toBe(true);
  });

  it("aprova uma resposta bem fundamentada sem avisos", () => {
    const chunk = makeChunk({ chunkId: "c1" });
    const answer = baseAnswer({
      artigosUtilizados: [
        { chunkId: "c1", articleId: "a1", documentId: "d1", lei: "LUOS", capitulo: null, secao: null, artigo: "Art. 10", trecho: "x" },
      ],
    });
    const result = validateAnswer(answer, [chunk]);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
