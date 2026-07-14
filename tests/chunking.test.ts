import { describe, expect, it } from "vitest";
import { cleanText } from "@/modules/cleaning";
import { tokenize } from "@/modules/tokenizer";
import { buildTree } from "@/modules/parser";
import { buildStructureJson, flattenArticles } from "@/modules/tree";
import { chunkArticles } from "@/modules/chunking";
import { LEI_EXEMPLO } from "./fixtures/lei-exemplo";

const structure = buildStructureJson(
  buildTree(tokenize(cleanText(LEI_EXEMPLO).cleaned))
);
const articles = flattenArticles(structure);

describe("Step 6 — Chunkização", () => {
  it("cada artigo vira um chunk quando cabe no limite", () => {
    const chunks = chunkArticles("Lei 1.234/2020", articles, {
      chunkSize: 400,
      overlap: 1,
      maxTokens: 512,
      strategy: "article",
    });
    expect(chunks).toHaveLength(5);
    expect(chunks.every((c) => c.totalParts === 1)).toBe(true);
  });

  it("chunk preserva contexto no cabeçalho", () => {
    const chunks = chunkArticles("Lei 1.234/2020", articles, {
      chunkSize: 400,
      overlap: 1,
      maxTokens: 512,
      strategy: "article",
    });
    const art4 = chunks.find((c) => c.articleRef === "4")!;
    expect(art4.content).toContain("Lei 1.234/2020");
    expect(art4.content).toContain("CAPÍTULO II");
    expect(art4.content).toContain("Seção II");
    expect(art4.content).toContain("Art. 4");
  });

  it("divide artigo que excede o limite sem partir unidades ao meio", () => {
    const chunks = chunkArticles("Lei 1.234/2020", articles, {
      chunkSize: 100,
      overlap: 0,
      maxTokens: 100,
      strategy: "article",
    });
    const art4Parts = chunks.filter((c) => c.articleRef === "4");
    expect(art4Parts.length).toBeGreaterThan(1);

    // nenhuma unidade estrutural é partida: toda linha do original aparece
    // integralmente em alguma parte
    const art4 = articles.find((a) => a.numero === "4")!;
    for (const unit of art4.fullText.split("\n")) {
      expect(
        art4Parts.some((p) => p.content.includes(unit.trim())),
        `unidade partida: ${unit}`
      ).toBe(true);
    }

    // partes numeradas
    expect(art4Parts[0].content).toContain("[Parte 1/");
    expect(art4Parts.every((p) => p.totalParts === art4Parts.length)).toBe(true);
  });

  it("aplica overlap de unidades entre partes", () => {
    const chunks = chunkArticles("Lei", articles, {
      chunkSize: 100,
      overlap: 1,
      maxTokens: 100,
      strategy: "article",
    });
    const parts = chunks.filter((c) => c.articleRef === "4");
    expect(parts.length).toBeGreaterThan(1);
    // a última unidade da parte 1 reaparece na parte 2
    const part1Lines = parts[0].content.split("\n").filter(Boolean);
    const lastUnit = part1Lines[part1Lines.length - 1];
    expect(parts[1].content).toContain(lastUnit);
  });

  it("respeita maxTokens", () => {
    const chunks = chunkArticles("Lei", articles, {
      chunkSize: 120,
      overlap: 0,
      maxTokens: 120,
      strategy: "article",
    });
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeLessThanOrEqual(140); // margem do cabeçalho
    }
  });

  it("calcula tokens e caracteres", () => {
    const chunks = chunkArticles("Lei", articles, {
      chunkSize: 400,
      overlap: 1,
      maxTokens: 512,
      strategy: "article",
    });
    for (const chunk of chunks) {
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.charCount).toBe(chunk.content.length);
    }
  });
});
