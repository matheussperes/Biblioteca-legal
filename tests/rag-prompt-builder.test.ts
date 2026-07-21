import { describe, expect, it } from "vitest";
import { buildContext, buildContextBlock, buildPrompt, deriveSituacao } from "@/modules/prompt-builder";
import { makeChunk } from "./fixtures/rag-fixtures";

describe("Fase 2 — Prompt Builder", () => {
  it("monta um bloco com lei, capítulo, seção, artigo, resumo, texto e situação", () => {
    const block = buildContextBlock(makeChunk());
    expect(block.lei).toBe("LUOS - Lei Complementar 123/2020");
    expect(block.capitulo).toBe("CAPÍTULO II — Zoneamento");
    expect(block.artigo).toBe("Art. 10");
    expect(block.resumo).toContain("altura máxima");
    expect(block.situacao).toBe("Vigente");
  });

  it("marca chunks do estágio REFERENCE como referência cruzada", () => {
    const block = buildContextBlock(makeChunk({ stage: "REFERENCE" }));
    expect(block.crossReference).toBe(true);
  });

  it("deriveSituacao identifica revogação e nova redação nas observações", () => {
    expect(deriveSituacao(makeChunk({ enrichment: { observacoes: "Este artigo foi revogado." } }))).toBe(
      "Possivelmente revogada"
    );
    expect(
      deriveSituacao(makeChunk({ enrichment: { observacoes: "Redação dada pela Lei 456/2021." } }))
    ).toBe("Alterada (nova redação)");
    expect(deriveSituacao(makeChunk({ enrichment: { observacoes: "" } }))).toBe("Vigente");
  });

  it("buildContext junta chunks principais e referências cruzadas no contexto formatado", () => {
    const main = makeChunk({ chunkId: "main" });
    const ref = makeChunk({ chunkId: "ref", stage: "REFERENCE", documentName: "Código de Obras" });
    const { blocks, formatted } = buildContext([main], [ref]);
    expect(blocks).toHaveLength(2);
    expect(formatted).toContain("LUOS - Lei Complementar 123/2020");
    expect(formatted).toContain("Código de Obras");
    expect(formatted).toContain("(referência cruzada)");
  });

  it("buildPrompt substitui os placeholders {{PERGUNTA}} e {{CONTEXTO}}", () => {
    const prompt = buildPrompt("Pergunta: {{PERGUNTA}}\nContexto: {{CONTEXTO}}", "Qual a altura máxima?", "texto de contexto");
    expect(prompt).toBe("Pergunta: Qual a altura máxima?\nContexto: texto de contexto");
  });

  it("buildPrompt informa explicitamente quando não há contexto", () => {
    const prompt = buildPrompt("{{CONTEXTO}}", "pergunta", "");
    expect(prompt).toBe("(nenhum documento recuperado)");
  });
});
